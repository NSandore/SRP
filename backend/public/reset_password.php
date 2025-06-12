<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim($input['email']) : '';
$new_password = isset($input['new_password']) ? $input['new_password'] : '';

if (empty($email) || empty($new_password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email and new password are required.']);
    exit;
}

try {
    $db = getDB();
    // Check if user exists
    $stmt = $db->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found.']);
        exit;
    }

    $hashed = password_hash($new_password, PASSWORD_BCRYPT);
    $update = $db->prepare('UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id');
    $update->bindParam(':password_hash', $hashed);
    $update->bindParam(':user_id', $user['user_id'], PDO::PARAM_INT);
    $update->execute();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
