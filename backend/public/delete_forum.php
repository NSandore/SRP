<?php
session_start();

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1) Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}

$role_id_session = (int)$_SESSION['role_id'];

// 2) Only role_id=7 is allowed
if ($role_id_session !== 7) {
    http_response_code(403);
    echo json_encode(['error' => 'No permission to delete forums.']);
    exit;
}

// 3) Decode JSON
$data = json_decode(file_get_contents('php://input'), true);
$forum_id = (int)($data['forum_id'] ?? 0);

if ($forum_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid forum_id.']);
    exit;
}

try {
    $db = getDB();

    // If you have associated threads/posts, you might want to delete them or rely on foreign keys
    $stmt = $db->prepare("DELETE FROM forums WHERE forum_id = :forum_id");
    $stmt->bindValue(':forum_id', $forum_id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Forum deleted successfully.']);
    } else {
        // Possibly doesn't exist
        http_response_code(404);
        echo json_encode(['error' => 'Forum not found or already deleted.']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
