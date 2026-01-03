<?php
session_start();
require_once __DIR__ . '/../db_connection.php';  // Adjust path if needed

header('Content-Type: application/json');

/**
 * 1) Check if the user is allowed to reply
 */
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); 
    echo json_encode(['error' => 'You must be logged in to reply.']);
    exit;
}

/**
 * 2) Parse JSON input
 */
$data = json_decode(file_get_contents('php://input'), true);
$thread_id = isset($data['thread_id']) ? normalizeId($data['thread_id']) : '';
$user_id   = isset($data['user_id']) ? normalizeId($data['user_id']) : '';
$content   = trim($data['content']    ?? '');
$reply_to  = isset($data['reply_to']) ? normalizeId($data['reply_to']) : null;

/**
 * 3) Validate input
 */
if (empty($thread_id) || empty($user_id) || empty($content)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data for creating a reply (thread_id, user_id, content required).']);
    exit;
}

// Ensure user is replying as themselves
if ($user_id !== normalizeId($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot reply as another user.']);
    exit;
}

/**
 * 4) Insert reply into the database
 */
try {
    $db = getDB();
    $post_id = generateUniqueId($db, 'posts');

    // Insert the reply into the posts table
    $stmt = $db->prepare("
        INSERT INTO posts (post_id, thread_id, user_id, content, reply_to)
        VALUES (:post_id, :thread_id, :user_id, :content, :reply_to)
    ");
    $stmt->execute([
        ':post_id' => $post_id,
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $content,
        ':reply_to'  => $reply_to
    ]);

    /**
     * 5) Send a notification to the original post owner
     */
    if ($reply_to) {
        // Fetch the original post's owner
        $stmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = ?");
        $stmt->execute([$reply_to]);
        $post = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($post) {
            $original_poster_id = $post['user_id'];

            // Prevent notifying self-replies
            if ($original_poster_id != $user_id) {
                // Fetch replier's name for the notification message
                $stmt2 = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = ?");
                $stmt2->execute([$user_id]);
                $replier = $stmt2->fetch(PDO::FETCH_ASSOC);

                $replier_name = $replier['first_name'] . ' ' . substr($replier['last_name'], 0, 1) . '.';
                $message = "$replier_name replied to your post.";

                // Insert the notification (reference_id is nullable/int, so leave NULL for string post IDs)
                $notificationId = generateUniqueId($db, 'notifications');
                $insertStmt = $db->prepare("
                    INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
                    VALUES (?, ?, ?, 'reply', NULL, ?)
                ");
                $insertStmt->execute([$notificationId, $original_poster_id, $user_id, $message]);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'post_id' => $post_id,
        'message' => 'Reply created successfully.'
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
