<?php
function startSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Load deployment configuration before deriving cookie security. Many
    // endpoints intentionally call startSession() before including their own
    // database dependencies.
    require_once __DIR__ . '/db_connection.php';

    // Browsers send Origin on state-changing cross-origin requests. Reject a
    // mismatched host before touching session state; native clients normally
    // omit Origin and authenticate with X-Session-Id instead.
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) && $origin !== '') {
        $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?: ''));
        $requestHost = strtolower(explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]);
        if ($originHost === '' || $requestHost === '' || !hash_equals($requestHost, $originHost)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Cross-origin request rejected.']);
            exit;
        }
    }

    // Native clients authenticate with a header. Never accept bearer session
    // identifiers in URLs, where they leak into logs, history, and analytics.
    $incomingSessionId = $_SERVER['HTTP_X_SESSION_ID'] ?? '';
    if ($incomingSessionId !== '') {
        $incomingSessionId = preg_replace('/[^a-zA-Z0-9,-]/', '', (string)$incomingSessionId);
        if ($incomingSessionId !== '') {
            session_id($incomingSessionId);
        }
    }

    $appBase = getenv('APP_BASE_URL') ?: '';
    $host = '';
    if ($appBase !== '') {
        $parts = parse_url($appBase);
        $host = $parts['host'] ?? '';
    }
    if ($host === '') {
        $serverHost = $_SERVER['HTTP_HOST'] ?? '';
        $host = explode(':', $serverHost)[0];
    }

    $secure = false;
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $secure = true;
    } elseif ($appBase !== '' && stripos($appBase, 'https://') === 0) {
        $secure = true;
    }

    $params = [
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    $isIp = $host !== '' && filter_var($host, FILTER_VALIDATE_IP) !== false;
    if ($host !== '' && $host !== 'localhost' && !$isIp) {
        $params['domain'] = $host;
    }

    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params($params);
    session_start();

    // Enforce server-side revocation, inactivity expiry, and current roles for
    // every authenticated endpoint that uses the shared session bootstrap.
    if (!empty($_SESSION['user_id'])) {
        $userId = normalizeId($_SESSION['user_id']);
        $valid = false;
        try {
            $db = getDB();
            $stmt = $db->prepare("
                SELECT us.revoked_at,
                       TIMESTAMPDIFF(SECOND, us.last_active_at, NOW()) AS inactive_seconds,
                       COALESCE(s.session_timeout_minutes, 30) AS timeout_minutes,
                       u.role_id
                FROM user_sessions us
                JOIN users u ON u.user_id = us.user_id
                LEFT JOIN account_settings s ON s.user_id = us.user_id
                WHERE us.session_id = :sid AND us.user_id = :uid
                LIMIT 1
            ");
            $stmt->execute([':sid' => session_id(), ':uid' => $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $timeout = max(5, min(1440, (int)($row['timeout_minutes'] ?? 30)));
            $valid = $row
                && $row['revoked_at'] === null
                && (int)($row['inactive_seconds'] ?? PHP_INT_MAX) <= ($timeout * 60);

            if ($valid) {
                $_SESSION['role_id'] = (int)$row['role_id'];
                $touch = $db->prepare('UPDATE user_sessions SET last_active_at = NOW() WHERE session_id = :sid AND user_id = :uid');
                $touch->execute([':sid' => session_id(), ':uid' => $userId]);
            } elseif ($row && $row['revoked_at'] === null) {
                $revoke = $db->prepare('UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = :sid AND user_id = :uid');
                $revoke->execute([':sid' => session_id(), ':uid' => $userId]);
            }
        } catch (Throwable $e) {
            error_log('[SRP] session validation failed closed: ' . $e->getMessage());
        }

        if (!$valid) {
            $_SESSION = [];
        }
    }
}
