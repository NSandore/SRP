<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$forum_id = isset($_GET['forum_id']) ? normalizeId($_GET['forum_id']) : '';
if ($forum_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'forum_id is required']);
    exit;
}
// Get the current user's ID if provided; default to empty if not logged in
$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : '';
$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT 
            t.thread_id,
            t.forum_id,
            t.user_id,
            t.title,
            t.created_at,
            -- Count upvotes and downvotes from thread_votes
            (SELECT COUNT(*) FROM thread_votes WHERE thread_id = t.thread_id AND vote_type = 'up') AS upvotes,
            (SELECT COUNT(*) FROM thread_votes WHERE thread_id = t.thread_id AND vote_type = 'down') AS downvotes,
            -- Get the current user's vote on this thread (if any)
            (SELECT vote_type FROM thread_votes WHERE thread_id = t.thread_id AND user_id = :user_id LIMIT 1) AS vote_type,
            COUNT(p.post_id) AS post_count
        FROM threads t
        LEFT JOIN posts p ON t.thread_id = p.thread_id
        WHERE t.forum_id = :forum_id
          AND t.is_hidden = 0
        GROUP BY t.thread_id, t.forum_id, t.user_id, t.title, t.created_at
        ORDER BY t.created_at DESC
    ");
    $stmt->execute([
      ':forum_id' => $forum_id,
      ':user_id' => $user_id
    ]);
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($threads);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
