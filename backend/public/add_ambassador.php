<?php
// add_ambassador.php
// Grants ambassador access for a user within a community (admins only).

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$community_id = isset($input['community_id']) ? normalizeId($input['community_id']) : '';
$user_id = isset($input['user_id']) ? normalizeId($input['user_id']) : '';

if ($community_id === '' || $user_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id or user_id']);
    exit;
}

// Direct grants are no longer allowed; users must apply and verify.
http_response_code(403);
echo json_encode([
    'success' => false,
    'error' => 'Direct ambassador invitations are disabled. Please apply and verify your school to become an ambassador.'
]);
exit;
