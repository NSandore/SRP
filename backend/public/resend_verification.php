<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../includes/rate_limit.php';
require_once __DIR__ . '/../includes/email.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$sessionUserId = normalizeId($_SESSION['user_id'] ?? '');
$userId = normalizeId($input['user_id'] ?? $sessionUserId);
$email = isset($input['email']) ? trim((string)$input['email']) : null;

if ($sessionUserId === '' || $userId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit;
}

if ($sessionUserId !== '' && $sessionUserId !== $userId) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDB();
    srp_rate_limit_enforce(
        $db,
        'email-resend:' . $userId . ':' . srp_client_ip(),
        3,
        900,
        'Too many resend requests. Please wait before trying again.'
    );

    $stmt = $db->prepare("SELECT first_name, last_name, email, is_verified FROM users WHERE user_id = :uid");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    if (!empty($email) && strcasecmp($email, $user['email']) !== 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Email does not match our records']);
        exit;
    }

    if ((int)$user['is_verified'] === 1) {
        http_response_code(200);
        echo json_encode(['message' => 'User already verified']);
        exit;
    }

    $verificationCode = random_int(100000, 999999);
    $upStmt = $db->prepare("UPDATE users SET verification_code = :code WHERE user_id = :uid");
    $upStmt->execute([':code' => $verificationCode, ':uid' => $userId]);
    $extras = srp_get_account_settings_extras($db, $userId);
    $extras['email_verification_expires_at'] = gmdate('c', time() + 15 * 60);
    srp_save_account_settings_extras($db, $userId, $extras);

    $emailSent = false;
    try {
        srp_send_email(
            $user['email'],
            trim($user['first_name'] . ' ' . $user['last_name']),
            'Your new StudentSphere verification code',
            "Here is your new verification code: {$verificationCode}. It expires in 15 minutes.",
            "<p>Here is your new verification code: <strong>{$verificationCode}</strong>. It expires in 15 minutes.</p>"
        );
        $emailSent = true;
    } catch (Throwable $e) {
        error_log('[SRP] verification resend failed: ' . $e->getMessage());
    }

    http_response_code($emailSent ? 200 : 503);
    echo json_encode([
        'message' => $emailSent ? 'Verification email re-sent' : 'Email delivery is temporarily unavailable.',
        'email_sent' => $emailSent,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
