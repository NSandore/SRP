<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$roleId = (int)($_SESSION['role_id'] ?? 0);
if ($roleId !== ROLE_SUPER_ADMIN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$status = isset($_GET['status']) ? trim((string)$_GET['status']) : 'pending';
$validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'all'];
if (!in_array($status, $validStatuses, true)) {
    $status = 'pending';
}

try {
    $db = getDB();
    $where = $status === 'all' ? '' : 'WHERE r.status = :status';
    $query = "
        SELECT
            r.request_id,
            r.user_id,
            r.community_id,
            r.verification_type,
            r.verification_method,
            r.staff_position,
            r.selfie_path,
            r.id_front_path,
            r.supporting_doc_path,
            r.status,
            r.created_at,
            r.reviewed_at,
            u.first_name,
            u.last_name,
            u.email,
            c.name AS community_name
        FROM user_verification_requests r
        JOIN users u ON u.user_id = r.user_id
        LEFT JOIN communities c ON c.id = r.community_id
        {$where}
        ORDER BY
            CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
            r.created_at DESC
    ";
    $stmt = $db->prepare($query);
    if ($status !== 'all') {
        $stmt->execute([':status' => $status]);
    } else {
        $stmt->execute();
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    echo json_encode(['success' => true, 'requests' => $rows]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load verification requests']);
}
