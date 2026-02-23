<?php
// add_reply_notification.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

// Try to parse JSON input first.
$input = json_decode(file_get_contents('php://input'), true);

// If JSON was provided, use it; otherwise, fallback to $_POST.
if ($input && is_array($input)) {
    $post_id = isset($input['post_id']) ? normalizeId($input['post_id']) : null;
    $replier_id = isset($input['replier_id']) ? normalizeId($input['replier_id']) : null;
} else {
    $post_id = isset($_POST['post_id']) ? normalizeId($_POST['post_id']) : null;
    $replier_id = isset($_POST['replier_id']) ? normalizeId($_POST['replier_id']) : null;
}

if (!$post_id || !$replier_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing post_id or replier_id']);
    exit;
}

try {
    $db = getDB();

    // Get the post owner's user_id
    $stmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = ?");
    $stmt->execute([$post_id]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$post) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Post not found']);
        exit;
    }

    $post_owner_id = $post['user_id'];

    // Prevent self-notification (if the user is replying to their own post)
    if ($post_owner_id == $replier_id) {
        echo json_encode(['success' => true, 'message' => 'No notification for self-reply']);
        exit;
    }

    // Check recipient preference for reply notifications
    $prefStmt = $db->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(extras, '$.notify_replies')) AS notify_replies FROM account_settings WHERE user_id = :rid");
    $prefStmt->execute([':rid' => $post_owner_id]);
    $prefRow = $prefStmt->fetch(PDO::FETCH_ASSOC);
    $notifyPref = isset($prefRow['notify_replies']) ? (int)$prefRow['notify_replies'] : 1;
    if ($notifyPref !== 1) {
        echo json_encode(['success' => true, 'message' => 'Recipient disabled reply notifications']);
        exit;
    }

    // Get the replier's name
    $stmt2 = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = ?");
    $stmt2->execute([$replier_id]);
    $replier = $stmt2->fetch(PDO::FETCH_ASSOC);

    if (!$replier) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Replier not found']);
        exit;
    }

    // Format the replier's name (e.g. "Alice S.")
    $replier_name = $replier['first_name'] . ' ' . substr($replier['last_name'], 0, 1) . '.';
    $threadStmt = $db->prepare("
        SELECT t.thread_id, t.forum_id
        FROM posts p
        JOIN threads t ON t.thread_id = p.thread_id
        WHERE p.post_id = :post_id
        LIMIT 1
    ");
    $threadStmt->execute([':post_id' => $post_id]);
    $target = $threadStmt->fetch(PDO::FETCH_ASSOC);
    $postPath = $target
        ? "/info/forum/{$target['forum_id']}/thread/{$target['thread_id']}#post-{$post_id}"
        : null;
    $message = $postPath
        ? "$replier_name replied to your <a href=\"{$postPath}\">post</a>."
        : "$replier_name replied to your post.";

    // Insert the notification into the notifications table
    $notificationId = generateUniqueId($db, 'notifications');
    $insertStmt = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
        VALUES (?, ?, ?, 'reply', NULL, ?)
    ");
    $result = $insertStmt->execute([$notificationId, $post_owner_id, $replier_id, $message]);

    if ($result) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to insert notification']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
