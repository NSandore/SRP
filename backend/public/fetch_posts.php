<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

// Validate that thread_id is provided
if (!isset($_GET['thread_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'thread_id is required']);
    exit;
}

$thread_id = (int)$_GET['thread_id'];

// Retrieve user_id from query params if provided
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

$db = getDB();

try {
    // We'll left join post_votes to get a per-post user_vote
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
            v.vote_type AS user_vote
        FROM posts p
        LEFT JOIN post_votes v
               ON p.post_id = v.post_id
              AND v.user_id = :user_id
        WHERE p.thread_id = :thread_id
        ORDER BY p.created_at ASC
    ");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id
    ]);
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($posts);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
