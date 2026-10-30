<?php

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';
require_once __DIR__ . '/../includes/info_board_translations.php';

header('Content-Type: application/json');

$communityId = normalizeId($_GET['community_id'] ?? '');
$parentThreadId = normalizeId($_GET['parent_thread_id'] ?? '');

if ($communityId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'community_id is required']);
    exit;
}

try {
    $db = getDB();
    $parentClause = $parentThreadId === ''
        ? 't.parent_thread_id IS NULL'
        : 't.parent_thread_id = :parent_thread_id';
    $stmt = $db->prepare("
        SELECT
            t.thread_id,
            t.forum_id,
            t.parent_thread_id,
            t.title,
            t.content_kind,
            t.sort_order,
            t.is_locked,
            t.created_at,
            t.updated_at,
            t.reply_count,
            p.post_id AS article_post_id,
            p.content AS article_content,
            (SELECT COUNT(*) FROM threads child
             WHERE child.parent_thread_id = t.thread_id AND child.is_hidden = 0) AS child_count
        FROM forums f
        JOIN threads t ON t.forum_id = f.forum_id
        LEFT JOIN posts p
          ON p.post_id = (
              SELECT p0.post_id
              FROM posts p0
              WHERE p0.thread_id = t.thread_id
                AND p0.reply_to IS NULL
                AND p0.is_hidden = 0
              ORDER BY p0.created_at ASC, p0.post_id ASC
              LIMIT 1
          )
        WHERE f.community_id = :community_id
          AND f.is_system_container = 1
          AND t.is_hidden = 0
          AND {$parentClause}
        ORDER BY t.sort_order ASC, t.created_at ASC, t.thread_id ASC
    ");
    $params = [':community_id' => $communityId];
    if ($parentThreadId !== '') {
        $params[':parent_thread_id'] = $parentThreadId;
    }
    $stmt->execute($params);
    $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $nodes = srp_attach_tags_to_threads($db, $nodes);

    if ($nodes && srp_is_info_board_community($communityId)) {
        $nodes = srp_translate_info_board_rows($db, $nodes, 'thread', 'thread_id', ['title']);
        $nodes = srp_translate_info_board_rows($db, $nodes, 'post', 'article_post_id', ['article_content']);
    }

    foreach ($nodes as &$node) {
        $plain = trim(preg_replace(
            '/\s+/',
            ' ',
            html_entity_decode(strip_tags((string)($node['article_content'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8')
        ));
        $length = function_exists('mb_strlen') ? mb_strlen($plain) : strlen($plain);
        $excerpt = function_exists('mb_substr') ? mb_substr($plain, 0, 220) : substr($plain, 0, 220);
        $node['excerpt'] = $excerpt . ($length > 220 ? '…' : '');
        $node['child_count'] = (int)$node['child_count'];
        $node['reply_count'] = (int)$node['reply_count'];
        $node['is_locked'] = (bool)$node['is_locked'];
        unset($node['article_content'], $node['original_article_content']);
    }
    unset($node);

    echo json_encode([
        'success' => true,
        'community_id' => $communityId,
        'parent_thread_id' => $parentThreadId ?: null,
        'nodes' => $nodes,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
