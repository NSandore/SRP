<?php
// accept_connection.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

if (!isset($input['connection_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing connection_id']);
    exit;
}

$connection_id = normalizeId($input['connection_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("UPDATE connections SET status = 'accepted', accepted_at = NOW() WHERE connection_id = :cid");
    $stmt->execute([':cid' => $connection_id]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Connection not found']);
        exit;
    }

    // Fetch connection participants for notifications
    $connStmt = $db->prepare("SELECT user_id1, user_id2 FROM connections WHERE connection_id = :cid");
    $connStmt->execute([':cid' => $connection_id]);
    $connRow = $connStmt->fetch(PDO::FETCH_ASSOC);
    if ($connRow) {
        $recipient = $connRow['user_id1'];
        $actor = $connRow['user_id2'];
        $notificationId = generateUniqueId($db, 'notifications');
        $refIdForNotif = is_numeric($connection_id) ? $connection_id : null;
        $message = "Your connection request was accepted.";
        $notif = $db->prepare("
            INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
            VALUES (?, ?, ?, 'connection', ?, ?, NOW())
        ");
        $notif->execute([$notificationId, $recipient, $actor, $refIdForNotif, $message]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
