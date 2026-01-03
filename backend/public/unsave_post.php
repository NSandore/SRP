<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    $db = getDB();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['user_id']) || !isset($input['post_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input data']);
        exit;
    }
    $user_id = normalizeId($input['user_id']);
    $post_id = normalizeId($input['post_id']);

    $query = "DELETE FROM saved_posts WHERE user_id = :user_id AND post_id = :post_id";
    $stmt = $db->prepare($query);
    $stmt->execute([
      ':user_id' => $user_id,
      ':post_id' => $post_id
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
