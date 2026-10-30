<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'You must be logged in.']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

if (empty($inputData['selected_schools'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Selected schools are required.']);
    exit;
}

// The actor is always the authenticated session's own user, never a
// client-supplied user_id.
$user_id = normalizeId($_SESSION['user_id']);
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
                "INSERT INTO followed_communities (id, user_id, community_id) VALUES (:id, :user_id, :community_id)"
            );
            $insertStmt->execute([
                ':id' => generateUniqueId($db, 'followed_communities'),
                ':user_id' => $user_id,
                ':community_id' => $community_id
            ]);
        }
    }

    http_response_code(200);
    echo json_encode(['message' => 'Followed communities updated successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>