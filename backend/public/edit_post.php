<?php
session_start(); // To access $_SESSION for user info

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1. Check if the user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to edit a post.']);
    exit;
}

$user_id_session = (int)$_SESSION['user_id'];
$role_id_session = (int)$_SESSION['role_id'];

// 2. Decode JSON input from the request
$data = json_decode(file_get_contents('php://input'), true);

$post_id = (int)($data['post_id'] ?? 0);
$new_content = trim($data['content'] ?? '');

// Basic validation
if ($post_id <= 0 || empty($new_content)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid post_id or content.']);
    exit;
}

try {
    $db = getDB();

    // 3. Fetch the post to verify ownership, reply_to status, etc.
    $stmt = $db->prepare("
        SELECT user_id, reply_to 
        FROM posts 
        WHERE post_id = :post_id
    ");
    $stmt->execute([':post_id' => $post_id]);
    $postRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$postRow) {
        // Post not found
        http_response_code(404);
        echo json_encode(['error' => 'Post not found.']);
        exit;
    }

    // 4. Ensure this post is the root post (reply_to should be NULL for the first post)
    //    If you store your root post differently, adapt this check.
    if (!is_null($postRow['reply_to'])) {
        // It's NOT the root post => not allowed to edit
        http_response_code(403);
        echo json_encode(['error' => 'You cannot edit replies—only the original root post.']);
        exit;
    }

    // 5. Check ownership or admin
    if ($role_id_session !== 3 && (int)$postRow['user_id'] !== $user_id_session) {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'You do not have permission to edit this post.']);
        exit;
    }

    // 6. Perform the update (assuming you want to set updated_at too)
    $update = $db->prepare("
        UPDATE posts
        SET content = :content,
            updated_at = NOW()
        WHERE post_id = :post_id
    ");
    $update->execute([
        ':content' => $new_content,
        ':post_id' => $post_id
    ]);

    if ($update->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Post updated successfully.']);
    } else {
        // Possibly no changes if content was the same as before
        echo json_encode(['success' => false, 'message' => 'No changes made to the post.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
