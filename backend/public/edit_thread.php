<?php
session_start();

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1. Check if the user is logged in (has session data)
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to edit a thread.']);
    exit;
}

$user_id_session = (int) $_SESSION['user_id'];
$role_id_session = (int) $_SESSION['role_id'];

// 2. Parse the JSON input
$data = json_decode(file_get_contents('php://input'), true);

$thread_id = (int) ($data['thread_id'] ?? 0);
$new_title = trim($data['new_title'] ?? '');

// Basic validation
if ($thread_id <= 0 || empty($new_title)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid thread_id or title.']);
    exit;
}

try {
    $db = getDB();

    // 3. Fetch the thread to see who owns it
    $stmt = $db->prepare("SELECT user_id FROM threads WHERE thread_id = :thread_id");
    $stmt->bindValue(':thread_id', $thread_id, PDO::PARAM_INT);
    $stmt->execute();
    $threadRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$threadRow) {
        http_response_code(404); // Thread not found
        echo json_encode(['error' => 'Thread not found.']);
        exit;
    }

    $thread_owner_id = (int) $threadRow['user_id'];

    // 4. Check permission: user must be admin (role_id=7) or thread owner
    if ($role_id_session !== 7 && $thread_owner_id !== $user_id_session) {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'No permission to edit this thread.']);
        exit;
    }

    // 5. Update the thread title
    $updateStmt = $db->prepare("
        UPDATE threads
        SET title = :title
        WHERE thread_id = :thread_id
    ");
    $updateStmt->execute([
        ':title' => $new_title,
        ':thread_id' => $thread_id
    ]);

    // 6. Check how many rows were updated
    if ($updateStmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Thread updated successfully.']);
    } else {
        // Possibly the same title was provided, so no change
        echo json_encode([
            'success' => false,
            'message' => 'No changes were made to the thread title.'
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500); // Server error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
