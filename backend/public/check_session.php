<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (isset($_SESSION['user_id'])) {
    $userId = normalizeId($_SESSION['user_id']);

    try {
        $db = getDB();
        $presenceStmt = $db->prepare("
            INSERT INTO account_settings (user_id, extras, updated_at)
            VALUES (:uid, JSON_SET(JSON_OBJECT(), '$.last_seen_at', NOW()), NOW())
            ON DUPLICATE KEY UPDATE
                extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.last_seen_at', NOW()),
                updated_at = NOW()
        ");
        $presenceStmt->execute([':uid' => $userId]);
    } catch (PDOException $e) {
        error_log('Unable to update presence: ' . $e->getMessage());
    }

    echo json_encode([
        "loggedIn" => true,
        "user" => [
            "user_id" => $userId,
            "first_name" => $_SESSION['first_name'],
            "last_name" => $_SESSION['last_name'],
            "email" => $_SESSION['email'],
            "role_id" => $_SESSION['role_id'],
            "avatar_path" => appendAvatarPath($_SESSION['avatar_path'] ?? null),
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
