<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    $db = getDB();

    if (!isset($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing user_id']);
        exit;
    }

    $user_id = intval($_GET['user_id']);

    $query = "SELECT sp.post_id, p.content, sp.saved_at
              FROM saved_posts sp
              JOIN posts p ON sp.post_id = p.post_id
              WHERE sp.user_id = :user_id
              ORDER BY sp.saved_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $savedPosts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'saved_posts' => $savedPosts]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
