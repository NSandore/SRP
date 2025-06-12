<?php
// cancel_connection.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { $input = $_POST; }

if (!isset($input['connection_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing connection_id']);
    exit;
}

$connection_id = (int)$input['connection_id'];

try {
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM connections WHERE connection_id = :cid AND status = 'pending'");
    $stmt->execute([':cid' => $connection_id]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Connection not found']);
        exit;
    }
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
