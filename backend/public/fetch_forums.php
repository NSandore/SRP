<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$community_id = isset($_GET['community_id']) ? normalizeId($_GET['community_id']) : '';
$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : ''; // Get user_id if logged in

if ($community_id === '') {
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
            (SELECT COUNT(*) FROM forum_votes WHERE forum_id = f.forum_id AND vote_type = 'up') AS upvotes,
            (SELECT COUNT(*) FROM forum_votes WHERE forum_id = f.forum_id AND vote_type = 'down') AS downvotes,
            (SELECT vote_type FROM forum_votes WHERE forum_id = f.forum_id AND user_id = :user_id LIMIT 1) AS user_vote
        FROM forums f
        LEFT JOIN threads t ON f.forum_id = t.forum_id
        WHERE f.community_id = :community_id
          AND f.is_hidden = 0
        GROUP BY f.forum_id, f.name, f.description, f.created_at
        ORDER BY f.name ASC
    ");
    $stmt->bindParam(':community_id', $community_id, PDO::PARAM_STR);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_STR);
    $stmt->execute();

    $forums = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($forums ?: ["message" => "No forums found."]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
