<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$targetUserId = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : '';
$viewerId = isset($_GET['viewer_id']) ? normalizeId($_GET['viewer_id']) : '';

if ($targetUserId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'user_id is required']);
    exit;
}

$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT
            t.thread_id,
            t.forum_id,
            t.user_id,
            t.title,
            t.created_at,
            t.upvotes,
            t.downvotes,
            COALESCE(tv.vote_type, '') AS user_vote,
            u.first_name,
            u.last_name,
            c.name AS community_name,
            c.community_type,
            c.id AS community_id,
            (SELECT COUNT(p.post_id) FROM posts p WHERE p.thread_id = t.thread_id) AS post_count
        FROM threads t
        INNER JOIN forums f ON t.forum_id = f.forum_id
        INNER JOIN communities c ON f.community_id = c.id
        INNER JOIN users u ON t.user_id = u.user_id
        LEFT JOIN thread_votes tv
               ON tv.thread_id = t.thread_id
              AND tv.user_id = :viewer_id
        WHERE t.user_id = :target_user
        ORDER BY t.created_at DESC
        LIMIT 100
    ");
    $stmt->execute([
        ':target_user' => $targetUserId,
        ':viewer_id' => $viewerId
    ]);
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'threads' => $threads]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
