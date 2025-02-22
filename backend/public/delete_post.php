<?php
session_start(); // To access session variables (like user_id, role_id)

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1. Check if user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to delete a post.']);
    exit;
}

$user_id_session = (int) $_SESSION['user_id'];
$role_id_session = (int) $_SESSION['role_id'];

// 2. Parse JSON input from the client
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['post_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'post_id is required.']);
    exit;
}

$post_id = (int) $data['post_id'];

// 3. Validate post_id
if ($post_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid post_id.']);
    exit;
}

// 4. Connect to the database
try {
    $db = getDB();

    // 5. Fetch the post to verify ownership or role
    $stmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = :post_id");
    $stmt->execute([':post_id' => $post_id]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$post) {
        // Post not found
        http_response_code(404);
        echo json_encode(['error' => 'Post not found.']);
        exit;
    }

    // 6. Check if session user is post owner OR role_id=7
    if ($role_id_session !== 7 && $post['user_id'] != $user_id_session) {
        // No permission
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'You do not have permission to delete this post.']);
        exit;
    }

    // 7. If allowed, delete the post
    $del = $db->prepare("DELETE FROM posts WHERE post_id = :post_id");
    $del->execute([':post_id' => $post_id]);

    if ($del->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Post deleted successfully.']);
    } else {
        // Could happen if the row was already deleted
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete the post.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
