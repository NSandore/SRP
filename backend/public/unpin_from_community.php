<?php
// unpin_from_community.php

require_once __DIR__ . '/cors.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_bootstrap.php';
require_once __DIR__ . '/../includes/permissions.php';

startSession();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$pinId = isset($input['pin_id']) ? normalizeId($input['pin_id']) : '';

if ($pinId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'pin_id is required']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();

    $pinStmt = $db->prepare("
        SELECT id, community_id
        FROM pinned_items
        WHERE id = :pid
        LIMIT 1
    ");
    $pinStmt->execute([':pid' => $pinId]);
    $pin = $pinStmt->fetch(PDO::FETCH_ASSOC);

    if (!$pin) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Pin not found']);
        exit;
    }

    $communityId = normalizeId($pin['community_id'] ?? '');
    if ($communityId === '' || !isAmbassador($sessionUserId, $communityId, $db)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only ambassadors of this community can unpin items']);
        exit;
    }

    $deleteStmt = $db->prepare("DELETE FROM pinned_items WHERE id = :pid LIMIT 1");
    $deleteStmt->execute([':pid' => $pinId]);

    if ($deleteStmt->rowCount() === 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Unable to unpin item']);
        exit;
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
?>
