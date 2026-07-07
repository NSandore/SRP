<?php
/**
 * Shared HTTP/auth helpers for API endpoints.
 *
 * These consolidate the boilerplate every endpoint repeats (JSON header,
 * session start, auth gate). New endpoints should prefer these helpers; the
 * existing ~140 endpoints can be migrated to them incrementally.
 *
 * Example:
 *   require_once __DIR__ . '/../includes/http.php';
 *   [$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);
 */

require_once __DIR__ . '/../session_bootstrap.php';
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/roles.php';
require_once __DIR__ . '/permissions.php';

/**
 * Emit a JSON payload and stop.
 */
function srp_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Require an authenticated session; returns the normalized user id.
 * Emits 401 and exits when not logged in.
 */
function srp_require_login(): string {
    if (!isset($_SESSION['user_id'])) {
        srp_json(['success' => false, 'error' => 'You must be logged in.'], 401);
    }
    return normalizeId($_SESSION['user_id']);
}

/**
 * Require at least the given global role level. Emits 403 when insufficient.
 */
function srp_require_role(int $minRole): void {
    $role = (int)($_SESSION['role_id'] ?? 0);
    if ($role < $minRole) {
        srp_json(['success' => false, 'error' => 'You do not have permission to do that.'], 403);
    }
}

/**
 * One-call endpoint preamble. Starts the session, sets JSON output, opens the
 * DB, and (optionally) enforces auth.
 *
 * @return array{0: PDO, 1: string, 2: int}  [$db, $userId, $roleId]
 */
function srp_bootstrap(bool $requireAuth = false): array {
    startSession();
    header('Content-Type: application/json');
    $userId = $requireAuth ? srp_require_login() : (isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '');
    $roleId = (int)($_SESSION['role_id'] ?? 0);
    try {
        $db = getDB();
    } catch (Throwable $e) {
        srp_safe_error('A database error occurred.', $e);
    }
    return [$db, $userId, $roleId];
}
