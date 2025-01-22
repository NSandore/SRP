<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

if (empty($inputData['user_id']) || empty($inputData['selected_schools'])) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID and selected schools are required.']);
    exit;
}

$user_id = (int)$inputData['user_id'];
$selected_schools = $inputData['selected_schools'];

try {
    $db = getDB();

    // Clear existing interests
    $clearStmt = $db->prepare("DELETE FROM followed_communities WHERE user_id = :user_id");
    $clearStmt->execute([':user_id' => $user_id]);

    // Insert new interests
    foreach ($selected_schools as $schoolName) {
        $stmt = $db->prepare("SELECT id FROM communities WHERE name = :name LIMIT 1");
        $stmt->execute([':name' => $schoolName]);
        $community = $stmt->fetch();

        if ($community && isset($community['id'])) {
            $community_id = $community['id'];

            $insertStmt = $db->prepare(
                "INSERT INTO followed_communities (user_id, community_id) VALUES (:user_id, :community_id)"
            );
            $insertStmt->execute([
                ':user_id' => $user_id,
                ':community_id' => $community_id
            ]);
        }
    }

    http_response_code(200);
    echo json_encode(['message' => 'Followed communities updated successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
