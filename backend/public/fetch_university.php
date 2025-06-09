<?php
// fetch_university.php

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
    $stmt = $db->prepare(
        "SELECT c.*, COUNT(fc.user_id) AS followers_count
         FROM communities c
         LEFT JOIN followed_communities fc ON fc.community_id = c.id
         WHERE c.id = :id AND c.community_type = 'university'
         GROUP BY c.id"
    );
    $stmt->execute([':id' => $community_id]);
    $university = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$university) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'University not found']);
        exit;
    }
    echo json_encode(['success' => true, 'university' => $university]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
?>
