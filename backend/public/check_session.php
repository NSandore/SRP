<?php
session_start();
header('Content-Type: application/json');

if (isset($_SESSION['user_id'])) {
    echo json_encode([
        "loggedIn" => true,
        "user" => [
            "user_id" => $_SESSION['user_id'],
            "first_name" => $_SESSION['first_name'],
            "last_name" => $_SESSION['last_name'],
            "email" => $_SESSION['email'],
            "role_id" => $_SESSION['role_id'],
            "avatar_path" => $_SESSION['avatar_path'],
            "is_ambassador" => $_SESSION['is_ambassador'],
            "login_count" => $_SESSION['login_count'],
            "is_public" => $_SESSION['is_public'],
            "admin_community_ids" => $_SESSION['admin_community_ids'] ?? []
        ]
    ]);
} else {
    echo json_encode(["loggedIn" => false]);
}
?>
