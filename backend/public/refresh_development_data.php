<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';

const SRP_DEVELOPMENT_ENV_FILE = '/home/nick/.config/srp/development.env';
const SRP_DEVELOPMENT_DATABASE = 'srp_db_dev';
const SRP_REFRESH_CONFIRMATION = 'REFRESH DEVELOPMENT';

function srp_is_designated_development_runtime(): bool {
    $configuredEnv = getenv('SRP_ENV_FILE');
    $configuredPath = $configuredEnv !== false ? realpath($configuredEnv) : false;
    $developmentPath = realpath(SRP_DEVELOPMENT_ENV_FILE);

    return srp_is_dev_mode()
        && getenv('DB_NAME') === SRP_DEVELOPMENT_DATABASE
        && $configuredPath !== false
        && $developmentPath !== false
        && $configuredPath === $developmentPath
        && (int)($_SERVER['SERVER_PORT'] ?? 0) === 3004;
}

function srp_log_development_refresh(string $userId, string $result): void {
    $logPath = '/home/nick/.local/share/srp-deployment/shared/logs/development-refresh.log';
    $entry = sprintf(
        "%s user=%s ip=%s result=%s\n",
        gmdate('c'),
        preg_replace('/[^a-zA-Z0-9_-]/', '', $userId),
        srp_client_ip(),
        preg_replace('/[^a-zA-Z0-9_-]/', '', $result)
    );
    @file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX);
}

// Fail closed before checking authentication so production does not advertise
// that this operational endpoint exists.
if (!srp_is_designated_development_runtime()) {
    srp_json(['success' => false, 'error' => 'Not found.'], 404);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$fetchSite = strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
if ($fetchSite !== 'same-origin') {
    srp_json(['success' => false, 'error' => 'This action must be started from the development site.'], 403);
}

$contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
if (strpos($contentType, 'application/json') !== 0) {
    srp_json(['success' => false, 'error' => 'A JSON request is required.'], 415);
}

[$db, $userId] = srp_bootstrap(requireAuth: true);

// Verify the canonical database role instead of trusting the role cached in
// the PHP session for this destructive operation.
$roleStatement = $db->prepare('SELECT role_id FROM users WHERE user_id = :user_id LIMIT 1');
$roleStatement->execute([':user_id' => $userId]);
if (!isSuperAdmin((int)$roleStatement->fetchColumn())) {
    srp_json(['success' => false, 'error' => 'Only super admins can refresh development data.'], 403);
}

$payload = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($payload) || ($payload['confirmation'] ?? '') !== SRP_REFRESH_CONFIRMATION) {
    srp_json([
        'success' => false,
        'error' => 'Type REFRESH DEVELOPMENT exactly to confirm.',
    ], 422);
}

$lockHandle = fopen(sys_get_temp_dir() . '/srp-development-refresh.lock', 'c');
if ($lockHandle === false || !flock($lockHandle, LOCK_EX | LOCK_NB)) {
    srp_json(['success' => false, 'error' => 'A development refresh is already running.'], 409);
}

$repositoryRoot = dirname(__DIR__, 2);
$refreshScript = $repositoryRoot . '/deploy/refresh-development-from-production.sh';
if (!is_file($refreshScript) || !is_executable($refreshScript)) {
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
    srp_json(['success' => false, 'error' => 'The development refresh tool is unavailable.'], 500);
}

$descriptorSpec = [
    0 => ['file', '/dev/null', 'r'],
    1 => ['pipe', 'w'],
    2 => ['redirect', 1],
];
$process = proc_open([$refreshScript], $descriptorSpec, $pipes, $repositoryRoot);
if (!is_resource($process)) {
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
    srp_log_development_refresh($userId, 'start_failed');
    srp_json(['success' => false, 'error' => 'Unable to start the development refresh.'], 500);
}

$output = stream_get_contents($pipes[1]);
fclose($pipes[1]);
$exitCode = proc_close($process);

flock($lockHandle, LOCK_UN);
fclose($lockHandle);

if ($exitCode !== 0) {
    error_log('[SRP] Development refresh failed: ' . trim($output));
    srp_log_development_refresh($userId, 'failed');
    srp_json([
        'success' => false,
        'error' => 'The development data refresh failed. Check the server log for details.',
    ], 500);
}

srp_log_development_refresh($userId, 'completed');

// The clone deliberately removes every development session. Destroy the
// current PHP session too so the browser cannot keep using stale session data.
session_unset();
session_destroy();
if (ini_get('session.use_cookies')) {
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $cookie['path'], $cookie['domain'], $cookie['secure'], $cookie['httponly']);
}

srp_json([
    'success' => true,
    'message' => 'Development data was refreshed from production.',
    'completed_at' => gmdate('c'),
    'requires_login' => true,
]);
