<?php
// send_message.php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
    $data = $_POST;
}

if (!isset($data['sender_id'], $data['recipient_id'], $data['content'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing sender_id, recipient_id, or content']);
    exit;
}

$sender_id = (int)$data['sender_id'];
$recipient_id = (int)$data['recipient_id'];
$content = trim($data['content']);

try {
    $db = getDB();
    // Find existing conversation between these two users
    $stmt = $db->prepare(
        "SELECT conversation_id FROM messages
         WHERE (sender_id = :s AND recipient_id = :r)
            OR (sender_id = :r AND recipient_id = :s)
         ORDER BY message_id LIMIT 1"
    );
    $stmt->execute([':s' => $sender_id, ':r' => $recipient_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $conversation_id = (int)$row['conversation_id'];
    } else {
        // Create a new conversation id
        $stmt = $db->query("SELECT IFNULL(MAX(conversation_id),0)+1 AS next_id FROM messages");
        $conversation_id = (int)$stmt->fetchColumn();
    }

    // Insert the message
    $insert = $db->prepare(
        "INSERT INTO messages
            (sender_id, recipient_id, conversation_id, content, is_read, created_at, updated_at)
         VALUES
            (:sender_id, :recipient_id, :conversation_id, :content, 0, NOW(), NOW())"
    );
    $insert->execute([
        ':sender_id' => $sender_id,
        ':recipient_id' => $recipient_id,
        ':conversation_id' => $conversation_id,
        ':content' => $content,
    ]);

    // Add a notification for the recipient
    $notif = $db->prepare(
        "INSERT INTO notifications
            (recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
         VALUES (?, ?, 'message', ?, 'New message', NOW())"
    );
    $notif->execute([$recipient_id, $sender_id, $conversation_id]);

    echo json_encode(['success' => true, 'conversation_id' => $conversation_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
