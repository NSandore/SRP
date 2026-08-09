<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/newsroom.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    srp_ensure_newsroom_table($db);
    $limit = max(1, min(10, (int)($_GET['limit'] ?? 6)));
    $stmt = $db->prepare("
        SELECT
            n.newsroom_item_id,
            n.source_name,
            n.source_url,
            n.source_title,
            n.source_content,
            n.source_published_at,
            n.target_forum_id,
            n.thread_id,
            n.status
        FROM newsroom_items n
        INNER JOIN threads t ON t.thread_id = n.thread_id AND t.is_hidden = 0
        INNER JOIN forums f ON f.forum_id = n.target_forum_id AND f.is_hidden = 0
        WHERE n.status = 'published'
          AND n.thread_id IS NOT NULL
        ORDER BY COALESCE(n.source_published_at, n.published_at) DESC
        LIMIT :row_limit
    ");
    $stmt->bindValue(':row_limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $news = array_map(static function (array $row): array {
        return [
            'id' => (string)$row['newsroom_item_id'],
            'news_id' => (string)$row['newsroom_item_id'],
            'status' => 'published',
            'title' => (string)$row['source_title'],
            'summary' => (string)($row['source_content'] ?? ''),
            'source_name' => (string)$row['source_name'],
            'source_url' => (string)($row['source_url'] ?? ''),
            'published_at' => $row['source_published_at'] ?? null,
            'forum_id' => (string)$row['target_forum_id'],
            'thread_id' => (string)$row['thread_id'],
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    echo json_encode(['success' => true, 'news' => $news]);
} catch (Throwable $e) {
    error_log('[SRP] Fetch public news failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'news' => [], 'error' => 'Unable to load news.']);
}

