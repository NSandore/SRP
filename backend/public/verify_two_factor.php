<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

$data = json_decode(file_get_contents('php://input'), true);
$code = isset($data['code']) ? trim($data['code']) : '';
$rememberDevice = filter_var($data['remember_device'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$code) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Verification code is required.']);
    exit;
}

if (!isset($_SESSION['pending_2fa_user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No pending verification.']);
    exit;
}

$userId = normalizeId($_SESSION['pending_2fa_user_id']);
$userAgent = substr($_SESSION['pending_2fa_user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device'), 0, 255);
$ipAddress = substr(
    $_SESSION['pending_2fa_ip'] ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
    0,
    45
);
function buildTrustedDeviceEntry(string $userAgent, string $ipAddress): array {
    return [
        'hash' => hash('sha256', $userAgent . '|' . $ipAddress),
        'ip' => $ipAddress,
        'user_agent' => $userAgent,
        'added_at' => gmdate('c'),
    ];
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.two_factor_code')) AS code,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.two_factor_expires_at')) AS expires_at
        FROM account_settings
        WHERE user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $storedCode = $row['code'] ?? '';
    $expiresAt = $row['expires_at'] ?? '';
    if (!$storedCode || !$expiresAt) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Verification code not found.']);
        exit;
    }

    if (trim((string)$storedCode) !== $code) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Verification code incorrect.']);
        exit;
    }

    $expiresTs = strtotime($expiresAt);
    if ($expiresTs === false || $expiresTs < time()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Verification code expired.']);
        exit;
    }

    $extrasUpdateSql = "
        UPDATE account_settings
        SET extras = JSON_REMOVE(COALESCE(extras, JSON_OBJECT()), '$.two_factor_code', '$.two_factor_expires_at'),
            updated_at = NOW()
        WHERE user_id = :uid
    ";
    $extrasParams = [':uid' => $userId];

    if ($rememberDevice) {
        $trustedStmt = $db->prepare("
            SELECT JSON_EXTRACT(extras, '$.trusted_devices') AS trusted_devices
            FROM account_settings
            WHERE user_id = :uid
            LIMIT 1
        ");
        $trustedStmt->execute([':uid' => $userId]);
        $trustedRow = $trustedStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $trustedRaw = $trustedRow['trusted_devices'] ?? null;
        $trustedDevices = [];
        if ($trustedRaw) {
            $decoded = json_decode($trustedRaw, true);
            if (is_array($decoded)) {
                $trustedDevices = $decoded;
            }
        }
        $entry = buildTrustedDeviceEntry($userAgent, $ipAddress);
        $alreadyTrusted = false;
        foreach ($trustedDevices as $device) {
            if (is_array($device) && ($device['hash'] ?? '') === $entry['hash']) {
                $alreadyTrusted = true;
                break;
            }
            if (is_string($device) && $device === $entry['hash']) {
                $alreadyTrusted = true;
                break;
            }
        }
        if (!$alreadyTrusted) {
            $trustedDevices[] = $entry;
        }
        $extrasUpdateSql = "
            UPDATE account_settings
            SET extras = JSON_SET(
                JSON_REMOVE(COALESCE(extras, JSON_OBJECT()), '$.two_factor_code', '$.two_factor_expires_at'),
                '$.trusted_devices',
                CAST(:trusted_devices AS JSON)
            ),
            updated_at = NOW()
            WHERE user_id = :uid
        ";
        $extrasParams[':trusted_devices'] = json_encode($trustedDevices);
    }

    $clearStmt = $db->prepare($extrasUpdateSql);
    $clearStmt->execute($extrasParams);

    $userStmt = $db->prepare("
        SELECT user_id, first_name, last_name, email, role_id, avatar_path, banner_path, is_ambassador, login_count, is_public
        FROM users
        WHERE user_id = :uid
        LIMIT 1
    ");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found.']);
        exit;
    }

    $updateStmt = $db->prepare("UPDATE users SET login_count = login_count + 1 WHERE user_id = :user_id");
    $updateStmt->execute([':user_id' => $user['user_id']]);
    $user['login_count'] = (int)$user['login_count'] + 1;

    $user['avatar_path'] = appendAvatarPath($user['avatar_path'] ?? null);
    if (isset($user['banner_path'])) {
        $user['banner_path'] = appendBannerPath($user['banner_path']);
    }

    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['first_name'] = $user['first_name'];
    $_SESSION['last_name'] = $user['last_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role_id'] = $user['role_id'];
    $_SESSION['avatar_path'] = $user['avatar_path'];
    $_SESSION['banner_path'] = $user['banner_path'] ?? appendBannerPath(null);
    $_SESSION['is_ambassador'] = $user['is_ambassador'];
    $_SESSION['login_count'] = $user['login_count'];
    $_SESSION['is_public'] = $user['is_public'];

    // Fetch communities where this user is an ambassador admin
    $adminCommunities = [];
    $cStmt = $db->prepare("SELECT community_id FROM ambassadors WHERE user_id = :uid AND community_role = 'admin'");
    $cStmt->execute([':uid' => $user['user_id']]);
    $adminCommunities = $cStmt->fetchAll(PDO::FETCH_COLUMN);
    $_SESSION['admin_community_ids'] = $adminCommunities;
    $user['admin_community_ids'] = $adminCommunities;

    $sessionId = session_id();
    $sessionStmt = $db->prepare("
        INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, last_active_at)
        VALUES (:sid, :uid, :ua, :ip, NOW(), NOW())
        ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent), ip_address = VALUES(ip_address), last_active_at = NOW(), revoked_at = NULL
    ");
    $sessionStmt->execute([
        ':sid' => $sessionId,
        ':uid' => $user['user_id'],
        ':ua' => $userAgent,
        ':ip' => $ipAddress,
    ]);

    unset($_SESSION['pending_2fa_user_id'], $_SESSION['pending_2fa_user_agent'], $_SESSION['pending_2fa_ip']);

    echo json_encode(['success' => true, 'user' => $user]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
