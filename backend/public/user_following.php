<?php
// user_following.php

header('Content-Type: application/json');

// Include your database connection file
require_once '../db_connection.php';

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing user_id"]);
    exit;
}

$user_id = intval($_GET['user_id']);

// Query: Get details of users that the given user_id is following
$query = "SELECT u.user_id, u.first_name, u.last_name, u.avatar_path 
          FROM user_follows uf 
          JOIN users u ON uf.followed_user_id = u.user_id 
          WHERE uf.follower_id = ?";
$stmt = $db->prepare($query);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$following = [];
while ($row = $result->fetch_assoc()) {
    $following[] = $row;
}

echo json_encode($following);
?>
