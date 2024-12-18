<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

$requiredFields = ['firstName', 'lastName', 'email', 'password'];
foreach ($requiredFields as $field) {
    if (empty($inputData[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "$field is required"]);
        exit;
    }
}

$firstName = trim($inputData['firstName']);
$lastName = trim($inputData['lastName']);
$email = trim($inputData['email']);
$password = password_hash($inputData['password'], PASSWORD_BCRYPT);

try {
    $db = getDB();
    $stmt = $db->prepare("INSERT INTO users (role_id, first_name, last_name, email, password_hash) 
                          VALUES (:role_id, :first_name, :last_name, :email, :password_hash)");
    $stmt->execute([
        ':role_id' => 2, // Default role for students
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':password_hash' => $password
    ]);

    http_response_code(201);
    echo json_encode(['message' => 'User registered successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
