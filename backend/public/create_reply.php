<?php
session_start();
require_once __DIR__ . '/../db_connection.php';  // Adjust path if needed

header('Content-Type: application/json');

/**
 * 1) Check if the user is allowed to reply
 *    If you want only certain roles, adjust accordingly.
 */
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); 
    echo json_encode(['error' => 'You must be logged in to reply.']);
    exit;
}

// Optional: If only role_id=3 can reply, uncomment:
// if ($_SESSION['role_id'] != 3) {
//   http_response_code(403);
//   echo json_encode(['error' => 'You do not have permission to reply.']);
//   exit;
// }

/**
 * 2) Parse JSON input
 *    Expecting { thread_id, user_id, content, reply_to (optional) }
 */
$data = json_decode(file_get_contents('php://input'), true);
$thread_id = (int)($data['thread_id'] ?? 0);
$user_id   = (int)($data['user_id']   ?? 0);
$content   = trim($data['content']    ?? '');
$reply_to  = isset($data['reply_to']) ? (int)$data['reply_to'] : null;

/**
 * 3) Validate input
 */
if ($thread_id <= 0 || $user_id <= 0 || empty($content)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data for creating a reply (thread_id, user_id, content required).']);
    exit;
}

// If you require that user_id matches the session user, do:
if ($user_id !== (int)$_SESSION['user_id']) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot reply as another user.']);
    exit;
}

/**
 * 4) Insert row into posts with 'reply_to' and 'thread_id'
 */
try {
    $db = getDB();

    $stmt = $db->prepare("
        INSERT INTO posts (thread_id, user_id, content, reply_to)
        VALUES (:thread_id, :user_id, :content, :reply_to)
    ");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $content,
        ':reply_to'  => $reply_to // can be NULL if not replying to a specific post
    ]);

    $post_id = $db->lastInsertId();

    echo json_encode([
        'success' => true,
        'post_id' => $post_id,
        'message' => 'Reply created successfully.'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
