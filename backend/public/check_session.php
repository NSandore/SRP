<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (isset($_SESSION['user_id'])) {
    $userId = normalizeId($_SESSION['user_id']);
    $allowMessagesFrom = 'everyone';
    $sessionId = session_id();
    $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device', 0, 255);
    $ipAddress = substr(
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
        0,
        45
    );
    $sessionTimeoutMinutes = 30;

    try {
        $db = getDB();

        // Load account settings for timeout and DM preference
        $settingsStmt = $db->prepare("
            SELECT 
                JSON_UNQUOTE(JSON_EXTRACT(extras, '$.allow_messages_from')) AS allow_messages_from,
                session_timeout_minutes
            FROM account_settings
            WHERE user_id = :uid
        ");
        $settingsStmt->execute([':uid' => $userId]);
        $settings = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if (!empty($settings['allow_messages_from'])) {
            $allowMessagesFrom = $settings['allow_messages_from'];
        }
        if (isset($settings['session_timeout_minutes'])) {
            $sessionTimeoutMinutes = max(5, min(1440, (int)$settings['session_timeout_minutes']));
        }

        // Validate current session is not revoked and not expired
        $sessionCheck = $db->prepare("
            SELECT last_active_at, revoked_at FROM user_sessions WHERE session_id = :sid AND user_id = :uid LIMIT 1
        ");
        $sessionCheck->execute([':sid' => $sessionId, ':uid' => $userId]);
        $sessionRow = $sessionCheck->fetch(PDO::FETCH_ASSOC);
        $now = time();
        if ($sessionRow) {
            if ($sessionRow['revoked_at'] !== null) {
                session_destroy();
                echo json_encode(["loggedIn" => false]);
                exit;
            }
            $lastActiveTs = strtotime($sessionRow['last_active_at']);
            if ($lastActiveTs !== false && ($now - $lastActiveTs) > ($sessionTimeoutMinutes * 60)) {
                // Expire session
                $expireStmt = $db->prepare("UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = :sid AND user_id = :uid");
                $expireStmt->execute([':sid' => $sessionId, ':uid' => $userId]);
                session_destroy();
                echo json_encode(["loggedIn" => false, "reason" => "session_timeout"]);
                exit;
            }
        }

        // Upsert session footprint
        $sessionStmt = $db->prepare("
            INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, last_active_at)
            VALUES (:sid, :uid, :ua, :ip, NOW(), NOW())
            ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent), ip_address = VALUES(ip_address), last_active_at = NOW()
        ");
        $sessionStmt->execute([
            ':sid' => $sessionId,
            ':uid' => $userId,
            ':ua' => $userAgent,
            ':ip' => $ipAddress,
        ]);

        // Update presence
        $presenceStmt = $db->prepare("
            INSERT INTO account_settings (user_id, extras, updated_at)
            VALUES (:uid, JSON_SET(JSON_OBJECT(), '$.last_seen_at', NOW()), NOW())
            ON DUPLICATE KEY UPDATE
                extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.last_seen_at', NOW()),
                updated_at = NOW()
        ");
        $presenceStmt->execute([':uid' => $userId]);

        // Fetch DM preference
        $dmStmt = $db->prepare("
            SELECT JSON_UNQUOTE(JSON_EXTRACT(extras, '$.allow_messages_from')) AS allow_messages_from
            FROM account_settings
            WHERE user_id = :uid
        ");
        $dmStmt->execute([':uid' => $userId]);
        $allowMessagesFrom = $dmStmt->fetchColumn() ?: 'everyone';
    } catch (PDOException $e) {
        error_log('Unable to update presence: ' . $e->getMessage());
    }

    echo json_encode([
        "loggedIn" => true,
        "user" => [
            "user_id" => $userId,
            "first_name" => $_SESSION['first_name'],
            "last_name" => $_SESSION['last_name'],
            "email" => $_SESSION['email'],
            "role_id" => $_SESSION['role_id'],
            "avatar_path" => appendAvatarPath($_SESSION['avatar_path'] ?? null),
            "is_ambassador" => $_SESSION['is_ambassador'],
            "login_count" => $_SESSION['login_count'],
            "is_public" => $_SESSION['is_public'],
            "admin_community_ids" => $_SESSION['admin_community_ids'] ?? [],
            "allow_messages_from" => $allowMessagesFrom,
        ]
    ]);
} else {
    echo json_encode(["loggedIn" => false]);
}
?>
