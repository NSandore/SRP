<?php
// remove_connection.php

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { $input = $_POST; }

if (empty($input['user_id1']) || empty($input['user_id2'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id1 or user_id2']);
    exit;
}

$user_id1 = normalizeId($input['user_id1']);
$user_id2 = normalizeId($input['user_id2']);

if ($user_id1 === '' || $user_id2 === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id1 or user_id2']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare(
        "DELETE FROM connections WHERE ((user_id1 = :u1 AND user_id2 = :u2) OR (user_id1 = :u2 AND user_id2 = :u1)) AND status = 'accepted'"
    );
    $stmt->execute([':u1' => $user_id1, ':u2' => $user_id2]);
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
