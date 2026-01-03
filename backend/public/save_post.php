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
    $saveId = generateUniqueId($db, 'saved_posts');

    $query = "INSERT INTO saved_posts (id, user_id, post_id) VALUES (:id, :user_id, :post_id)
              ON DUPLICATE KEY UPDATE saved_at = CURRENT_TIMESTAMP";
    $stmt = $db->prepare($query);
    $stmt->execute([
      ':id' => $saveId,
      ':user_id' => $user_id,
      ':post_id' => $post_id
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
