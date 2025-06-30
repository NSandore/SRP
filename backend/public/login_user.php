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

    $query = "SELECT user_id, first_name, last_name, email, password_hash, role_id, avatar_path, is_ambassador, login_count, is_public FROM users WHERE email = :email LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password_hash'])) {
        // Increment login_count by 1
        $updateStmt = $db->prepare("UPDATE users SET login_count = login_count + 1 WHERE user_id = :user_id");
        $updateStmt->execute([':user_id' => $user['user_id']]);

        unset($user['password_hash']); // Remove sensitive data

        // Set session variables
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['last_name'] = $user['last_name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role_id'] = $user['role_id'];
        $_SESSION['avatar_path'] = $user['avatar_path'];
        $_SESSION['is_ambassador'] = $user['is_ambassador'];
        $_SESSION['login_count'] = $user['login_count'];
        $_SESSION['is_public'] = $user['is_public'];

        // Fetch communities that this user administers if applicable
        $communityIds = [];
        if ($user['role_id'] >= 5 && $user['role_id'] < 8) {
            $cStmt = $db->prepare("SELECT community_id FROM community_admins WHERE user_email = :email");
            $cStmt->execute([':email' => $user['email']]);
            $communityIds = $cStmt->fetchAll(PDO::FETCH_COLUMN);
        }
        $_SESSION['admin_community_ids'] = $communityIds;
        $user['admin_community_ids'] = $communityIds;

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
