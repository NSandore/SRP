<?php
/**
 * API health check. Replaces the previous phpinfo() page, which leaked the
 * full PHP configuration and environment to anyone hitting /api/.
 */
require_once __DIR__ . '/../session_bootstrap.php';
header('Content-Type: application/json');

$status = 'ok';
$dbOk = false;

try {
    require_once __DIR__ . '/../db_connection.php';
    $db = getDB();
    $db->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $e) {
    error_log('[SRP] health check DB failure: ' . $e->getMessage());
    $status = 'degraded';
    http_response_code(503);
}

echo json_encode([
    'status' => $status,
    'service' => 'srp-api',
    'database' => $dbOk ? 'up' : 'down',
    'time' => gmdate('c'),
]);
