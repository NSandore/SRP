<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/newsroom.php';
require_once __DIR__ . '/../includes/rate_limit.php';

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'POST is required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = $_POST;
}
$action = strtolower(trim((string)($data['action'] ?? '')));

try {
    $db = getDB();
    $adminId = srp_newsroom_super_admin_id($db);
    if ($adminId === '') {
        http_response_code(isset($_SESSION['user_id']) ? 403 : 401);
        echo json_encode(['success' => false, 'error' => 'Only super admins can manage the Newsroom.']);
        exit;
    }
    srp_ensure_newsroom_table($db);

    if ($action === 'sync_official') {
        srp_rate_limit_enforce(
            $db,
            'newsroom-sync:' . $adminId,
            10,
            3600,
            'The official source has been synced several times. Please wait before trying again.'
        );
        $result = srp_newsroom_sync_official($db);
        echo json_encode([
            'success' => true,
            'message' => sprintf(
                'Education news synced: %d new, %d refreshed.',
                $result['imported'],
                $result['updated']
            ),
            'sync' => $result,
        ]);
        exit;
    }

    if ($action === 'add_manual') {
        $title = srp_sanitize_plain((string)($data['title'] ?? ''), 500);
        $summary = srp_sanitize_plain((string)($data['summary'] ?? ''), 4000);
        $sourceName = srp_sanitize_plain((string)($data['source_name'] ?? 'Manual source'), 160);
        $url = srp_newsroom_safe_url((string)($data['source_url'] ?? ''));
        if ($title === '' || $url === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A headline and valid source URL are required.']);
            exit;
        }
        $id = generateUniqueId($db, 'newsroom_items');
        $stmt = $db->prepare("
            INSERT INTO newsroom_items (
                newsroom_item_id, source_type, source_name, source_url, source_url_hash,
                source_title, source_content, source_published_at, status, created_by
            ) VALUES (
                :id, 'manual', :source_name, :source_url, :source_hash,
                :title, :summary, :published_at, 'incoming', :created_by
            )
        ");
        try {
            $stmt->execute([
                ':id' => $id,
                ':source_name' => $sourceName ?: 'Manual source',
                ':source_url' => $url,
                ':source_hash' => srp_newsroom_source_hash($url),
                ':title' => $title,
                ':summary' => $summary,
                ':published_at' => srp_newsroom_datetime((string)($data['published_at'] ?? '')),
                ':created_by' => $adminId,
            ]);
        } catch (PDOException $e) {
            if ((string)$e->getCode() === '23000') {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => 'That source is already in the Newsroom.']);
                exit;
            }
            throw $e;
        }
        echo json_encode(['success' => true, 'item_id' => $id, 'message' => 'Article added to the review queue.']);
        exit;
    }

    $itemId = normalizeId($data['item_id'] ?? '');
    if ($itemId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'A newsroom item is required.']);
        exit;
    }
    $item = srp_newsroom_fetch_item($db, $itemId);
    if (!$item) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Newsroom item not found.']);
        exit;
    }

    if ($action === 'generate_draft') {
        srp_rate_limit_enforce(
            $db,
            'newsroom-draft:' . $adminId,
            30,
            3600,
            'The newsroom has generated several drafts. Please wait before trying again.'
        );
        if (($item['status'] ?? '') === 'published') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Published news cannot be regenerated.']);
            exit;
        }
        $draft = srp_newsroom_generate_draft($item, $adminId);
        $stmt = $db->prepare("
            UPDATE newsroom_items
            SET status = 'draft',
                draft_title = :title,
                draft_body = :body,
                draft_tags = :tags,
                ai_model = :model,
                ai_prompt_version = :prompt_version,
                ai_generated_at = NOW(),
                ai_generated_by = :actor,
                reviewed_by = :actor,
                reviewed_at = NOW()
            WHERE newsroom_item_id = :id
        ");
        $stmt->execute([
            ':title' => $draft['title'],
            ':body' => $draft['body'],
            ':tags' => json_encode($draft['tags']),
            ':model' => $draft['model'],
            ':prompt_version' => SRP_NEWSROOM_PROMPT_VERSION,
            ':actor' => $adminId,
            ':id' => $itemId,
        ]);
        echo json_encode([
            'success' => true,
            'draft' => [
                'title' => $draft['title'],
                'body' => $draft['body'],
                'tags' => $draft['tags'],
            ],
            'ai_generated' => $draft['ai_generated'],
            'warning' => $draft['warning'],
            'message' => $draft['ai_generated'] ? 'AI draft prepared for review.' : 'Template draft prepared for review.',
        ]);
        exit;
    }

    if ($action === 'save_draft') {
        if (($item['status'] ?? '') === 'published') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Published news cannot be edited here.']);
            exit;
        }
        $title = srp_sanitize_plain((string)($data['draft_title'] ?? ''));
        $body = srp_sanitize_html((string)($data['draft_content'] ?? $data['draft_body'] ?? ''));
        $forumId = normalizeId($data['forum_id'] ?? '');
        $allowedTags = ['academics', 'financial-aid', 'career-services', 'research-opportunities'];
        $tags = array_values(array_intersect($allowedTags, (array)($data['tags'] ?? [])));
        if ($title === '' || trim(strip_tags($body)) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Draft title and content are required.']);
            exit;
        }
        if (srp_content_text_length($title) > SRP_THREAD_TITLE_MAX_LENGTH) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Thread titles must be 160 characters or fewer.']);
            exit;
        }
        if (srp_post_exceeds_limit($body)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Posts must be 10,000 characters or fewer.']);
            exit;
        }
        if ($forumId !== '') {
            $forumStmt = $db->prepare('SELECT 1 FROM forums WHERE forum_id = :id AND is_hidden = 0');
            $forumStmt->execute([':id' => $forumId]);
            if (!$forumStmt->fetchColumn()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Choose a valid destination forum.']);
                exit;
            }
        }
        $stmt = $db->prepare("
            UPDATE newsroom_items
            SET status = 'draft', draft_title = :title, draft_body = :body,
                draft_tags = :tags, target_forum_id = :forum_id,
                reviewed_by = :actor, reviewed_at = NOW()
            WHERE newsroom_item_id = :id
        ");
        $stmt->execute([
            ':title' => $title,
            ':body' => $body,
            ':tags' => json_encode($tags ?: ['academics']),
            ':forum_id' => $forumId !== '' ? $forumId : null,
            ':actor' => $adminId,
            ':id' => $itemId,
        ]);
        echo json_encode(['success' => true, 'message' => 'Draft saved.']);
        exit;
    }

    if ($action === 'dismiss') {
        if (($item['status'] ?? '') === 'published') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Published news cannot be dismissed.']);
            exit;
        }
        $stmt = $db->prepare("
            UPDATE newsroom_items
            SET status = 'dismissed', reviewed_by = :actor, reviewed_at = NOW()
            WHERE newsroom_item_id = :id
        ");
        $stmt->execute([':actor' => $adminId, ':id' => $itemId]);
        echo json_encode(['success' => true, 'message' => 'Article dismissed.']);
        exit;
    }

    if ($action === 'publish') {
        $forumId = normalizeId($data['forum_id'] ?? '');
        $title = srp_sanitize_plain((string)($data['draft_title'] ?? $item['draft_title'] ?? ''));
        $body = srp_sanitize_html((string)($data['draft_content'] ?? $data['draft_body'] ?? $item['draft_body'] ?? ''));
        if ($forumId === '' || $title === '' || trim(strip_tags($body)) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Forum, thread title, and first post are required.']);
            exit;
        }
        if (srp_content_text_length($title) > SRP_THREAD_TITLE_MAX_LENGTH) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Thread titles must be 160 characters or fewer.']);
            exit;
        }
        if (srp_post_exceeds_limit($body)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Posts must be 10,000 characters or fewer.']);
            exit;
        }
        srp_ensure_tag_tables($db);
        $db->beginTransaction();
        try {
            $locked = srp_newsroom_fetch_item($db, $itemId, true);
            if (!$locked) {
                throw new RuntimeException('Newsroom item not found.');
            }
            if (($locked['status'] ?? '') === 'published' && !empty($locked['thread_id'])) {
                $db->commit();
                echo json_encode([
                    'success' => true,
                    'thread_id' => (string)$locked['thread_id'],
                    'forum_id' => (string)$locked['target_forum_id'],
                    'message' => 'This article was already published.',
                ]);
                exit;
            }
            $forumStmt = $db->prepare('SELECT 1 FROM forums WHERE forum_id = :id AND is_hidden = 0 LIMIT 1');
            $forumStmt->execute([':id' => $forumId]);
            if (!$forumStmt->fetchColumn()) {
                throw new InvalidArgumentException('Choose a valid destination forum.');
            }

            $threadId = generateUniqueId($db, 'threads');
            $postId = generateUniqueId($db, 'posts');
            $threadStmt = $db->prepare("
                INSERT INTO threads (
                    thread_id, forum_id, user_id, title, image_path, image_layout, created_at
                ) VALUES (:id, :forum_id, :user_id, :title, NULL, 'banner', NOW())
            ");
            $threadStmt->execute([
                ':id' => $threadId,
                ':forum_id' => $forumId,
                ':user_id' => $adminId,
                ':title' => $title,
            ]);
            $postStmt = $db->prepare("
                INSERT INTO posts (post_id, thread_id, user_id, content, created_at)
                VALUES (:id, :thread_id, :user_id, :content, NOW())
            ");
            $postStmt->execute([
                ':id' => $postId,
                ':thread_id' => $threadId,
                ':user_id' => $adminId,
                ':content' => $body,
            ]);

            $allowedTags = ['academics', 'financial-aid', 'career-services', 'research-opportunities'];
            $submittedTags = array_values(array_intersect($allowedTags, (array)($data['tags'] ?? [])));
            $storedTags = json_decode((string)($locked['draft_tags'] ?? '[]'), true);
            $tags = $submittedTags ?: (is_array($storedTags) ? $storedTags : []);
            $tagIds = srp_resolve_tag_ids($db, $tags);
            srp_sync_tag_mappings($db, 'thread_tags', 'thread_id', $threadId, $tagIds);

            $update = $db->prepare("
                UPDATE newsroom_items
                SET status = 'published', draft_title = :title, draft_body = :body,
                    draft_tags = :tags, target_forum_id = :forum_id, thread_id = :thread_id,
                    reviewed_by = :actor, reviewed_at = COALESCE(reviewed_at, NOW()),
                    published_by = :actor, published_at = NOW()
                WHERE newsroom_item_id = :id
            ");
            $update->execute([
                ':title' => $title,
                ':body' => $body,
                ':tags' => json_encode($tags ?: ['academics']),
                ':forum_id' => $forumId,
                ':thread_id' => $threadId,
                ':actor' => $adminId,
                ':id' => $itemId,
            ]);
            $db->commit();
            echo json_encode([
                'success' => true,
                'thread_id' => $threadId,
                'post_id' => $postId,
                'forum_id' => $forumId,
                'message' => 'Thread published and added to the News pane.',
            ]);
            exit;
        } catch (InvalidArgumentException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown newsroom action.']);
} catch (Throwable $e) {
    error_log('[SRP] Newsroom action failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to complete the newsroom action.']);
}
