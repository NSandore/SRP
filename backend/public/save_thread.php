<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    $db = getDB();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['user_id']) || !isset($input['thread_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input data']);
        exit;
    }
    $user_id = intval($input['user_id']);
    $thread_id = intval($input['thread_id']);

    $query = "INSERT INTO saved_threads (user_id, thread_id) VALUES (:user_id, :thread_id)
              ON DUPLICATE KEY UPDATE saved_at = CURRENT_TIMESTAMP";
    $stmt = $db->prepare($query);
    $stmt->execute([
      ':user_id' => $user_id,
      ':thread_id' => $thread_id
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
