<?php
function startSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $headerSessionId = $_SERVER['HTTP_X_SESSION_ID'] ?? '';
    $querySessionId = $_GET['session_id'] ?? '';
    $incomingSessionId = $headerSessionId !== '' ? $headerSessionId : $querySessionId;
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

    session_set_cookie_params($params);
    session_start();
}
