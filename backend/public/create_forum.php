<?php
session_start(); // Start the session to access session variables

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Retrieve JSON input
$data = json_decode(file_get_contents('php://input'), true);

// Extract data
$community_id = isset($data['community_id']) ? normalizeId($data['community_id']) : '';
$name = trim($data['name'] ?? '');
$description = trim($data['description'] ?? '');

// **Validate User Role**
if (!isset($_SESSION['user_id']) || $_SESSION['role_id'] != 1) {
    http_response_code(403); // Forbidden
    echo json_encode(['error' => 'You do not have permission to create forums.']);
    exit;
}

// **Validate Input**
if (empty($name)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Forum name is required.']);
    exit;
}

try {
    $db = getDB();

    // If community_id not provided, default to the earliest community
    if (empty($community_id)) {
        $defaultCommunity = $db->query("SELECT id FROM communities ORDER BY id ASC LIMIT 1")->fetchColumn();
        if (!$defaultCommunity) {
            http_response_code(400);
            echo json_encode(['error' => 'Community not found. Please create a community first.']);
            exit;
        }
        $community_id = $defaultCommunity;
    }

    // Ensure community exists
    $check = $db->prepare("SELECT id FROM communities WHERE id = :cid LIMIT 1");
    $check->execute([':cid' => $community_id]);
    if (!$check->fetchColumn()) {
        http_response_code(400);
        echo json_encode(['error' => 'Community not found. Please choose a valid community.']);
        exit;
    }

    $forumId = generateUniqueId($db, 'forums');
    $stmt = $db->prepare("
        INSERT INTO forums (forum_id, community_id, name, description, created_at)
        VALUES (:forum_id, :cid, :name, :desc, NOW())
    ");
    $stmt->execute([
        ':forum_id' => $forumId,
        ':cid' => $community_id,
        ':name' => $name,
        ':desc' => $description
    ]);

    echo json_encode([
        'success' => true,
        'forum_id' => $forumId,
        'created_at' => date('Y-m-d H:i:s') // Return the created_at timestamp
    ]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
