<?php
// delete_notification.php
// Deletes a single notification for the logged-in recipient.

session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$notification_id = isset($input['notification_id']) ? normalizeId($input['notification_id']) : '';
$user_id = normalizeId($_SESSION['user_id']);

if ($notification_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing notification_id']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM notifications WHERE notification_id = :nid AND recipient_user_id = :uid");
    $stmt->execute([
        ':nid' => $notification_id,
        ':uid' => $user_id,
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
