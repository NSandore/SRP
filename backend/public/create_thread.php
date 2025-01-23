<?php
session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Check role_id or session
if (!isset($_SESSION['role_id']) || $_SESSION['role_id'] != 3) {
    echo json_encode(['error' => 'You do not have permission to create threads.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$forum_id         = (int)$data['forum_id'];
$user_id          = (int)$data['user_id'];
$title           = trim($data['title'] ?? '');
$firstPostContent = trim($data['firstPostContent'] ?? '');

if ($forum_id <= 0 || $user_id <= 0 || empty($title) || empty($firstPostContent)) {
    echo json_encode(['error' => 'Missing required fields.']);
    exit;
}

try {
    $db = getDB();
    // 1) Insert Thread
    $stmt = $db->prepare("INSERT INTO threads (forum_id, user_id, title) VALUES (:forum_id, :user_id, :title)");
    $stmt->execute([
        ':forum_id' => $forum_id,
        ':user_id'  => $user_id,
        ':title'    => $title
    ]);

    $thread_id = $db->lastInsertId();

    // 2) Insert First Post
    $stmt2 = $db->prepare("INSERT INTO posts (thread_id, user_id, content) VALUES (:thread_id, :user_id, :content)");
    $stmt2->execute([
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $firstPostContent
    ]);

    $post_id = $db->lastInsertId();

    echo json_encode([
        'success'     => true,
        'thread_id'   => $thread_id,
        'post_id'     => $post_id,
        'message'     => 'Thread created successfully (with first post).'
    ]);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
