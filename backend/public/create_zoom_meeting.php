<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

function zoomRequest(string $method, string $url, string $accessToken, array $payload = []): array {
    $ch = curl_init();
    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
    ];
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if (!empty($payload)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => $response,
        'error' => $error,
    ];
}

function refreshZoomToken(string $clientId, string $clientSecret, string $refreshToken): array {
    $fields = http_build_query([
        'grant_type' => 'refresh_token',
        'refresh_token' => $refreshToken,
    ], '', '&', PHP_QUERY_RFC3986);
    $authHeader = base64_encode($clientId . ':' . $clientSecret);
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://zoom.us/oauth/token',
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . $authHeader,
            'Content-Type: application/x-www-form-urlencoded'
        ],
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => $response,
        'error' => $error,
    ];
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$topic = isset($input['topic']) ? trim($input['topic']) : '';
$startTime = isset($input['start_time']) ? trim($input['start_time']) : '';
$timezone = isset($input['timezone']) ? trim($input['timezone']) : '';
$duration = isset($input['duration']) ? (int)$input['duration'] : 60;
$agenda = isset($input['agenda']) ? trim($input['agenda']) : '';
$meetingId = isset($input['meeting_id']) ? trim($input['meeting_id']) : '';

if ($topic === '' || $startTime === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing meeting topic or start time.']);
    exit;
}

if ($duration <= 0) {
    $duration = 60;
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $userStmt = $db->prepare("SELECT role_id, is_ambassador FROM users WHERE user_id = :uid LIMIT 1");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }
    $roleId = (int)($user['role_id'] ?? 0);
    $isAmbassador = (int)($user['is_ambassador'] ?? 0) === 1;
    $isAdmin = isAdmin($roleId);
    if (!$isAmbassador && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }

    $settingsStmt = $db->prepare("
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_access_token')) AS zoom_access_token,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_refresh_token')) AS zoom_refresh_token,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_expires_at')) AS zoom_expires_at,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.zoom_email')) AS zoom_email
        FROM account_settings
        WHERE user_id = :uid
        LIMIT 1
    ");
    $settingsStmt->execute([':uid' => $userId]);
    $settings = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    require_once __DIR__ . '/../includes/crypto.php';
    // Tokens are stored encrypted; decrypt for use (legacy plaintext passes through).
    $accessToken = (string)(srp_decrypt($settings['zoom_access_token'] ?? '') ?? '');
    $refreshToken = (string)(srp_decrypt($settings['zoom_refresh_token'] ?? '') ?? '');
    $expiresAt = isset($settings['zoom_expires_at']) ? (int)$settings['zoom_expires_at'] : 0;
    $zoomEmail = $settings['zoom_email'] ?? '';

    if ($refreshToken === '' && $accessToken === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Zoom account not connected.']);
        exit;
    }

    $clientId = getenv('ZOOM_CLIENT_ID');
    $clientSecret = getenv('ZOOM_CLIENT_SECRET');
    if (!$clientId || !$clientSecret) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Zoom OAuth is not configured.']);
        exit;
    }

    if ($accessToken === '' || ($expiresAt > 0 && time() >= ($expiresAt - 60))) {
        if ($refreshToken === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Zoom access expired. Reconnect Zoom.']);
            exit;
        }
        $refreshResult = refreshZoomToken($clientId, $clientSecret, $refreshToken);
        if ($refreshResult['status'] >= 400 || $refreshResult['body'] === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Unable to refresh Zoom access.']);
            exit;
        }
        $refreshData = json_decode($refreshResult['body'], true);
        if (!is_array($refreshData) || empty($refreshData['access_token'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Unable to refresh Zoom access.']);
            exit;
        }
        $accessToken = $refreshData['access_token'];
        $refreshToken = $refreshData['refresh_token'] ?? $refreshToken;
        $expiresIn = isset($refreshData['expires_in']) ? (int)$refreshData['expires_in'] : 0;
        $expiresAt = $expiresIn > 0 ? (time() + $expiresIn - 60) : (time() + 3300);

        $saveStmt = $db->prepare("
            UPDATE account_settings
            SET extras = JSON_SET(COALESCE(extras, JSON_OBJECT()),
                '$.zoom_access_token', :access_token,
                '$.zoom_refresh_token', :refresh_token,
                '$.zoom_expires_at', :expires_at
            ),
            updated_at = NOW()
            WHERE user_id = :uid
        ");
        $saveStmt->execute([
            ':access_token' => srp_encrypt($accessToken),
            ':refresh_token' => srp_encrypt($refreshToken),
            ':expires_at' => $expiresAt,
            ':uid' => $userId,
        ]);
    }

    $payload = [
        'topic' => $topic,
        'start_time' => $startTime,
        'duration' => $duration,
        'settings' => [
            'join_before_host' => true,
            'waiting_room' => false,
            'approval_type' => 2,
            'audio' => 'both',
            'auto_recording' => 'none',
        ],
    ];
    if ($timezone !== '') {
        $payload['timezone'] = $timezone;
    }
    if ($agenda !== '') {
        $payload['agenda'] = $agenda;
    }
    if ($meetingId === '') {
        $payload['type'] = 2;
    }

    if ($meetingId !== '') {
        $updateResult = zoomRequest('PATCH', 'https://api.zoom.us/v2/meetings/' . rawurlencode($meetingId), $accessToken, $payload);
        if ($updateResult['status'] >= 400 || $updateResult['body'] === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Unable to update Zoom meeting.']);
            exit;
        }
        $fetchResult = zoomRequest('GET', 'https://api.zoom.us/v2/meetings/' . rawurlencode($meetingId), $accessToken);
        if ($fetchResult['status'] >= 400 || $fetchResult['body'] === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Unable to fetch Zoom meeting details.']);
            exit;
        }
        $meetingData = json_decode($fetchResult['body'], true);
    } else {
        $createResult = zoomRequest('POST', 'https://api.zoom.us/v2/users/me/meetings', $accessToken, $payload);
        if ($createResult['status'] >= 400 || $createResult['body'] === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Unable to create Zoom meeting.']);
            exit;
        }
        $meetingData = json_decode($createResult['body'], true);
    }

    if (!is_array($meetingData)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Invalid Zoom response.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'meeting' => [
            'meeting_id' => $meetingData['id'] ?? $meetingId,
            'join_url' => $meetingData['join_url'] ?? '',
            'start_url' => $meetingData['start_url'] ?? '',
            'topic' => $meetingData['topic'] ?? $topic,
            'start_time' => $meetingData['start_time'] ?? $startTime,
            'timezone' => $meetingData['timezone'] ?? $timezone,
            'host_email' => $meetingData['host_email'] ?? $zoomEmail,
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
?>
