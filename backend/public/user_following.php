<?php
// user_following.php

session_start();
header('Content-Type: application/json');

// Include your database connection file
require_once '../db_connection.php';

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing user_id"]);
    exit;
}

$user_id = normalizeId($_GET['user_id']);
$db = getDB();

// Query: Get details of users that the given user_id is following
$query = "SELECT u.user_id, u.first_name, u.last_name, u.avatar_path, u.is_public
          FROM user_follows uf
          JOIN users u ON uf.followed_user_id = u.user_id
          WHERE uf.follower_id = :uid";
$stmt = $db->prepare($query);
$stmt->execute([':uid' => $user_id]);
$result = $stmt->fetchAll(PDO::FETCH_ASSOC);

$following = [];
foreach ($result as $row) {
    if ((int)$row['is_public'] === 0 && (!isset($_SESSION['user_id']) || $_SESSION['user_id'] != $row['user_id'])) {
        $row['last_name'] = substr($row['last_name'], 0, 1) . '.';
    }
    unset($row['is_public']);
    $following[] = $row;
}

echo json_encode($following);
?>
