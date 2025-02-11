<?php
// fetch_group.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

$community_id = intval($_GET['community_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM communities WHERE id = :id AND community_type = 'group'");
    $stmt->execute([':id' => $community_id]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$group) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Group not found']);
        exit;
    }
    echo json_encode(['success' => true, 'group' => $group]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
?>
