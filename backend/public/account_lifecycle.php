<?php
declare(strict_types=1);

require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/account_deletion.php';
require_once __DIR__ . '/../includes/rate_limit.php';

header('Content-Type: application/json');

function lifecycle_response(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = normalizeId($_SESSION['user_id'] ?? '');
    if ($userId === '') lifecycle_response(['success' => false, 'error' => 'Unauthorized'], 401);
    $db = getDB();
    $stmt = $db->prepare("SELECT deletion_status, scheduled_purge_at FROM users WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    lifecycle_response(['success' => true, 'deletion' => srp_account_deletion_summary($user ?: [])]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    lifecycle_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = trim((string)($input['action'] ?? ''));
$password = (string)($input['password'] ?? '');
$confirmation = trim((string)($input['confirmation'] ?? ''));

try {
    $db = getDB();
    srp_rate_limit_enforce($db, 'account-lifecycle:' . srp_client_ip(), 8, 900,
        'Too many account requests. Please wait and try again.');

    if ($action === 'request_deletion') {
        if ($confirmation !== 'DELETE MY ACCOUNT') {
            lifecycle_response(['success' => false, 'error' => 'Type DELETE MY ACCOUNT to confirm.'], 400);
        }
        $userId = normalizeId($_SESSION['user_id'] ?? '');
        if ($userId === '') lifecycle_response(['success' => false, 'error' => 'Unauthorized'], 401);
        $stmt = $db->prepare("SELECT * FROM users WHERE user_id = :uid LIMIT 1 FOR UPDATE");
        $db->beginTransaction();
        $stmt->execute([':uid' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            $db->rollBack();
            lifecycle_response(['success' => false, 'error' => 'Your current password is incorrect.'], 403);
        }
        if (($user['deletion_status'] ?? 'active') !== 'active') {
            $db->rollBack();
            lifecycle_response(['success' => false, 'error' => 'This account already has a deletion request.'], 409);
        }
        $summary = srp_request_account_deletion($db, $user, srp_client_ip());
        $db->commit();
        session_unset();
        session_destroy();
        lifecycle_response([
            'success' => true,
            'message' => 'Your account is hidden and scheduled for deletion.',
            'deletion' => $summary,
        ]);
    }

    if (!in_array($action, ['recover', 'force_delete'], true)) {
        lifecycle_response(['success' => false, 'error' => 'Unknown action'], 400);
    }
    if ($action === 'force_delete' && $confirmation !== 'DELETE NOW') {
        lifecycle_response(['success' => false, 'error' => 'Type DELETE NOW to confirm permanent deletion.'], 400);
    }
    $email = strtolower(trim((string)($input['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        lifecycle_response(['success' => false, 'error' => 'Email and previous password are required.'], 400);
    }
    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1 FOR UPDATE");
    $db->beginTransaction();
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        $db->rollBack();
        lifecycle_response(['success' => false, 'error' => 'The previous account password is incorrect.'], 403);
    }
    if (($user['deletion_status'] ?? 'active') !== 'pending') {
        $db->rollBack();
        lifecycle_response(['success' => false, 'error' => 'This account is not awaiting deletion.'], 409);
    }
    if ($action === 'recover') {
        srp_recover_account($db, $user);
        $db->commit();
        lifecycle_response(['success' => true, 'message' => 'Your account has been restored. You can sign in now.']);
    }
    srp_purge_account($db, $user, true);
    $db->commit();
    lifecycle_response([
        'success' => true,
        'message' => 'The account was permanently deleted. This email can now create a new account.',
    ]);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) $db->rollBack();
    error_log('[SRP] account lifecycle failed: ' . $e->getMessage());
    lifecycle_response(['success' => false, 'error' => 'Unable to complete the account request.'], 500);
}
