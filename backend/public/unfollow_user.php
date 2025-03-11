<?php
// unfollow_user.php

// Enable error reporting for development (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include your database connection function
require_once __DIR__ . '/../db_connection.php';

// Decode JSON input from the request body
$data = json_decode(file_get_contents("php://input"), true);

// Check that both follower_id and followed_user_id are provided
if (!isset($data['follower_id']) || !isset($data['followed_user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'follower_id and followed_user_id are required']);
    exit;
}

$follower_id = (int)$data['follower_id'];
$followed_user_id = (int)$data['followed_user_id'];

if ($follower_id <= 0 || $followed_user_id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid follower_id or followed_user_id']);
    exit;
}

try {
    $db = getDB();

    // Prepare and execute the DELETE statement to remove the follow relationship
    $stmt = $db->prepare("DELETE FROM user_follows WHERE follower_id = :follower_id AND followed_user_id = :followed_user_id");
    $stmt->execute([
        ':follower_id' => $follower_id,
        ':followed_user_id' => $followed_user_id
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true]);
    } else {
        // If no rows were deleted, the follow relationship didn't exist.
        echo json_encode(['success' => false, 'error' => 'Follow relationship not found']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
    exit;
}
