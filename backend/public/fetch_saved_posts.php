<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

try {
    $db = getDB();

    if (!isset($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing user_id']);
        exit;
    }

    $user_id = normalizeId($_GET['user_id']);

    $query = "SELECT sp.post_id,
                     p.content,
                     p.verified,
                     p.thread_id,
                     t.forum_id,
                     f.name AS forum_name,
                     t.title AS thread_title,
                     COALESCE(root_post.content, p.content) AS original_post_content,
                     sp.saved_at
              FROM saved_posts sp
              JOIN posts p ON sp.post_id = p.post_id
              LEFT JOIN threads t ON p.thread_id = t.thread_id
              LEFT JOIN forums f ON t.forum_id = f.forum_id
              LEFT JOIN posts root_post ON root_post.post_id = (
                SELECT p2.post_id
                FROM posts p2
                WHERE p2.thread_id = p.thread_id
                  AND (p2.reply_to IS NULL OR p2.reply_to = '')
                ORDER BY p2.created_at ASC
                LIMIT 1
              )
              WHERE sp.user_id = :user_id
              ORDER BY sp.saved_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $savedPosts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'saved_posts' => $savedPosts]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
