<?php
// send_message.php
require_once __DIR__ . '/cors.php';
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

$sender_id = normalizeId($data['sender_id']);
$recipient_id = normalizeId($data['recipient_id']);
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

    $conversation_id = $row && !empty($row['conversation_id'])
        ? $row['conversation_id']
        : 'c' . bin2hex(random_bytes(8));

    // Insert the message
    $message_id = generateUniqueId($db, 'messages');
    $insert = $db->prepare(
        "INSERT INTO messages
            (message_id, sender_id, recipient_id, conversation_id, content, is_read, created_at, updated_at)
         VALUES
            (:message_id, :sender_id, :recipient_id, :conversation_id, :content, 0, NOW(), NOW())"
    );
    $insert->execute([
        ':message_id' => $message_id,
        ':sender_id' => $sender_id,
        ':recipient_id' => $recipient_id,
        ':conversation_id' => $conversation_id,
        ':content' => $content,
    ]);

    echo json_encode(['success' => true, 'conversation_id' => $conversation_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
