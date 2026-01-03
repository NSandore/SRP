<?php
// fetch_sessions.php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDB();
    $userId = normalizeId($_SESSION['user_id']);

    // Cleanup: keep revoked sessions for 30 days for audit/reporting, then purge
    $cleanup = $db->prepare("
        DELETE FROM user_sessions
        WHERE user_id = :uid
          AND revoked_at IS NOT NULL
          AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $cleanup->execute([':uid' => $userId]);

    $stmt = $db->prepare("
        SELECT session_id, user_agent, ip_address, created_at, last_active_at, revoked_at
        FROM user_sessions
        WHERE user_id = :uid
          AND revoked_at IS NULL
        ORDER BY last_active_at DESC
    ");
    $stmt->execute([':uid' => $userId]);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $currentId = session_id();
    $enriched = array_map(function($row) use ($currentId) {
        $row['current'] = $row['session_id'] === $currentId;
        return $row;
    }, $sessions);

    echo json_encode(['success' => true, 'sessions' => $enriched]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
