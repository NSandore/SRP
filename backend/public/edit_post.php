<?php
// -------------------------------------------------------------
// edit_post.php
// -------------------------------------------------------------
//
// Description:
// Handles editing of posts (including replies). Sanitizes
// user input using HTMLPurifier and updates the database.
// -------------------------------------------------------------

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

session_start();

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../vendor/autoload.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'You must be logged in to edit a post.']);
    exit;
}

$user_id_session = normalizeId($_SESSION['user_id']);
$role_id_session = (int) $_SESSION['role_id'];
$is_ambassador = isset($_SESSION['is_ambassador']) && (int) $_SESSION['is_ambassador'] === 1;

$data = json_decode(file_get_contents('php://input'), true);

$post_id = isset($data['post_id']) ? normalizeId($data['post_id']) : '';
$new_content = isset($data['content']) ? trim($data['content']) : '';

if ($post_id === '' || $new_content === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid post_id or content.']);
    exit;
}

try {
    $db = getDB();

    $stmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = :post_id");
    $stmt->execute([':post_id' => $post_id]);
    $postRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$postRow) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found.']);
        exit;
    }

    if ($role_id_session !== 1 && !$is_ambassador && $postRow['user_id'] !== $user_id_session) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to edit this post.']);
        exit;
    }

    $config = HTMLPurifier_Config::createDefault();
    $cacheDir = __DIR__ . '/../htmlpurifier-cache';
    if (!file_exists($cacheDir) && !mkdir($cacheDir, 0755, true)) {
        throw new Exception('Failed to create HTMLPurifier cache directory.');
    }
    $config->set('Cache.SerializerPath', $cacheDir);
    $purifier = new HTMLPurifier($config);

    $clean_html = $purifier->purify($new_content);

    $update = $db->prepare("
        UPDATE posts
        SET content = :content, updated_at = NOW()
        WHERE post_id = :post_id
    ");
    $update->execute([
        ':content' => $clean_html,
        ':post_id' => $post_id
    ]);

    if ($update->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Post updated successfully.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'No changes made to the post.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
?>
