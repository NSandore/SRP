<?php
/**
 * Lightweight database-backed rate limiter.
 *
 * Used to throttle abuse-prone endpoints (login, registration, password
 * reset, 2FA verification). Not a substitute for a real WAF, but stops naive
 * credential-stuffing and code brute-forcing.
 */

require_once __DIR__ . '/../db_connection.php';

function srp_ensure_rate_limit_table(PDO $db): void {
    static $ensured = false;
    if ($ensured) {
        return;
    }
    $db->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
            rl_key VARCHAR(191) NOT NULL,
            window_start INT NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            PRIMARY KEY (rl_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $ensured = true;
}

/**
 * Record one hit against $key and report whether the caller is still within
 * the allowed budget of $maxAttempts per $windowSeconds.
 *
 * @return bool True when the request is allowed, false when the limit is exceeded.
 */
function srp_rate_limit_check(PDO $db, string $key, int $maxAttempts, int $windowSeconds): bool {
    try {
        srp_ensure_rate_limit_table($db);
        $now = time();
        $windowStart = $now - ($now % max(1, $windowSeconds));
        $key = substr($key, 0, 191);

        // Attempts reset to 1 when a new window begins, otherwise increment.
        $stmt = $db->prepare("
            INSERT INTO rate_limits (rl_key, window_start, attempts)
            VALUES (:k, :ws, 1)
            ON DUPLICATE KEY UPDATE
                attempts = IF(window_start = VALUES(window_start), attempts + 1, 1),
                window_start = VALUES(window_start)
        ");
        $stmt->execute([':k' => $key, ':ws' => $windowStart]);

        $countStmt = $db->prepare("SELECT attempts FROM rate_limits WHERE rl_key = :k LIMIT 1");
        $countStmt->execute([':k' => $key]);
        $attempts = (int)$countStmt->fetchColumn();

        return $attempts <= $maxAttempts;
    } catch (Throwable $e) {
        // Never let the limiter itself take an endpoint down.
        error_log('[SRP] rate limiter error: ' . $e->getMessage());
        return true;
    }
}

/**
 * Enforce a limit; emits a 429 JSON response and exits when exceeded.
 * Assumes a JSON Content-Type has already been set by the caller.
 */
function srp_rate_limit_enforce(PDO $db, string $key, int $maxAttempts, int $windowSeconds, string $message = 'Too many attempts. Please wait a moment and try again.'): void {
    if (!srp_rate_limit_check($db, $key, $maxAttempts, $windowSeconds)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => $message]);
        exit;
    }
}
