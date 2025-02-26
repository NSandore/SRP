<?php
// fetch_feed.php

session_start();
header('Content-Type: application/json');
require_once '../db_connection.php';

if (!isset($_GET['user_id'])) {
    echo json_encode(["success" => false, "error" => "Missing user_id"]);
    exit;
}

$user_id = intval($_GET['user_id']);

try {
    $db = getDB();

    $query = "
        SELECT 
          t.*, 
          COALESCE(tv.vote_type, '') AS user_vote,
          u.first_name, 
          u.last_name,
          c.name AS community_name,
          c.community_type,
          c.id AS community_id
        FROM threads t
        LEFT JOIN thread_votes tv 
          ON t.thread_id = tv.thread_id 
         AND tv.user_id = :user_id
        INNER JOIN forums f 
          ON t.forum_id = f.forum_id
        INNER JOIN communities c 
          ON f.community_id = c.id
        INNER JOIN followed_communities fc 
          ON f.community_id = fc.community_id
        INNER JOIN users u
          ON t.user_id = u.user_id
        WHERE fc.user_id = :user_id
        ORDER BY t.created_at DESC
    ";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->execute();
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "threads" => $threads]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
}
?>
