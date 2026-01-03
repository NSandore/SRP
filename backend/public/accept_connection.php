<?php
// accept_connection.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$connection_id = isset($input['connection_id']) ? normalizeId($input['connection_id']) : '';
$user_id1 = isset($input['user_id1']) ? normalizeId($input['user_id1']) : '';
$user_id2 = isset($input['user_id2']) ? normalizeId($input['user_id2']) : '';

if ($connection_id === '' && ($user_id1 === '' || $user_id2 === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing connection_id or user pair']);
    exit;
}

try {
    $db = getDB();
    // Resolve the connection row either by ID or by the user pair (pending request)
    $connStmt = $db->prepare("
        SELECT connection_id, user_id1, user_id2, status
        FROM connections
        WHERE 
            (connection_id = :cid AND :cid <> '')
            OR (
                :cid = '' 
                AND status = 'pending'
                AND ((user_id1 = :u1 AND user_id2 = :u2) OR (user_id1 = :u2 AND user_id2 = :u1))
            )
        LIMIT 1
    ");
    $connStmt->execute([
        ':cid' => $connection_id,
        ':u1'  => $user_id1,
        ':u2'  => $user_id2,
    ]);
    $connRow = $connStmt->fetch(PDO::FETCH_ASSOC);

    if (!$connRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Connection not found']);
        exit;
    }

    $resolvedConnectionId = $connRow['connection_id'];
    $recipient = $connRow['user_id1']; // original requester
    $actor = $connRow['user_id2'];     // recipient of the request (now accepting)

    $update = $db->prepare("UPDATE connections SET status = 'accepted', accepted_at = NOW() WHERE connection_id = :cid");
    $update->execute([':cid' => $resolvedConnectionId]);

    // Create a notification for the requester
    $notificationId = generateUniqueId($db, 'notifications');
    $message = "Your connection request was accepted.";
    // Keep type short to fit existing column sizes
    // Reuse the short type used for connection requests to fit column constraints
    $notificationType = 'connection';
    $refIdForNotif = is_numeric($resolvedConnectionId) ? (int)$resolvedConnectionId : null;
    $notif = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $notif->bindValue(1, $notificationId);
    $notif->bindValue(2, $recipient);
    $notif->bindValue(3, $actor);
    $notif->bindValue(4, $notificationType);
    if ($refIdForNotif === null) {
        $notif->bindValue(5, null, PDO::PARAM_NULL);
    } else {
        $notif->bindValue(5, $refIdForNotif, PDO::PARAM_INT);
    }
    $notif->bindValue(6, $message);
    $notif->execute();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
