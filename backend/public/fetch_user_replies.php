<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$targetUserId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
$viewerId = isset($_GET['viewer_id']) ? (int) $_GET['viewer_id'] : 0;

if ($targetUserId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'user_id is required']);
    exit;
}

$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT
            p.post_id,
            p.thread_id,
            p.user_id,
            p.content,
            p.created_at,
            p.upvotes,
            p.downvotes,
            p.reply_to,
            COALESCE(pv.vote_type, '') AS user_vote,
            t.title AS thread_title,
            t.forum_id,
            u.first_name,
            u.last_name,
            c.name AS community_name,
            c.community_type,
            c.id AS community_id
        FROM posts p
        INNER JOIN threads t ON p.thread_id = t.thread_id
        INNER JOIN forums f ON t.forum_id = f.forum_id
        INNER JOIN communities c ON f.community_id = c.id
        INNER JOIN users u ON p.user_id = u.user_id
        LEFT JOIN post_votes pv
               ON pv.post_id = p.post_id
              AND pv.user_id = :viewer_id
        WHERE p.user_id = :target_user
        ORDER BY p.created_at DESC
        LIMIT 100
    ");
    $stmt->execute([
        ':target_user' => $targetUserId,
        ':viewer_id' => $viewerId
    ]);
    $replies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'replies' => $replies]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
