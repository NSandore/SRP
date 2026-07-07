<?php
/**
 * Password reset via emailed one-time code.
 *
 * Two-step, rate-limited flow (the previous version reset ANY account given
 * only an email + new password, which was a full account-takeover hole):
 *   1. POST { email }                       -> emails a 6-digit code
 *   2. POST { email, code, new_password }   -> verifies the code, sets password
 *
 * Responses to step 1 are intentionally generic to avoid revealing whether an
 * email is registered.
 */
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../includes/rate_limit.php';
require_once __DIR__ . '/../vendor/autoload.php';

use MailerSend\MailerSend;
use MailerSend\Helpers\Builder\Recipient;
use MailerSend\Helpers\Builder\EmailParams;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$email = isset($input['email']) ? trim($input['email']) : '';
$code = isset($input['code']) ? trim((string)$input['code']) : '';
$newPassword = isset($input['new_password']) ? (string)$input['new_password'] : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A valid email is required.']);
    exit;
}

try {
    $db = getDB();
    $ip = srp_client_ip();

    $stmt = $db->prepare('SELECT user_id, first_name, last_name FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ---- Step 1: request a reset code ----
    if ($code === '') {
        // Throttle code requests per email + IP.
        srp_rate_limit_enforce($db, 'pwreset:req:' . strtolower($email) . ':' . $ip, 5, 900,
            'Too many reset requests. Please wait a few minutes.');

        if ($user) {
            $resetCode = (string)random_int(100000, 999999);
            $extras = srp_get_account_settings_extras($db, $user['user_id']);
            $extras['reset_code'] = $resetCode;
            $extras['reset_expires_at'] = (new DateTime('+15 minutes'))->format('Y-m-d H:i:s');
            srp_save_account_settings_extras($db, $user['user_id'], $extras);

            $apiKey = getenv('MAILERSEND_API_KEY');
            $fromEmail = getenv('MAILERSEND_FROM_EMAIL');
            $fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';
            if ($apiKey && $fromEmail) {
                try {
                    $mailersend = new MailerSend(['api_key' => $apiKey]);
                    $recipients = [new Recipient($email, trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')))];
                    $emailParams = (new EmailParams())
                        ->setFrom($fromEmail)
                        ->setFromName($fromName)
                        ->setRecipients($recipients)
                        ->setSubject('Your StudentSphere password reset code')
                        ->setText("Your password reset code is {$resetCode}. It expires in 15 minutes. If you did not request this, ignore this email.")
                        ->setHtml("<p>Your password reset code is <strong>{$resetCode}</strong>. It expires in 15 minutes.</p><p>If you did not request this, you can ignore this email.</p>");
                    $mailersend->email->send($emailParams);
                } catch (Throwable $e) {
                    error_log('[SRP] reset email failed: ' . $e->getMessage());
                }
            }
        }

        // Same response whether or not the account exists (no user enumeration).
        echo json_encode([
            'success' => true,
            'requires_code' => true,
            'message' => 'If that email is registered, a reset code has been sent.',
        ]);
        exit;
    }

    // ---- Step 2: verify code and set the new password ----
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters.']);
        exit;
    }

    // Throttle verification attempts per email + IP.
    srp_rate_limit_enforce($db, 'pwreset:verify:' . strtolower($email) . ':' . $ip, 6, 900,
        'Too many attempts. Please request a new code.');

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset code.']);
        exit;
    }

    $extras = srp_get_account_settings_extras($db, $user['user_id']);
    $storedCode = isset($extras['reset_code']) ? (string)$extras['reset_code'] : '';
    $expiresAt = isset($extras['reset_expires_at']) ? strtotime((string)$extras['reset_expires_at']) : false;

    if ($storedCode === '' || $expiresAt === false || $expiresAt < time() || !hash_equals($storedCode, $code)) {
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset code.']);
        exit;
    }

    $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
    $update = $db->prepare('UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id');
    $update->execute([':password_hash' => $hashed, ':user_id' => $user['user_id']]);

    // Invalidate the used code.
    unset($extras['reset_code'], $extras['reset_expires_at']);
    srp_save_account_settings_extras($db, $user['user_id'], $extras);

    echo json_encode(['success' => true, 'message' => 'Password updated. You can now log in.']);
} catch (PDOException $e) {
    error_log('[SRP] reset_password error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'A server error occurred.']);
}
