<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/onboarding.php';
require __DIR__ . '/../vendor/autoload.php';

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use Mailgun\Mailgun;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);
if (!is_array($inputData)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$required = ['firstName', 'lastName', 'email', 'password'];
foreach ($required as $field) {
    if (empty($inputData[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "{$field} is required"]);
        exit;
    }
}

$firstName = trim((string)$inputData['firstName']);
$lastName = trim((string)$inputData['lastName']);
$email = trim((string)$inputData['email']);
$phone = trim((string)($inputData['phone'] ?? ''));
$passwordHash = password_hash((string)$inputData['password'], PASSWORD_BCRYPT);
$enableTwoFactor = isset($inputData['enable_two_factor']) ? (int)filter_var($inputData['enable_two_factor'], FILTER_VALIDATE_BOOLEAN) : 0;
$devMode = srp_is_dev_mode();
$disableTwoFactor = (int)filter_var(getenv('DISABLE_TWO_FACTOR') ?: 0, FILTER_VALIDATE_BOOLEAN);
$effectiveTwoFactor = ($devMode || $disableTwoFactor) ? 0 : $enableTwoFactor;
$skipEmailVerification = false;
$emailSent = false;
$verificationCode = random_int(100000, 999999);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address']);
    exit;
}

try {
    $db = getDB();
    srp_ensure_onboarding_tables($db);
    $db->beginTransaction();

    $checkStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email LIMIT 1");
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetchColumn()) {
        $db->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Email already registered']);
        exit;
    }

    $roleStmt = $db->prepare("
        SELECT role_id
        FROM roles
        WHERE LOWER(role_name) = 'member'
        LIMIT 1
    ");
    $roleStmt->execute();
    $roleId = (int)$roleStmt->fetchColumn();
    if ($roleId <= 0) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Default member role missing']);
        exit;
    }

    $userId = generateUniqueId($db, 'users');
    $isVerified = 0;

    $insertUser = $db->prepare("
        INSERT INTO users (
            user_id, role_id, first_name, last_name, email, phone, password_hash,
            verification_code, is_verified, avatar_path, banner_path, education_status
        ) VALUES (
            :user_id, :role_id, :first_name, :last_name, :email, :phone, :password_hash,
            :verification_code, :is_verified, :avatar_path, :banner_path, :education_status
        )
    ");
    $insertUser->execute([
        ':user_id' => $userId,
        ':role_id' => $roleId,
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => $phone !== '' ? $phone : null,
        ':password_hash' => $passwordHash,
        ':verification_code' => $verificationCode,
        ':is_verified' => $isVerified,
        ':avatar_path' => 'DefaultAvatar.png',
        ':banner_path' => 'DefaultBanner.jpeg',
        ':education_status' => 'Prospect',
    ]);

    $wizardState = srp_default_onboarding_state();
    if ($isVerified) {
        srp_mark_step_complete($wizardState, 1);
    }

    $extras = [
        'two_factor_enabled' => $effectiveTwoFactor,
        'auto_join_campus' => 1,
        'onboarding' => $wizardState,
    ];

    $settingsStmt = $db->prepare("
        INSERT INTO account_settings (user_id, extras, updated_at)
        VALUES (:uid, :extras, NOW())
        ON DUPLICATE KEY UPDATE
            extras = :extras,
            updated_at = NOW()
    ");
    $settingsStmt->execute([
        ':uid' => $userId,
        ':extras' => json_encode($extras, JSON_UNESCAPED_SLASHES),
    ]);

    $mailgunApiKey = getenv('MAILGUN_API_KEY');
    if ($mailgunApiKey) {
        $mailgunDomain = getenv('MAILGUN_DOMAIN') ?: 'sandbox4223236740f0414e949fd59ca1a63257.mailgun.org';
        $fromEmail = "StudentSphere <postmaster@{$mailgunDomain}>";

        try {
            $mg = Mailgun::create($mailgunApiKey);
            $mg->messages()->send($mailgunDomain, [
                'from' => $fromEmail,
                'to' => "{$firstName} {$lastName} <{$email}>",
                'subject' => 'StudentSphere email verification code',
                'text' => "Your StudentSphere verification code is {$verificationCode}.",
                'html' => "<p>Your StudentSphere verification code is <strong>{$verificationCode}</strong>.</p>"
            ]);
            $emailSent = true;
        } catch (Throwable $mailError) {
            $emailSent = false;
        }
    }

    $_SESSION['user_id'] = $userId;
    $_SESSION['first_name'] = $firstName;
    $_SESSION['last_name'] = $lastName;
    $_SESSION['email'] = $email;
    $_SESSION['role_id'] = $roleId;
    $_SESSION['avatar_path'] = appendAvatarPath('DefaultAvatar.png');
    $_SESSION['banner_path'] = appendBannerPath('DefaultBanner.jpeg');
    $_SESSION['is_ambassador'] = 0;
    $_SESSION['login_count'] = 0;
    $_SESSION['is_public'] = 1;
    $_SESSION['admin_community_ids'] = [];

    $sessionId = session_id();
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device', 0, 255);
    $ipAddress = substr(
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
        0,
        45
    );
    $sessionStmt = $db->prepare("
        INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, last_active_at)
        VALUES (:sid, :uid, :ua, :ip, NOW(), NOW())
        ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent), ip_address = VALUES(ip_address), last_active_at = NOW(), revoked_at = NULL
    ");
    $sessionStmt->execute([
        ':sid' => $sessionId,
        ':uid' => $userId,
        ':ua' => $userAgent,
        ':ip' => $ipAddress,
    ]);

    $db->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Account created. Verification code generated.',
        'user' => [
            'user_id' => $userId,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'role_id' => $roleId,
            'avatar_path' => appendAvatarPath('DefaultAvatar.png'),
            'banner_path' => appendBannerPath('DefaultBanner.jpeg'),
            'is_ambassador' => 0,
            'login_count' => 0,
            'is_public' => 1,
            'is_verified' => $isVerified,
            'education_status' => 'Prospect',
            'admin_community_ids' => [],
        ],
        'wizard' => $wizardState,
        'email_verification_skipped' => false,
        'email_sent' => $emailSent,
        'dev_mode' => $devMode,
    ]);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create account']);
}
