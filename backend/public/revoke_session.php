<?php
// revoke_session.php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['session_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing session_id']);
    exit;
}

$targetSessionId = trim($input['session_id']);
$currentSessionId = session_id();
$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = :sid AND user_id = :uid");
    $stmt->execute([':sid' => $targetSessionId, ':uid' => $userId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Session not found']);
        exit;
    }

    if ($targetSessionId === $currentSessionId) {
        // Revoke current session immediately
        session_destroy();
    }

    echo json_encode(['success' => true, 'revoked' => $targetSessionId === $currentSessionId ? 'current' : 'other']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
