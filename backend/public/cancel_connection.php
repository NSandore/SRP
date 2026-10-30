<?php
// cancel_connection.php

require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { $input = $_POST; }

if (!isset($input['connection_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing connection_id']);
    exit;
}

$connection_id = normalizeId($input['connection_id']);
$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    // Only allow cancel of pending requests
    $stmt = $db->prepare("DELETE FROM connections WHERE connection_id = :cid AND user_id1 = :uid AND status = 'pending'");
    $stmt->execute([':cid' => $connection_id, ':uid' => $userId]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Connection not found']);
        exit;
    }
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
