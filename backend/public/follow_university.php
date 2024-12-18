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
    // Insert a new follow record
    $stmt = $db->prepare("INSERT INTO followed_universities (user_id, university_id) VALUES (:user_id, :university_id)");
    $stmt->execute([
        ':user_id' => $user_id,
        ':university_id' => $university_id
    ]);

    echo json_encode(['success' => true, 'message' => 'University followed successfully']);
} catch (PDOException $e) {
    // Handle duplicate entries gracefully
    if ($e->getCode() == 23000) { // Integrity constraint violation
        echo json_encode(['error' => 'You are already following this university']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>
