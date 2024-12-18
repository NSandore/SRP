<?php
session_start();
header('Content-Type: application/json');
require_once '../db_connection.php';

$data = json_decode(file_get_contents('php://input'), true);

$email = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? trim($data['password']) : '';

if (empty($email) || empty($password)) {
    echo json_encode(["error" => "Email and password are required."]);
    exit;
}

try {
    $db = getDB();

    $query = "SELECT user_id, first_name, last_name, email, password_hash, role_id FROM users WHERE email = :email LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password_hash'])) {
        unset($user['password_hash']); // Remove sensitive data

        // Set session variables
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['last_name'] = $user['last_name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role_id'] = $user['role_id'];

        echo json_encode([
            "success" => true,
            "user" => $user
        ]);
    } else {
        echo json_encode(["error" => "Invalid email or password."]);
    }
} catch (PDOException $e) {
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
