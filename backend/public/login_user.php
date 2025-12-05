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

    $query = "SELECT user_id, first_name, last_name, email, password_hash, role_id, avatar_path, banner_path, is_ambassador, login_count, is_public, is_verified FROM users WHERE email = :email LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password_hash'])) {
        if (!(int)$user['is_verified']) {
            http_response_code(403);
            echo json_encode([
                "error" => "Please verify your email before logging in.",
                "requires_verification" => true,
                "user_id" => $user['user_id'],
                "email" => $user['email']
            ]);
            exit;
        }

        // Increment login_count by 1
        $updateStmt = $db->prepare("UPDATE users SET login_count = login_count + 1 WHERE user_id = :user_id");
        $updateStmt->execute([':user_id' => $user['user_id']]);

        unset($user['password_hash']); // Remove sensitive data

        // Normalize media paths for output/session
        $user['avatar_path'] = appendAvatarPath($user['avatar_path'] ?? null);
        if (isset($user['banner_path'])) {
            $user['banner_path'] = appendBannerPath($user['banner_path']);
        }

        // Set session variables
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['last_name'] = $user['last_name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role_id'] = $user['role_id'];
        $_SESSION['avatar_path'] = $user['avatar_path'];
        $_SESSION['banner_path'] = $user['banner_path'] ?? appendBannerPath(null);
        $_SESSION['is_ambassador'] = $user['is_ambassador'];
        $_SESSION['login_count'] = $user['login_count'];
        $_SESSION['is_public'] = $user['is_public'];

        // Fetch communities where this user is an ambassador admin
        $adminCommunities = [];
        $cStmt = $db->prepare("SELECT community_id FROM ambassadors WHERE user_id = :uid AND role = 'admin'");
        $cStmt->execute([':uid' => $user['user_id']]);
        $adminCommunities = $cStmt->fetchAll(PDO::FETCH_COLUMN);
        $_SESSION['admin_community_ids'] = $adminCommunities;
        $user['admin_community_ids'] = $adminCommunities;

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
