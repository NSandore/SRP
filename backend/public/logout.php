<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';

// Revoke the server-side session record too, not just the local PHP
// session — otherwise a copy of this session id (e.g. leaked via the
// mobile client's URL-based transport) would remain usable after logout on
// any endpoint that consults user_sessions.
if (isset($_SESSION['user_id'])) {
    try {
        $db = getDB();
        $stmt = $db->prepare("UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = :sid AND user_id = :uid AND revoked_at IS NULL");
        $stmt->execute([':sid' => session_id(), ':uid' => normalizeId($_SESSION['user_id'])]);
    } catch (Throwable $e) {
        error_log('[SRP] logout revocation failed: ' . $e->getMessage());
    }
}

session_unset();
session_destroy();

// Send a JSON response indicating success
header('Content-Type: application/json');
echo json_encode(["success" => true]);
exit;
?>
