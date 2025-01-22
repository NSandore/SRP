<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Decode JSON input
$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !isset($data['user_id']) || !isset($data['community_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and community_id are required']);
    exit;
}

$user_id = (int)$data['user_id'];
$community_id = (int)$data['community_id'];

$db = getDB();

try {
    // Delete the follow record
    $stmt = $db->prepare("
        DELETE FROM followed_communities 
        WHERE user_id = :user_id AND community_id = :community_id
    ");
    $stmt->execute([
        ':user_id' => $user_id,
        ':community_id' => $community_id
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Community unfollowed successfully']);
    } else {
        echo json_encode(['error' => 'You are not following this community']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
