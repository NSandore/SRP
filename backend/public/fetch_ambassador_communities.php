<?php
// fetch_ambassador_communities.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_bootstrap.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

startSession();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Not logged in"]);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id']);
$sessionRoleId = (int)($_SESSION['role_id'] ?? 0);
$requestedUserId = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : '';
$user_id = $requestedUserId !== '' ? $requestedUserId : $sessionUserId;

if ($user_id !== $sessionUserId && !isSuperAdmin($sessionRoleId)) {
    http_response_code(403);
    echo json_encode(["success" => false, "error" => "Unauthorized"]);
    exit;
}

try {
    $db = getDB();

    // Fetch ambassador communities for this user by joining ambassadors + communities.
    $query = "SELECT a.community_id, c.name, a.community_role
              FROM ambassadors a 
              JOIN communities c ON a.community_id = c.id 
              WHERE a.user_id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "communities" => $communities]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    exit;
}
?>
