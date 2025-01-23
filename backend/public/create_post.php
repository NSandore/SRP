<?php
session_start();
require_once __DIR__ . '/../db_connection.php'; // Adjust if needed

header('Content-Type: application/json');

// 1. Check if user is logged in (example check)
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); // Forbidden
    echo json_encode(['error' => 'You must be logged in to create a post.']);
    exit;
}

// OPTIONAL: If only users with role_id = 3 can create posts, uncomment:
// if ($_SESSION['role_id'] != 3) {
//     http_response_code(403);
//     echo json_encode(['error' => 'You do not have permission to create posts.']);
//     exit;
// }

// 2. Retrieve JSON input
$data = json_decode(file_get_contents('php://input'), true);

// 3. Extract and validate necessary fields
$thread_id = (int)($data['thread_id'] ?? 0);
$user_id   = (int)($data['user_id']   ?? 0);
$content   = trim($data['content']    ?? '');

if ($thread_id <= 0 || $user_id <= 0 || empty($content)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid data for creating a post.']);
    exit;
}

// OPTIONAL: If user_id must match the session user, you can force it:
// if ($user_id !== (int)$_SESSION['user_id']) {
//     http_response_code(403);
//     echo json_encode(['error' => 'You cannot create a post as another user.']);
//     exit;
// }

try {
    // 4. Get the DB connection
    $db = getDB(); // Must match the same function you use in create_forum.php, etc.

    // 5. Insert a new row into `posts`
    $stmt = $db->prepare("
        INSERT INTO posts (thread_id, user_id, content)
        VALUES (:thread_id, :user_id, :content)
    ");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $content
    ]);

    // 6. Retrieve the newly inserted post_id
    $post_id = $db->lastInsertId();

    // 7. Return success
    echo json_encode([
        'success' => true,
        'post_id' => $post_id,
        'message' => 'Post created successfully.'
    ]);

} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
