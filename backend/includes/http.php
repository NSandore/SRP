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
 * Emits 401 and exits when not logged in, or when the session has been
 * explicitly revoked (logout elsewhere, password reset, admin action).
 *
 * This is a centralized revocation check: any endpoint that calls this
 * helper (via srp_bootstrap or directly) gets it automatically, even before
 * every legacy endpoint is migrated onto the shared bootstrap.
 */
function srp_require_login(): string {
    if (!isset($_SESSION['user_id'])) {
        srp_json(['success' => false, 'error' => 'You must be logged in.'], 401);
    }
    $userId = normalizeId($_SESSION['user_id']);

    try {
        $db = getDB();
        $stmt = $db->prepare('SELECT revoked_at FROM user_sessions WHERE session_id = :sid AND user_id = :uid LIMIT 1');
        $stmt->execute([':sid' => session_id(), ':uid' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['revoked_at'] !== null) {
            session_unset();
            session_destroy();
            srp_json(['success' => false, 'error' => 'Your session has been revoked. Please log in again.'], 401);
        }
    } catch (Throwable $e) {
        // No user_sessions row yet (normal right after login, before
        // check_session.php first runs) or a transient DB error — fail
        // open here rather than lock out every request; a real DB outage
        // will surface clearly from the endpoint's own getDB() call.
    }

    return $userId;
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
