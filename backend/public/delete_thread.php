<?php
session_start();

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1. Check user session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to delete a thread.']);
    exit;
}

$user_id_session = (int) $_SESSION['user_id'];
$role_id_session = (int) $_SESSION['role_id'];

// 2. Decode JSON input (e.g. { "thread_id": 123 })
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['thread_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'thread_id is required.']);
    exit;
}

$thread_id = (int) $data['thread_id'];

if ($thread_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid thread_id.']);
    exit;
}

// 3. Connect to DB and fetch thread info
try {
    $db = getDB();

    // Attempt to find the thread
    $stmt = $db->prepare("SELECT user_id FROM threads WHERE thread_id = :thread_id");
    $stmt->bindValue(':thread_id', $thread_id, PDO::PARAM_INT);
    $stmt->execute();
    $thread = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$thread) {
        // Thread not found
        http_response_code(404);
        echo json_encode(['error' => 'Thread not found.']);
        exit;
    }

    // 4. Check if session user is thread owner OR role_id = 1
    $thread_owner_id = (int) $thread['user_id'];

    if ($role_id_session !== 1 && $thread_owner_id !== $user_id_session) {
        // No permission
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'You do not have permission to delete this thread.']);
        exit;
    }

    // 5. If allowed, delete the thread
    //    (You may want to also delete associated posts or rely on foreign keys with ON DELETE CASCADE)
    $del = $db->prepare("DELETE FROM threads WHERE thread_id = :thread_id");
    $del->bindValue(':thread_id', $thread_id, PDO::PARAM_INT);
    $del->execute();

    if ($del->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Thread deleted successfully.']);
    } else {
        // Possibly the row was already deleted
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete the thread.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
