<?php
require_once __DIR__ . '/cors.php';
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
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_access_token')) AS zoom_access_token,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_refresh_token')) AS zoom_refresh_token,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_expires_at')) AS zoom_expires_at,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_email')) AS zoom_email,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_user_id')) AS zoom_user_id
        FROM account_settings
        WHERE user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $refreshToken = $row['zoom_refresh_token'] ?? '';
    $accessToken = $row['zoom_access_token'] ?? '';
    $expiresAt = isset($row['zoom_expires_at']) ? (int)$row['zoom_expires_at'] : 0;
    $email = $row['zoom_email'] ?? '';
    $zoomUserId = $row['zoom_user_id'] ?? '';

    $connected = $refreshToken !== '' || $accessToken !== '';

    echo json_encode([
        'success' => true,
        'connected' => $connected,
        'zoom_email' => $email,
        'zoom_user_id' => $zoomUserId,
        'expires_at' => $expiresAt,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
?>
