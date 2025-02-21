<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_GET['thread_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'thread_id is required']);
    exit;
}

$thread_id = (int)$_GET['thread_id'];
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0; // Optional user_id for vote tracking
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
            f.name AS forum_name,
            (SELECT vote_type FROM thread_votes WHERE thread_id = t.thread_id AND user_id = :user_id) AS user_vote
        FROM threads t
        JOIN forums f ON t.forum_id = f.forum_id
        WHERE t.thread_id = :thread_id
    ");
    $stmt->execute([':thread_id' => $thread_id, ':user_id' => $user_id]);
    $thread = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($thread) {
        echo json_encode($thread);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Thread not found']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
