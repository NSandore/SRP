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

$user_id = normalizeId($input['user_id']);
$forum_id = normalizeId($input['forum_id']);
$saveId = generateUniqueId($db, 'saved_forums');

// Insert into saved_forums table (or update timestamp if already exists)
$query = "INSERT INTO saved_forums (id, user_id, forum_id) VALUES (:id, :user_id, :forum_id)
          ON DUPLICATE KEY UPDATE saved_at = CURRENT_TIMESTAMP";
$stmt = $db->prepare($query);
if ($stmt->execute([':id' => $saveId, ':user_id' => $user_id, ':forum_id' => $forum_id])) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not save forum.']);
}
?>
