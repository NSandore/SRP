<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../reporting_utils.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDB();
    ensureReportsTable($db);

    $userId = normalizeId($_SESSION['user_id']);
    $roleId = (int)($_SESSION['role_id'] ?? 0);
    if (isSuperAdmin($roleId)) {
        $stmt = $db->query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
        $count = (int)($stmt->fetchColumn() ?: 0);
    } else {
        $stmt = $db->prepare("
            SELECT COUNT(*)
            FROM reports r
            INNER JOIN ambassadors a
                ON a.community_id = r.community_id
               AND a.user_id = :uid
               AND a.community_role IN ('admin', 'moderator')
            WHERE r.status = 'pending'
        ");
        $stmt->execute([':uid' => $userId]);
        $count = (int)($stmt->fetchColumn() ?: 0);
    }

    echo json_encode(['success' => true, 'pending_count' => $count]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to fetch reported item count']);
}
