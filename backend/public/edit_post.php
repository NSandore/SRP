<?php
// -------------------------------------------------------------
// edit_post.php
// -------------------------------------------------------------
//
// Description:
// Handles editing of posts (including replies). Sanitizes
// user input using HTMLPurifier and updates the database.
// -------------------------------------------------------------

require_once __DIR__ . '/../session_bootstrap.php';

startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/sanitize.php';
require_once __DIR__ . '/../includes/content_limits.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'You must be logged in to edit a post.']);
    exit;
}

$user_id_session = normalizeId($_SESSION['user_id']);
$role_id_session = (int) $_SESSION['role_id'];

$data = json_decode(file_get_contents('php://input'), true);

$post_id = isset($data['post_id']) ? normalizeId($data['post_id']) : '';
$new_content = isset($data['content']) ? trim($data['content']) : '';

if ($post_id === '' || $new_content === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid post_id or content.']);
    exit;
}

$clean_html = srp_sanitize_html($new_content);
if (srp_post_exceeds_limit($clean_html)) {
    http_response_code(400);
    echo json_encode(['error' => 'Posts must be 10,000 characters or fewer.']);
    exit;
}

try {
    $db = getDB();

    // Resolve the community that owns this post so moderation is scoped
    // correctly (an ambassador of one community must not edit posts in another).
    $stmt = $db->prepare("
        SELECT p.user_id, f.community_id
        FROM posts p
        JOIN threads t ON t.thread_id = p.thread_id
        JOIN forums f ON f.forum_id = t.forum_id
        WHERE p.post_id = :post_id
        LIMIT 1
    ");
    $stmt->execute([':post_id' => $post_id]);
    $postRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$postRow) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found.']);
        exit;
    }

    $isOwner = normalizeId($postRow['user_id']) === $user_id_session;
    $communityId = normalizeId($postRow['community_id'] ?? '');
    if (!$isOwner && !canModerateCommunityContent($user_id_session, $role_id_session, $communityId, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to edit this post.']);
        exit;
    }

    $update = $db->prepare("
        UPDATE posts
        SET content = :content, updated_at = NOW(), updated_by = :updated_by
        WHERE post_id = :post_id
    ");
    $update->execute([
        ':content' => $clean_html,
        ':updated_by' => $user_id_session,
        ':post_id' => $post_id
    ]);

    if ($update->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Post updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'No changes made to the post.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ']);
}
?>
