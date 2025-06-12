<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['conversation_id']) || !isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'conversation_id and user_id are required']);
    exit;
}

$conversation_id = (int)$_GET['conversation_id'];
$user_id = (int)$_GET['user_id'];

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT message_id, sender_id, recipient_id, content, is_read, created_at FROM messages WHERE conversation_id = :cid ORDER BY created_at ASC");
    $stmt->execute([':cid' => $conversation_id]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Mark messages addressed to this user as read
    $update = $db->prepare("UPDATE messages SET is_read = 1 WHERE conversation_id = :cid AND recipient_id = :uid");
    $update->execute([':cid' => $conversation_id, ':uid' => $user_id]);

    echo json_encode(['success' => true, 'messages' => $messages]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
