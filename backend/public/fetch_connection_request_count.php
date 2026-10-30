<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM connections
        WHERE user_id2 = :uid
          AND status = 'pending'
    ");
    $stmt->execute([':uid' => normalizeId($_SESSION['user_id'])]);
    echo json_encode([
        'success' => true,
        'pending_count' => (int)($stmt->fetchColumn() ?: 0),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to fetch connection request count']);
}
