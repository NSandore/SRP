<?php
// fetch_user_connections.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

$user_id = normalizeId($_GET['user_id']);
if ($user_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT user_id1, user_id2 FROM connections WHERE (user_id1 = :uid OR user_id2 = :uid) AND status = 'accepted'");
    $stmt->execute([':uid' => $user_id]);
    $connections = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $connections[] = ($row['user_id1'] == $user_id) ? $row['user_id2'] : $row['user_id1'];
    }
    echo json_encode(['success' => true, 'connections' => $connections]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
