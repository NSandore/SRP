<?php
header('Content-Type: application/json');
require_once '../db_connection.php';
$db = getDB();

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['user_id']) || !isset($input['forum_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input data']);
    exit;
}

$user_id = intval($input['user_id']);
$forum_id = intval($input['forum_id']);

$query = "DELETE FROM saved_forums WHERE user_id = :user_id AND forum_id = :forum_id";
$stmt = $db->prepare($query);
if ($stmt->execute([':user_id' => $user_id, ':forum_id' => $forum_id])) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not unsave forum.']);
}
?>
