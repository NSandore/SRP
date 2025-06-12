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
    $stmt = $db->prepare("SELECT connection_id, user_id1, user_id2, status FROM connections WHERE (user_id1 = :u1 AND user_id2 = :u2) OR (user_id1 = :u2 AND user_id2 = :u1)");
    $stmt->execute([':u1' => $user_id1, ':u2' => $user_id2]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $response = [
            'success' => true,
            'status' => $row['status'],
            'connection_id' => (int)$row['connection_id'],
            'is_sender' => ($row['user_id1'] == $user_id1)
        ];
    } else {
        $response = ['success' => true, 'status' => 'none'];
    }
    echo json_encode($response);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
