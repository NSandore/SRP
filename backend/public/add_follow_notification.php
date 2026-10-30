<?php
// add_follow_notification.php

require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if (!isset($_POST['followed_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing follower_id or followed_id']);
    exit;
}

$follower_id = normalizeId($_SESSION['user_id']);
$followed_id = normalizeId($_POST['followed_id']);

try {
    $db = getDB();

    // Fetch follower details to include in the notification message.
    $stmt = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = ?");
    $stmt->execute([$follower_id]);
    $follower = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$follower) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Follower not found']);
        exit;
    }
    $follower_name = $follower['first_name'] . ' ' . substr($follower['last_name'], 0, 1) . '.';
    $message = "$follower_name started following you.";

    // Insert the notification.
    $notificationId = generateUniqueId($db, 'notifications');
    $insertStmt = $db->prepare("INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message) VALUES (?, ?, 'follow', ?, ?, ?)");
    $result = $insertStmt->execute([$notificationId, $followed_id, $follower_id, $follower_id, $message]);

    if ($result) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to insert notification']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
