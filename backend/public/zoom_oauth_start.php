<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

$appBase = getenv('APP_BASE_URL');
$baseUrl = $appBase ? rtrim($appBase, '/') : '';
$returnTo = isset($_GET['return_to']) ? trim($_GET['return_to']) : '';
if ($returnTo !== '') {
    $parsed = parse_url($returnTo);
    $host = $parsed['host'] ?? '';
    $scheme = $parsed['scheme'] ?? '';
    $serverHost = $_SERVER['HTTP_HOST'] ?? '';
    $serverHost = explode(':', $serverHost)[0];
    if ($host !== '' && $scheme !== '' && in_array($scheme, ['http', 'https'], true)) {
        if ($serverHost === '' || $serverHost === $host) {
            $baseUrl = rtrim($returnTo, '/');
        }
    }
}
$redirectBase = $baseUrl ? $baseUrl . '/settings' : '/settings';
$redirectSeparator = strpos($redirectBase, '?') === false ? '?' : '&';
$redirectError = function (string $reason) use ($redirectBase, $redirectSeparator) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error&reason=' . rawurlencode($reason));
    exit;
};

if (!isset($_SESSION['user_id'])) {
    $loginUrl = $baseUrl ? $baseUrl . '/login' : '/login';
    header('Location: ' . $loginUrl);
    exit;
}

$clientId = getenv('ZOOM_CLIENT_ID');
$clientSecret = getenv('ZOOM_CLIENT_SECRET');
$redirectUri = getenv('ZOOM_REDIRECT_URI');

if (!$clientId || !$clientSecret || !$redirectUri) {
    $redirectError('missing_config');
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $stmt = $db->prepare("SELECT role_id, is_ambassador FROM users WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        $redirectError('user_not_found');
    }
    $roleId = (int)($user['role_id'] ?? 0);
    $isAmbassador = (int)($user['is_ambassador'] ?? 0) === 1;
    $isAdmin = isAdmin($roleId);
    if (!$isAmbassador && !$isAdmin) {
        $redirectError('access_denied');
    }

    $sessionId = session_id();
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device', 0, 255);
    $ipAddress = substr(
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
        0,
        45
    );
    $sessionStmt = $db->prepare("
        INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, last_active_at)
        VALUES (:sid, :uid, :ua, :ip, NOW(), NOW())
        ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent), ip_address = VALUES(ip_address), last_active_at = NOW(), revoked_at = NULL
    ");
    $sessionStmt->execute([
        ':sid' => $sessionId,
        ':uid' => $userId,
        ':ua' => $userAgent,
        ':ip' => $ipAddress,
    ]);

    $presenceStmt = $db->prepare("
        INSERT INTO account_settings (user_id, extras, updated_at)
        VALUES (:uid, JSON_SET(JSON_OBJECT(), '$.last_seen_at', NOW()), NOW())
        ON DUPLICATE KEY UPDATE
            extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.last_seen_at', NOW()),
            updated_at = NOW()
    ");
    $presenceStmt->execute([':uid' => $userId]);
} catch (PDOException $e) {
    $redirectError('db_error');
}

$stateData = [
    'u' => $userId,
    'ts' => time(),
    'nonce' => bin2hex(random_bytes(8)),
];
$statePayload = rtrim(strtr(base64_encode(json_encode($stateData, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
$stateSignature = hash_hmac('sha256', $statePayload, $clientSecret);
$state = $statePayload . '.' . $stateSignature;
$_SESSION['zoom_oauth_state'] = $state;
$_SESSION['zoom_oauth_user'] = $userId;
if ($baseUrl) {
    $_SESSION['zoom_oauth_return_to'] = $baseUrl;
}

$params = [
    'response_type' => 'code',
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'state' => $state,
    'scope' => 'meeting:write:meeting meeting:read:meeting user:read:user'
];

$authUrl = 'https://zoom.us/oauth/authorize?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
header('Location: ' . $authUrl);
exit;
?>
