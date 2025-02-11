<?php
session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = (int)$_SESSION['user_id'];

try {
    $db = getDB();

    $stmt = $db->prepare("
        SELECT notification_id, notification_type, message, is_read, created_at
        FROM notifications
        WHERE recipient_user_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->execute([$user_id]);
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'notifications' => $notifications]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
