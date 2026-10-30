<?php
// send_message.php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/sanitize.php';
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
$content = srp_sanitize_html(trim($data['content']));

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id']);
if ($sessionUserId !== $sender_id) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Cannot send as another user']);
    exit;
}

try {
    $db = getDB();

    if ($sender_id !== $recipient_id) {
        $settingsStmt = $db->prepare("
            SELECT JSON_UNQUOTE(JSON_EXTRACT(extras, '$.allow_messages_from')) AS allow_messages_from
            FROM account_settings
            WHERE user_id = :uid
            LIMIT 1
        ");
        $settingsStmt->execute([':uid' => $recipient_id]);
        $allowMessagesFrom = $settingsStmt->fetchColumn() ?: 'everyone';

        $allowMessagesFrom = strtolower(trim((string)$allowMessagesFrom));
        if ($allowMessagesFrom !== 'everyone') {
            $isConnected = false;
            $connectionStmt = $db->prepare("
                SELECT COUNT(*) FROM connections
                WHERE ((user_id1 = :sender AND user_id2 = :recipient)
                   OR (user_id1 = :recipient AND user_id2 = :sender))
                  AND status = 'accepted'
            ");
            $connectionStmt->execute([
                ':sender' => $sender_id,
                ':recipient' => $recipient_id,
            ]);
            $isConnected = ((int)$connectionStmt->fetchColumn()) > 0;

            $sharesCommunity = false;
            if ($allowMessagesFrom === 'community' && !$isConnected) {
                $communityStmt = $db->prepare("
                    SELECT
                        s.recent_university_id AS sender_university,
                        r.recent_university_id AS recipient_university
                    FROM users s
                    JOIN users r ON r.user_id = :recipient
                    WHERE s.user_id = :sender
                    LIMIT 1
                ");
                $communityStmt->execute([
                    ':sender' => $sender_id,
                    ':recipient' => $recipient_id,
                ]);
                $row = $communityStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $senderUniversity = $row['sender_university'] ?? null;
                $recipientUniversity = $row['recipient_university'] ?? null;
                $sharesCommunity = $senderUniversity && $recipientUniversity && $senderUniversity === $recipientUniversity;
            }

            if (
                ($allowMessagesFrom === 'connections' && !$isConnected) ||
                ($allowMessagesFrom === 'community' && !$isConnected && !$sharesCommunity)
            ) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Recipient does not allow messages.']);
                exit;
            }
        }
    }

    // Find existing conversation between these two users
    $stmt = $db->prepare(
        "SELECT conversation_id FROM messages
         WHERE (sender_id = :s AND recipient_id = :r)
            OR (sender_id = :r AND recipient_id = :s)
         ORDER BY message_id LIMIT 1"
    );
    $stmt->execute([':s' => $sender_id, ':r' => $recipient_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row && !empty($row['conversation_id'])) {
        $conversation_id = (int)$row['conversation_id'];
    } else {
        // Generate a numeric conversation_id (int) since the column is int
        $nextStmt = $db->prepare("SELECT IFNULL(MAX(conversation_id), 0) + 1 AS next_id FROM messages");
        $nextStmt->execute();
        $conversation_id = (int)$nextStmt->fetchColumn();
        if ($conversation_id <= 0) {
            $conversation_id = 1;
        }
    }

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
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
