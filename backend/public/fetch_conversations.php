<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'user_id is required']);
    exit;
}
$user_id = (int)$_GET['user_id'];

try {
    $db = getDB();
    $query = "
        SELECT m.conversation_id,
               CASE WHEN m.sender_id = :uid THEN m.recipient_id ELSE m.sender_id END AS other_user_id,
               u.first_name, u.last_name, u.avatar_path,
               m.content AS last_message,
               m.created_at AS last_date,
               (
                   SELECT COUNT(*) FROM messages
                   WHERE conversation_id = m.conversation_id
                     AND recipient_id = :uid AND is_read = 0
               ) AS unread_count
        FROM messages m
        JOIN (
            SELECT conversation_id, MAX(created_at) AS max_date
            FROM messages
            WHERE sender_id = :uid OR recipient_id = :uid
            GROUP BY conversation_id
        ) t ON m.conversation_id = t.conversation_id AND m.created_at = t.max_date
        JOIN users u ON u.user_id = CASE WHEN m.sender_id = :uid THEN m.recipient_id ELSE m.sender_id END
        ORDER BY m.created_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute([':uid' => $user_id]);
    $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'conversations' => $conversations]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
