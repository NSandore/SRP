<?php
// fetch_connection_status.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['user_id1']) || !isset($_GET['user_id2'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id1 or user_id2']);
    exit;
}

$user_id1 = (int)$_GET['user_id1'];
$user_id2 = (int)$_GET['user_id2'];

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT status FROM connections WHERE (user_id1 = :u1 AND user_id2 = :u2) OR (user_id1 = :u2 AND user_id2 = :u1)");
    $stmt->execute([':u1' => $user_id1, ':u2' => $user_id2]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $status = $row ? $row['status'] : 'none';
    echo json_encode(['success' => true, 'status' => $status]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
