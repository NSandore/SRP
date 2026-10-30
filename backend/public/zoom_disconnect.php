<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("
        UPDATE account_settings
        SET extras = JSON_REMOVE(
            COALESCE(extras, JSON_OBJECT()),
            '$.zoom_access_token',
            '$.zoom_refresh_token',
            '$.zoom_expires_at',
            '$.zoom_user_id',
            '$.zoom_email',
            '$.zoom_account_id'
        ),
        updated_at = NOW()
        WHERE user_id = :uid
    ");
    $stmt->execute([':uid' => $userId]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
?>
