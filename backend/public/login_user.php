<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once '../db_connection.php';
require_once __DIR__ . '/../vendor/autoload.php';

use MailerSend\MailerSend;
use MailerSend\Helpers\Builder\Recipient;
use MailerSend\Helpers\Builder\EmailParams;

$data = json_decode(file_get_contents('php://input'), true);

$email = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? trim($data['password']) : '';

if (empty($email) || empty($password)) {
    echo json_encode(["error" => "Email and password are required."]);
    exit;
}

try {
    $db = getDB();

    $query = "SELECT user_id, first_name, last_name, email, password_hash, role_id, avatar_path, banner_path, is_ambassador, login_count, is_public, is_verified FROM users WHERE email = :email LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password_hash'])) {
        $devMode = srp_is_dev_mode();
        if (!$devMode && !(int)$user['is_verified']) {
            http_response_code(403);
            echo json_encode([
                "error" => "Please verify your email before logging in.",
                "requires_verification" => true,
                "user_id" => $user['user_id'],
                "email" => $user['email']
            ]);
            exit;
        }

        $sessionId = session_id();
        $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device', 0, 255);
        $ipAddress = substr(
            $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            0,
            45
        );

        $twoFactorEnabled = 0;
        $disableTwoFactor = (int)filter_var(getenv('DISABLE_TWO_FACTOR') ?: 0, FILTER_VALIDATE_BOOLEAN);
        $trustedDevicesRaw = null;
        $settingsStmt = $db->prepare("
            SELECT
                JSON_UNQUOTE(JSON_EXTRACT(extras, '$.two_factor_enabled')) AS two_factor_enabled,
                JSON_EXTRACT(extras, '$.trusted_devices') AS trusted_devices
            FROM account_settings
            WHERE user_id = :uid
            LIMIT 1
        ");
        $settingsStmt->execute([':uid' => $user['user_id']]);
        $settingsRow = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if (isset($settingsRow['two_factor_enabled'])) {
            $twoFactorEnabled = (int)filter_var($settingsRow['two_factor_enabled'], FILTER_VALIDATE_BOOLEAN);
        }
        if (array_key_exists('trusted_devices', $settingsRow)) {
            $trustedDevicesRaw = $settingsRow['trusted_devices'];
        }

        if ($twoFactorEnabled && !$disableTwoFactor && !$devMode) {
            $deviceHash = hash('sha256', $userAgent . '|' . $ipAddress);
            $trustedDevices = [];
            if ($trustedDevicesRaw) {
                $decoded = json_decode($trustedDevicesRaw, true);
                if (is_array($decoded)) {
                    $trustedDevices = $decoded;
                }
            }
            $isRecognized = false;
            foreach ($trustedDevices as $entry) {
                if (is_array($entry) && isset($entry['hash']) && $entry['hash'] === $deviceHash) {
                    $isRecognized = true;
                    break;
                }
                if (is_string($entry) && $entry === $deviceHash) {
                    $isRecognized = true;
                    break;
                }
            }
            if (!$isRecognized) {
                $code = (string)random_int(100000, 999999);
                $expiresAt = (new DateTime('+10 minutes'))->format('Y-m-d H:i:s');
                $storeStmt = $db->prepare("
                    INSERT INTO account_settings (user_id, extras, updated_at)
                    VALUES (:uid, JSON_SET(JSON_OBJECT(), '$.two_factor_code', :code, '$.two_factor_expires_at', :expires_at), NOW())
                    ON DUPLICATE KEY UPDATE
                        extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.two_factor_code', :code, '$.two_factor_expires_at', :expires_at),
                        updated_at = NOW()
                ");
                $storeStmt->execute([
                    ':uid' => $user['user_id'],
                    ':code' => $code,
                    ':expires_at' => $expiresAt,
                ]);

                $apiKey = getenv('MAILERSEND_API_KEY');
                $fromEmail = getenv('MAILERSEND_FROM_EMAIL');
                $fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';
                if (!$apiKey || !$fromEmail) {
                    http_response_code(500);
                    echo json_encode(["error" => "Email service is not configured."]);
                    exit;
                }

                try {
                    $mailersend = new MailerSend(['api_key' => $apiKey]);
                    $recipients = [new Recipient($user['email'], trim($user['first_name'] . ' ' . $user['last_name']))];
                    $emailParams = (new EmailParams())
                        ->setFrom($fromEmail)
                        ->setFromName($fromName)
                        ->setRecipients($recipients)
                        ->setSubject('Your StudentSphere login code')
                        ->setText("Your verification code is {$code}. It expires in 10 minutes.")
                        ->setHtml("<p>Your verification code is <strong>{$code}</strong>. It expires in 10 minutes.</p>");
                    $mailersend->email->send($emailParams);
                } catch (Throwable $e) {
                    error_log('MailerSend 2FA error: ' . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(["error" => "Unable to send verification code."]);
                    exit;
                }

                $_SESSION['pending_2fa_user_id'] = $user['user_id'];
                $_SESSION['pending_2fa_user_agent'] = $userAgent;
                $_SESSION['pending_2fa_ip'] = $ipAddress;

                echo json_encode([
                    "requires_two_factor" => true,
                    "message" => "Verification code sent."
                ]);
                exit;
            }
        }

        // Increment login_count by 1
        $updateStmt = $db->prepare("UPDATE users SET login_count = login_count + 1 WHERE user_id = :user_id");
        $updateStmt->execute([':user_id' => $user['user_id']]);
        $user['login_count'] = (int)$user['login_count'] + 1;

        unset($user['password_hash']); // Remove sensitive data

        // Normalize media paths for output/session
        $user['avatar_path'] = appendAvatarPath($user['avatar_path'] ?? null);
        if (isset($user['banner_path'])) {
            $user['banner_path'] = appendBannerPath($user['banner_path']);
        }

        // Set session variables
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['last_name'] = $user['last_name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role_id'] = $user['role_id'];
        $_SESSION['avatar_path'] = $user['avatar_path'];
        $_SESSION['banner_path'] = $user['banner_path'] ?? appendBannerPath(null);
        $_SESSION['is_ambassador'] = $user['is_ambassador'];
        $_SESSION['login_count'] = $user['login_count'];
        $_SESSION['is_public'] = $user['is_public'];

        // Fetch communities where this user is an ambassador admin
        $adminCommunities = [];
        $cStmt = $db->prepare("SELECT community_id FROM ambassadors WHERE user_id = :uid AND community_role = 'admin'");
        $cStmt->execute([':uid' => $user['user_id']]);
        $adminCommunities = $cStmt->fetchAll(PDO::FETCH_COLUMN);
        $_SESSION['admin_community_ids'] = $adminCommunities;
        $user['admin_community_ids'] = $adminCommunities;

        // Track this session
        $sessionStmt = $db->prepare("
            INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, last_active_at)
            VALUES (:sid, :uid, :ua, :ip, NOW(), NOW())
            ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent), ip_address = VALUES(ip_address), last_active_at = NOW(), revoked_at = NULL
        ");
        $sessionStmt->execute([
            ':sid' => $sessionId,
            ':uid' => $user['user_id'],
            ':ua' => $userAgent,
            ':ip' => $ipAddress,
        ]);

        echo json_encode([
            "success" => true,
            "user" => $user
        ]);
    } else {
        echo json_encode(["error" => "Invalid email or password."]);
    }
} catch (PDOException $e) {
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
