<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$eventId = isset($input['event_id']) ? trim((string)$input['event_id']) : '';
if ($eventId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing event id']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $userStmt = $db->prepare("SELECT role_id, is_ambassador FROM users WHERE user_id = :uid LIMIT 1");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
    $roleId = (int)($user['role_id'] ?? 0);
    $isAmbassador = (int)($user['is_ambassador'] ?? 0) === 1;
    $isAdmin = isAdmin($roleId);

    $checkStmt = $db->prepare("SELECT created_by FROM events WHERE event_id = :eid LIMIT 1");
    $checkStmt->execute([':eid' => $eventId]);
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        echo json_encode(['success' => true, 'warning' => 'Event not found']);
        exit;
    }
    if (!$isAdmin && !$isAmbassador && $existing['created_by'] !== $userId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }

    $deleteStmt = $db->prepare("DELETE FROM events WHERE event_id = :eid");
    $deleteStmt->execute([':eid' => $eventId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
