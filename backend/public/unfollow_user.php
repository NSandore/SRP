<?php
// unfollow_user.php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

header('Content-Type: application/json');

// Include your database connection function
require_once __DIR__ . '/../db_connection.php';

if (srp_is_dev_mode()) {
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}

// Decode JSON input from the request body
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['followed_user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'followed_user_id is required']);
    exit;
}

// The follower is always the authenticated session's own user, never a
// client-supplied follower_id.
$follower_id = normalizeId($_SESSION['user_id']);
$followed_user_id = normalizeId($data['followed_user_id']);

if ($followed_user_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid followed_user_id']);
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
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ']);
    exit;
}
