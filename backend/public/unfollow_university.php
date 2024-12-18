<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Ensure required POST parameters are present
if (!isset($_POST['user_id']) || !isset($_POST['university_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and university_id are required']);
    exit;
}

$user_id = (int)$_POST['user_id'];
$university_id = (int)$_POST['university_id'];

$db = getDB();

try {
    // Delete the follow record
    $stmt = $db->prepare("DELETE FROM followed_universities WHERE user_id = :user_id AND university_id = :university_id");
    $stmt->execute([
        ':user_id' => $user_id,
        ':university_id' => $university_id
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'University unfollowed successfully']);
    } else {
        echo json_encode(['error' => 'You are not following this university']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
