<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';

function base64UrlDecode(string $value): string {
    $remainder = strlen($value) % 4;
    if ($remainder) {
        $value .= str_repeat('=', 4 - $remainder);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function parseZoomState(string $state, string $secret, int $maxAgeSeconds): ?array {
    $parts = explode('.', $state, 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$payload, $signature] = $parts;
    if ($payload === '' || $signature === '') {
        return null;
    }
    $expected = hash_hmac('sha256', $payload, $secret);
    if (!hash_equals($expected, $signature)) {
        return null;
    }
    $decoded = base64UrlDecode($payload);
    if ($decoded === '') {
        return null;
    }
    $data = json_decode($decoded, true);
    if (!is_array($data)) {
        return null;
    }
    $ts = isset($data['ts']) ? (int)$data['ts'] : 0;
    if ($ts <= 0 || (time() - $ts) > $maxAgeSeconds) {
        return null;
    }
    return $data;
}

$appBase = getenv('APP_BASE_URL');
$baseUrl = $appBase ? rtrim($appBase, '/') : '';
if (!empty($_SESSION['zoom_oauth_return_to'])) {
    $candidate = trim((string)$_SESSION['zoom_oauth_return_to']);
    if ($candidate !== '') {
        $baseUrl = rtrim($candidate, '/');
    }
}
$redirectBase = $baseUrl ? $baseUrl . '/settings' : '/settings';
$redirectSeparator = strpos($redirectBase, '?') === false ? '?' : '&';

$error = isset($_GET['error']) ? trim($_GET['error']) : '';
if ($error !== '') {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$code = isset($_GET['code']) ? trim($_GET['code']) : '';
$state = isset($_GET['state']) ? trim($_GET['state']) : '';

$clientId = getenv('ZOOM_CLIENT_ID');
$clientSecret = getenv('ZOOM_CLIENT_SECRET');
$redirectUri = getenv('ZOOM_REDIRECT_URI');

if (!$clientId || !$clientSecret || !$redirectUri) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

if ($code === '' || $state === '') {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$stateData = parseZoomState($state, $clientSecret, 900);
$expectedState = isset($_SESSION['zoom_oauth_state']) ? $_SESSION['zoom_oauth_state'] : '';
$expectedUser = isset($_SESSION['zoom_oauth_user']) ? $_SESSION['zoom_oauth_user'] : '';

if ($expectedState !== '' && !hash_equals($expectedState, $state)) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

if ($expectedState === '' && !$stateData) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$userId = '';
if (isset($_SESSION['user_id'])) {
    $userId = normalizeId($_SESSION['user_id']);
} elseif ($stateData && !empty($stateData['u'])) {
    $userId = normalizeId($stateData['u']);
}

if ($userId === '') {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

if ($expectedUser !== '' && $expectedUser !== $userId) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

unset($_SESSION['zoom_oauth_state'], $_SESSION['zoom_oauth_user'], $_SESSION['zoom_oauth_return_to']);

try {
    $db = getDB();
    $userStmt = $db->prepare("
        SELECT user_id, first_name, last_name, email, role_id, avatar_path, banner_path, is_ambassador, login_count, is_public
        FROM users
        WHERE user_id = :uid
        LIMIT 1
    ");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
        exit;
    }
    $roleId = (int)($user['role_id'] ?? 0);
    $isAmbassador = (int)($user['is_ambassador'] ?? 0) === 1;
    $isAdmin = $roleId === 1 || $roleId >= 7;
    if (!$isAmbassador && !$isAdmin) {
        header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
        exit;
    }

    if (!isset($_SESSION['user_id'])) {
        $_SESSION['user_id'] = $userId;
        $_SESSION['first_name'] = $user['first_name'] ?? '';
        $_SESSION['last_name'] = $user['last_name'] ?? '';
        $_SESSION['email'] = $user['email'] ?? '';
        $_SESSION['role_id'] = $roleId;
        $_SESSION['avatar_path'] = appendAvatarPath($user['avatar_path'] ?? null);
        $_SESSION['banner_path'] = isset($user['banner_path'])
            ? appendBannerPath($user['banner_path'])
            : appendBannerPath(null);
        $_SESSION['is_ambassador'] = $user['is_ambassador'] ?? 0;
        $_SESSION['login_count'] = isset($user['login_count']) ? (int)$user['login_count'] : 0;
        $_SESSION['is_public'] = $user['is_public'] ?? 0;

        $adminCommunities = [];
        $cStmt = $db->prepare("SELECT community_id FROM ambassadors WHERE user_id = :uid AND role = 'admin'");
        $cStmt->execute([':uid' => $userId]);
        $adminCommunities = $cStmt->fetchAll(PDO::FETCH_COLUMN);
        $_SESSION['admin_community_ids'] = $adminCommunities;
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
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$tokenFields = http_build_query([
    'grant_type' => 'authorization_code',
    'code' => $code,
    'redirect_uri' => $redirectUri
], '', '&', PHP_QUERY_RFC3986);

$authHeader = base64_encode($clientId . ':' . $clientSecret);
$tokenResponse = null;
$tokenStatus = 0;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => 'https://zoom.us/oauth/token',
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $tokenFields,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Basic ' . $authHeader,
        'Content-Type: application/x-www-form-urlencoded'
    ],
]);
$tokenResponse = curl_exec($ch);
$tokenStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($tokenResponse === false || $tokenStatus >= 400) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$tokenData = json_decode($tokenResponse, true);
if (!is_array($tokenData) || empty($tokenData['access_token'])) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

$accessToken = $tokenData['access_token'];
$refreshToken = $tokenData['refresh_token'] ?? '';
$expiresIn = isset($tokenData['expires_in']) ? (int)$tokenData['expires_in'] : 0;
$expiresAt = $expiresIn > 0 ? (time() + $expiresIn - 60) : (time() + 3300);
$accountId = $tokenData['account_id'] ?? '';

$zoomUserId = '';
$zoomEmail = '';

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.zoom.us/v2/users/me',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ],
]);
$meResponse = curl_exec($ch);
$meStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($meResponse !== false && $meStatus < 400) {
    $meData = json_decode($meResponse, true);
    if (is_array($meData)) {
        $zoomUserId = $meData['id'] ?? '';
        $zoomEmail = $meData['email'] ?? '';
    }
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        INSERT INTO account_settings (user_id, extras, updated_at)
        VALUES (:uid, JSON_SET(JSON_OBJECT(),
            '$.zoom_access_token', :access_token,
            '$.zoom_refresh_token', :refresh_token,
            '$.zoom_expires_at', :expires_at,
            '$.zoom_user_id', :zoom_user_id,
            '$.zoom_email', :zoom_email,
            '$.zoom_account_id', :zoom_account_id
        ), NOW())
        ON DUPLICATE KEY UPDATE
            extras = JSON_SET(COALESCE(extras, JSON_OBJECT()),
                '$.zoom_access_token', :access_token,
                '$.zoom_refresh_token', :refresh_token,
                '$.zoom_expires_at', :expires_at,
                '$.zoom_user_id', :zoom_user_id,
                '$.zoom_email', :zoom_email,
                '$.zoom_account_id', :zoom_account_id
            ),
            updated_at = NOW()
    ");
    $stmt->execute([
        ':uid' => $userId,
        ':access_token' => $accessToken,
        ':refresh_token' => $refreshToken,
        ':expires_at' => $expiresAt,
        ':zoom_user_id' => $zoomUserId,
        ':zoom_email' => $zoomEmail,
        ':zoom_account_id' => $accountId,
    ]);
} catch (PDOException $e) {
    header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=error');
    exit;
}

header('Location: ' . $redirectBase . $redirectSeparator . 'zoom=connected');
exit;
?>
