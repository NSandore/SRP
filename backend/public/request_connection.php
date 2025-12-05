<?php
// request_connection.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

if (empty($input['user_id1']) || empty($input['user_id2'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id1 or user_id2']);
    exit;
}

$user_id1 = normalizeId($input['user_id1']);
$user_id2 = normalizeId($input['user_id2']);

if ($user_id1 === '' || $user_id2 === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id1 or user_id2']);
    exit;
}

try {
    $db = getDB();

    // Check for existing connection
    $check = $db->prepare("SELECT status FROM connections WHERE (user_id1 = :u1 AND user_id2 = :u2) OR (user_id1 = :u2 AND user_id2 = :u1)");
    $check->execute([':u1' => $user_id1, ':u2' => $user_id2]);
    if ($check->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Connection already exists']);
        exit;
    }

    // Insert connection request
    $connection_id = generateUniqueId($db, 'connections');
    $stmt = $db->prepare("INSERT INTO connections (connection_id, user_id1, user_id2, status, requested_at) VALUES (:cid, :u1, :u2, 'pending', NOW())");
    $stmt->execute([':cid' => $connection_id, ':u1' => $user_id1, ':u2' => $user_id2]);

    // Fetch sender name for notification message
    $sstmt = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = ?");
    $sstmt->execute([$user_id1]);
    $sender = $sstmt->fetch(PDO::FETCH_ASSOC);
    $senderName = $sender ? $sender['first_name'] . ' ' . substr($sender['last_name'], 0, 1) . '.' : 'Someone';
    $message = "$senderName sent you a <a href='/user/$user_id1'>connection request</a>.";

    // Notification
    $notificationId = generateUniqueId($db, 'notifications');
    $refIdForNotif = is_numeric($connection_id) ? $connection_id : null;
    $notif = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
        VALUES (?, ?, ?, 'connection', ?, ?, NOW())
    ");
    $notif->execute([$notificationId, $user_id2, $user_id1, $refIdForNotif, $message]);

    echo json_encode(['success' => true, 'connection_id' => $connection_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
