<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['conversation_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'conversation_id is required']);
    exit;
}

// The actor is always the authenticated session's own user, never a
// client-supplied user_id.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}
$user_id = normalizeId($_SESSION['user_id']);

$conversation_id = normalizeId($_GET['conversation_id']);
$before_id = isset($_GET['before_id']) ? normalizeId($_GET['before_id']) : null;
$pageSize = 20;

try {
    $db = getDB();

    // A conversation's messages may only be read by one of its two
    // participants — otherwise any authenticated user could pass an
    // arbitrary conversation_id and read (and mark read) someone else's
    // private messages.
    $memberCheck = $db->prepare("
        SELECT 1 FROM messages
        WHERE conversation_id = :cid AND (sender_id = :uid OR recipient_id = :uid)
        LIMIT 1
    ");
    $memberCheck->execute([':cid' => $conversation_id, ':uid' => $user_id]);
    if (!$memberCheck->fetchColumn()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        exit;
    }

    $params = [':cid' => $conversation_id];
    $cutWhere = '';
    if ($before_id) {
        // Get timestamp for before_id
        $metaStmt = $db->prepare("SELECT created_at FROM messages WHERE message_id = :mid AND conversation_id = :cid LIMIT 1");
        $metaStmt->execute([':mid' => $before_id, ':cid' => $conversation_id]);
        $cut = $metaStmt->fetchColumn();
        if ($cut) {
            $cutWhere = "AND (created_at < :cut OR (created_at = :cut AND message_id < :mid))";
            $params[':cut'] = $cut;
            $params[':mid'] = $before_id;
        }
    }

    $stmt = $db->prepare("
        SELECT message_id, sender_id, recipient_id, content, is_read, created_at
        FROM messages
        WHERE conversation_id = :cid
          $cutWhere
        ORDER BY created_at DESC, message_id DESC
        LIMIT $pageSize
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $messages = array_reverse($rows);

    // Mark messages addressed to this user as read
    $update = $db->prepare("UPDATE messages SET is_read = 1 WHERE conversation_id = :cid AND recipient_id = :uid");
    $update->execute([':cid' => $conversation_id, ':uid' => $user_id]);

    // Determine if more remain
    $hasMore = count($rows) === $pageSize;

    echo json_encode(['success' => true, 'messages' => $messages, 'has_more' => $hasMore]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
