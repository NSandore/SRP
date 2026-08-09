<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/changelog.php';
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
    srp_ensure_changelog_table($db);
    $userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';

    // Dismissing a prompt is an ordinary signed-in action, not an admin one.
    if ($action === 'dismiss') {
        if ($userId === '') {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'You must be signed in.']);
            exit;
        }
        $entryId = normalizeId((string)($data['changelog_entry_id'] ?? ''));
        if ($entryId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A changelog entry is required.']);
            exit;
        }
        $stmt = $db->prepare(
            "SELECT changelog_entry_id, published_at FROM changelog_entries
             WHERE changelog_entry_id = :id AND status = 'published' AND published_at IS NOT NULL
             LIMIT 1"
        );
        $stmt->execute([':id' => $entryId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'That changelog entry is not available.']);
            exit;
        }
        srp_changelog_mark_seen($db, $userId, $entryId, (string)$row['published_at']);
        echo json_encode(['success' => true]);
        exit;
    }

    $adminId = srp_changelog_super_admin_id($db);
    if ($adminId === '') {
        http_response_code($userId === '' ? 401 : 403);
        echo json_encode(['success' => false, 'error' => 'Only super admins can manage the changelog.']);
        exit;
    }

    srp_rate_limit_enforce(
        $db,
        'changelog-admin:' . $adminId,
        60,
        3600,
        'Too many changelog changes in a short period. Please wait a moment.'
    );

    if ($action === 'create' || $action === 'update') {
        $fields = srp_changelog_normalize_input($data);

        if ($action === 'create') {
            $entryId = generateUniqueId($db, 'changelog_entries');
            $stmt = $db->prepare(
                'INSERT INTO changelog_entries
                    (changelog_entry_id, title, emoji, version_label, summary, body, status, created_by)
                 VALUES (:id, :title, :emoji, :version_label, :summary, :body, :status, :created_by)'
            );
            $stmt->execute([
                ':id' => $entryId,
                ':title' => $fields['title'],
                ':emoji' => $fields['emoji'],
                ':version_label' => $fields['version_label'],
                ':summary' => $fields['summary'],
                ':body' => $fields['body'],
                ':status' => 'draft',
                ':created_by' => $adminId,
            ]);
        } else {
            $entryId = normalizeId((string)($data['changelog_entry_id'] ?? ''));
            if ($entryId === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'A changelog entry is required.']);
                exit;
            }
            $stmt = $db->prepare(
                'UPDATE changelog_entries
                 SET title = :title, emoji = :emoji, version_label = :version_label,
                     summary = :summary, body = :body
                 WHERE changelog_entry_id = :id'
            );
            $stmt->execute([
                ':title' => $fields['title'],
                ':emoji' => $fields['emoji'],
                ':version_label' => $fields['version_label'],
                ':summary' => $fields['summary'],
                ':body' => $fields['body'],
                ':id' => $entryId,
            ]);
            if ($stmt->rowCount() === 0) {
                $exists = $db->prepare('SELECT 1 FROM changelog_entries WHERE changelog_entry_id = :id LIMIT 1');
                $exists->execute([':id' => $entryId]);
                if (!$exists->fetchColumn()) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'That changelog entry no longer exists.']);
                    exit;
                }
            }
        }

        $fetch = $db->prepare('SELECT * FROM changelog_entries WHERE changelog_entry_id = :id LIMIT 1');
        $fetch->execute([':id' => $entryId]);
        echo json_encode([
            'success' => true,
            'entry' => srp_changelog_present($fetch->fetch(PDO::FETCH_ASSOC) ?: [], true),
        ]);
        exit;
    }

    if ($action === 'publish' || $action === 'unpublish') {
        $entryId = normalizeId((string)($data['changelog_entry_id'] ?? ''));
        if ($entryId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A changelog entry is required.']);
            exit;
        }
        if ($action === 'publish') {
            // published_at is the watermark every prompt decision compares
            // against, so it is stamped once and preserved on re-publish.
            $stmt = $db->prepare(
                "UPDATE changelog_entries
                 SET status = 'published',
                     published_at = COALESCE(published_at, UTC_TIMESTAMP()),
                     published_by = :admin
                 WHERE changelog_entry_id = :id"
            );
            $stmt->execute([':admin' => $adminId, ':id' => $entryId]);
        } else {
            $stmt = $db->prepare(
                "UPDATE changelog_entries SET status = 'draft' WHERE changelog_entry_id = :id"
            );
            $stmt->execute([':id' => $entryId]);
        }
        $fetch = $db->prepare('SELECT * FROM changelog_entries WHERE changelog_entry_id = :id LIMIT 1');
        $fetch->execute([':id' => $entryId]);
        $row = $fetch->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'That changelog entry no longer exists.']);
            exit;
        }
        echo json_encode(['success' => true, 'entry' => srp_changelog_present($row, true)]);
        exit;
    }

    if ($action === 'delete') {
        $entryId = normalizeId((string)($data['changelog_entry_id'] ?? ''));
        if ($entryId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'A changelog entry is required.']);
            exit;
        }
        $stmt = $db->prepare('DELETE FROM changelog_entries WHERE changelog_entry_id = :id');
        $stmt->execute([':id' => $entryId]);
        echo json_encode(['success' => true, 'deleted' => $stmt->rowCount() > 0]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown changelog action.']);
} catch (InvalidArgumentException $error) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('[changelog] action failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'The changelog action could not be completed.']);
}
