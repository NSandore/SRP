<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Ensure required POST parameters are present
$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !isset($data['user_id']) || !isset($data['community_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and community_id are required']);
    exit;
}

$user_id = normalizeId($data['user_id']);
$community_id = normalizeId($data['community_id']);

$db = getDB();
$followId = generateUniqueId($db, 'followed_communities');

try {
    // Insert a new follow record
    $stmt = $db->prepare("INSERT INTO followed_communities (id, user_id, community_id) VALUES (:id, :user_id, :community_id)");
    $stmt->execute([
        ':id' => $followId,
        ':user_id' => $user_id,
        ':community_id' => $community_id
    ]);

    echo json_encode(['success' => true, 'message' => 'Community followed successfully']);
} catch (PDOException $e) {
    // Handle duplicate entries gracefully
    if ($e->getCode() == 23000) { // Integrity constraint violation
        echo json_encode(['error' => 'You are already following this community']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>
