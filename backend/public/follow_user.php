<?php
// follow_user.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

// Try to decode JSON input; if that fails, fall back to $_POST
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
    $data = $_POST;
}

// Check for required fields
if (
    !isset($data['follower_id']) || $data['follower_id'] === '' ||
    !isset($data['followed_user_id']) || $data['followed_user_id'] === ''
) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'follower_id and followed_user_id are required'
    ]);
    exit;
}

$follower_id = normalizeId($data['follower_id']);
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
