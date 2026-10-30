<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}

try {
    $db = getDB();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['thread_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input data']);
        exit;
    }
    // The actor is always the authenticated session's own user, never a
    // client-supplied user_id.
    $user_id = normalizeId($_SESSION['user_id']);
    $thread_id = normalizeId($input['thread_id']);

    $query = "DELETE FROM saved_threads WHERE user_id = :user_id AND thread_id = :thread_id";
    $stmt = $db->prepare($query);
    $stmt->execute([
      ':user_id' => $user_id,
      ':thread_id' => $thread_id
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
