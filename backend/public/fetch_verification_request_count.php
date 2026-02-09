<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$roleId = (int)($_SESSION['role_id'] ?? 0);
if ($roleId !== ROLE_SUPER_ADMIN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT COUNT(*) FROM user_verification_requests WHERE status = 'pending'");
    $stmt->execute();
    $count = (int)($stmt->fetchColumn() ?: 0);
    echo json_encode(['success' => true, 'pending_count' => $count]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to fetch verification count']);
}
