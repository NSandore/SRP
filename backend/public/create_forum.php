<?php
session_start(); // Start the session to access session variables

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Retrieve JSON input
$data = json_decode(file_get_contents('php://input'), true);

// Extract data
$community_id = intval($data['community_id'] ?? 0);
$name = trim($data['name'] ?? '');
$description = trim($data['description'] ?? '');

// **Validate User Role**
if (!isset($_SESSION['user_id']) || $_SESSION['role_id'] != 3) {
    http_response_code(403); // Forbidden
    echo json_encode(['error' => 'You do not have permission to create forums.']);
    exit;
}

// **Validate Input**
if ($community_id <= 0 || empty($name)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid data for creating forum.']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        INSERT INTO forums (community_id, name, description, created_at)
        VALUES (:cid, :name, :desc, NOW())
    ");
    $stmt->execute([
        ':cid' => $community_id,
        ':name' => $name,
        ':desc' => $description
    ]);

    echo json_encode([
        'success' => true,
        'forum_id' => $db->lastInsertId(),
        'created_at' => date('Y-m-d H:i:s') // Return the created_at timestamp
    ]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
