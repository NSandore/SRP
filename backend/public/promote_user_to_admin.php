<?php
session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$community_id = isset($input['community_id']) ? (int)$input['community_id'] : 0;
$user_email = isset($input['user_email']) ? trim($input['user_email']) : '';

if ($community_id <= 0 || $user_email === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id or user_email']);
    exit;
}

$role_id = (int)$_SESSION['role_id'];
$allowedCommunities = $_SESSION['admin_community_ids'] ?? [];

if ($role_id < 5) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Insufficient privileges']);
    exit;
}

if ($role_id == 5 && !in_array($community_id, $allowedCommunities)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authorized for this community']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare('INSERT IGNORE INTO community_admins (community_id, user_email) VALUES (:cid, :email)');
    $stmt->execute([':cid' => $community_id, ':email' => $user_email]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
