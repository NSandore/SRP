<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    // Mark notifications read rather than deleting them, so history,
    // multi-device sync, and future unread counts stay accurate.
    $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ? AND is_read = 0");
    $stmt->execute([$user_id]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>
