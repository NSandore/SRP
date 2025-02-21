<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$community_id = intval($_GET['community_id'] ?? 0);
$user_id = intval($_GET['user_id'] ?? 0); // Get user_id if logged in

if ($community_id <= 0) {
    http_response_code(400); // Bad Request
    echo json_encode(["error" => "Invalid community_id"]);
    exit;
}

try {
    $db = getDB();

    // Query to fetch forums with thread count, votes, and the current user's vote, including created_at field
    $stmt = $db->prepare("
        SELECT 
            f.forum_id, 
            f.name, 
            f.description, 
            f.created_at, 
            COUNT(t.thread_id) AS thread_count,
            COALESCE(SUM(CASE WHEN v.vote_type = 'up' THEN 1 ELSE 0 END), 0) AS upvotes,
            COALESCE(SUM(CASE WHEN v.vote_type = 'down' THEN 1 ELSE 0 END), 0) AS downvotes,
            (SELECT vote_type FROM forum_votes WHERE forum_id = f.forum_id AND user_id = :user_id LIMIT 1) AS user_vote
        FROM forums f
        LEFT JOIN threads t ON f.forum_id = t.forum_id
        LEFT JOIN forum_votes v ON f.forum_id = v.forum_id
        WHERE f.community_id = :community_id
        GROUP BY f.forum_id, f.name, f.description, f.created_at
        ORDER BY f.name ASC
    ");
    $stmt->bindParam(':community_id', $community_id, PDO::PARAM_INT);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->execute();

    $forums = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($forums ?: ["message" => "No forums found."]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
