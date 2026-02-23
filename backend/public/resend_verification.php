<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';
require __DIR__ . '/../vendor/autoload.php';

use Mailgun\Mailgun;

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

if ($userId === '') {
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

    $mailgunApiKey = getenv('MAILGUN_API_KEY');
    $emailSent = false;

    if ($mailgunApiKey) {
        $mailgunDomain = getenv('MAILGUN_DOMAIN') ?: 'sandbox4223236740f0414e949fd59ca1a63257.mailgun.org';
        $fromEmail = "StudentSphere <postmaster@{$mailgunDomain}>";

        try {
            $mg = Mailgun::create($mailgunApiKey);
            $mg->messages()->send($mailgunDomain, [
                'from' => $fromEmail,
                'to' => "{$user['first_name']} {$user['last_name']} <{$user['email']}>",
                'subject' => 'Your new StudentSphere verification code',
                'text' => "Here is your new verification code: {$verificationCode}. Enter this code to verify your email.",
                'html' => "<p>Here is your new verification code: <strong>{$verificationCode}</strong>.</p><p>Enter this code to verify your email.</p>"
            ]);
            $emailSent = true;
        } catch (\Throwable $e) {
            $emailSent = false;
        }
    }

    http_response_code(200);
    echo json_encode([
        'message' => $emailSent ? 'Verification email re-sent' : 'Verification code updated.',
        'email_sent' => $emailSent,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
