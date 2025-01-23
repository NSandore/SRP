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

// 2) Only admins can edit forums (or if you had an owner concept, you'd add logic)
if ($role_id_session !== 3) {
    http_response_code(403);
    echo json_encode(['error' => 'No permission to edit forums.']);
    exit;
}

// 3) Decode JSON
$data = json_decode(file_get_contents('php://input'), true);
$forum_id = (int)($data['forum_id'] ?? 0);
$new_name = trim($data['name'] ?? '');
$new_desc = trim($data['description'] ?? '');

if ($forum_id <= 0 || empty($new_name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid forum_id or missing name.']);
    exit;
}

try {
    $db = getDB();

    // 4) Perform the update
    $stmt = $db->prepare("
        UPDATE forums
        SET name = :name, description = :desc
        WHERE forum_id = :forum_id
    ");
    $stmt->execute([
        ':name' => $new_name,
        ':desc' => $new_desc,
        ':forum_id' => $forum_id,
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Forum updated successfully.']);
    } else {
        // Possibly no changes or forum doesn't exist
        echo json_encode([
            'success' => false,
            'message' => 'No changes made or forum not found.'
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
