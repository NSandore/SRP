<?php
// follow_user.php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}

// Try to decode JSON input; if that fails, fall back to $_POST
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
    $data = $_POST;
}

// Check for required fields
if (!isset($data['followed_user_id']) || $data['followed_user_id'] === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'followed_user_id is required'
    ]);
    exit;
}

// The follower is always the authenticated session's own user, never a
// client-supplied follower_id — otherwise anyone could make another user
// appear to follow someone.
$follower_id = normalizeId($_SESSION['user_id']);
$followed_user_id = normalizeId($data['followed_user_id']);

$db = getDB();
$followId = generateUniqueId($db, 'user_follows');

try {
    $stmt = $db->prepare("INSERT INTO user_follows (id, follower_id, followed_user_id) VALUES (:id, :follower_id, :followed_user_id)");
    $stmt->execute([
        ':id' => $followId,
        ':follower_id'     => $follower_id,
        ':followed_user_id' => $followed_user_id
    ]);
    echo json_encode([
        'success' => true,
        'message' => 'User followed successfully'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database error: ' . $e->getMessage()
    ]);
}
?>
