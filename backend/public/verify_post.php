<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

// Determine the content type and retrieve parameters accordingly
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';

if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents("php://input"), true);
    $user_id = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $post_id = isset($data['post_id']) ? (int)$data['post_id'] : 0;
} else {
    $user_id = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
    $post_id = isset($_POST['post_id']) ? (int)$_POST['post_id'] : 0;
}

// Validate parameters
if (!$user_id || !$post_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and post_id are required']);
    exit;
}

$db = getDB();

try {
    // Optionally, verify that the user is an admin here.
    // For this example, we assume that the calling code ensures this.

    $query = "UPDATE posts 
              SET verified = 1, verified_by = :user_id, verified_at = NOW() 
              WHERE post_id = :post_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->bindParam(':post_id', $post_id, PDO::PARAM_INT);
    $stmt->execute();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
