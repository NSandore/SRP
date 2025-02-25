<?php
// fetch_following_status.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['follower_id']) || !isset($_GET['followed_user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing follower_id or followed_user_id']);
    exit;
}

$follower_id = (int)$_GET['follower_id'];
$followed_user_id = (int)$_GET['followed_user_id'];

try {
    $db = getDB();
    $query = "SELECT COUNT(*) FROM user_follows WHERE follower_id = :follower_id AND followed_user_id = :followed_user_id";
    $stmt = $db->prepare($query);
    $stmt->execute([':follower_id' => $follower_id, ':followed_user_id' => $followed_user_id]);

    $isFollowing = $stmt->fetchColumn() > 0;
    echo json_encode(['success' => true, 'isFollowing' => $isFollowing]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
