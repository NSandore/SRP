<?php
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

$db = getDB();

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['forum_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input data']);
    exit;
}

// The actor is always the authenticated session's own user, never a
// client-supplied user_id.
$user_id = normalizeId($_SESSION['user_id']);
$forum_id = normalizeId($input['forum_id']);

$query = "DELETE FROM saved_forums WHERE user_id = :user_id AND forum_id = :forum_id";
$stmt = $db->prepare($query);
if ($stmt->execute([':user_id' => $user_id, ':forum_id' => $forum_id])) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not unsave forum.']);
}
?>
