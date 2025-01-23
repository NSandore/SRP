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
$db = getDB();

try {
    // Include reply_to in the selected columns
    $stmt = $db->prepare("
        SELECT post_id,
               thread_id,
               user_id,
               content,
               created_at,
               updated_at,
               upvotes,
               downvotes,
               reply_to
        FROM posts
        WHERE thread_id = :thread_id
        ORDER BY created_at ASC
    ");
    $stmt->execute([':thread_id' => $thread_id]);
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($posts);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
