<?php
// Flip this to false to disable Dev mode safeguards.
const SRP_DEV_MODE = false;
function loadEnvFile(string $path): void {
    if (!is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        if ($key === '' || getenv($key) !== false) {
            continue;
        }
        if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")
        ) {
            $value = substr($value, 1, -1);
        }
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

// Load root .env for local/dev configuration.
loadEnvFile(__DIR__ . '/../.env');

function srp_is_dev_mode(): bool {
    if (defined('SRP_DEV_MODE')) {
        return SRP_DEV_MODE === false;
    }
    return (bool)filter_var(getenv('SRP_DEV_MODE') ?: 0, FILTER_VALIDATE_BOOLEAN);
}

function getDB() {
    static $db = null;
    if ($db === null) {
        $host = 'localhost';
        $dbname = 'srp_db';
        $user = 'srp_user';
        $pass = 'Silvia317*';

        $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ];

        $db = new PDO($dsn, $user, $pass, $options);
    }
    return $db;
}

/**
 * Returns the ID prefix and primary key column for a table.
 */
function getIdConfig(): array {
    return [
        'users' => ['prefix' => 'u', 'column' => 'user_id'],
        'communities' => ['prefix' => 'c', 'column' => 'id'],
        'forums' => ['prefix' => 'f', 'column' => 'forum_id'],
        'threads' => ['prefix' => 't', 'column' => 'thread_id'],
        'posts' => ['prefix' => 'p', 'column' => 'post_id'],
        'events' => ['prefix' => 'ev', 'column' => 'event_id'],
        'event_registrations' => ['prefix' => 'er', 'column' => 'id'],
        'messages' => ['prefix' => 'm', 'column' => 'message_id'],
        'notifications' => ['prefix' => 'n', 'column' => 'notification_id'],
        'connections' => ['prefix' => 'x', 'column' => 'connection_id'],
        'group_questions' => ['prefix' => 'q', 'column' => 'question_id'],
        'group_question_answers' => ['prefix' => 'a', 'column' => 'answer_id'],
        'community_creation_requests' => ['prefix' => 'r', 'column' => 'id'],
        'community_pins' => ['prefix' => 'p', 'column' => 'id'],
        'educational_experience' => ['prefix' => 'e', 'column' => 'id'],
        'community_admins' => ['prefix' => 'k', 'column' => 'id'],
        'account_settings' => ['prefix' => 's', 'column' => 'id'],
        'followed_communities' => ['prefix' => 'l', 'column' => 'id'],
        'user_follows' => ['prefix' => 'f', 'column' => 'id'],
        'saved_posts' => ['prefix' => 's', 'column' => 'id'],
        'saved_threads' => ['prefix' => 's', 'column' => 'id'],
        'saved_forums' => ['prefix' => 's', 'column' => 'id'],
        'forum_votes' => ['prefix' => 'v', 'column' => 'id'],
        'thread_votes' => ['prefix' => 'v', 'column' => 'id'],
        'post_votes' => ['prefix' => 'v', 'column' => 'id'],
        'tags' => ['prefix' => 'tg', 'column' => 'tag_id'],
        'thread_tags' => ['prefix' => 'tt', 'column' => 'id'],
        'forum_tags' => ['prefix' => 'ft', 'column' => 'id'],
        'user_interests' => ['prefix' => 'ui', 'column' => 'id'],
        'reports' => ['prefix' => 'rp', 'column' => 'report_id'],
        'announcements' => ['prefix' => 'an', 'column' => 'announcement_id']
    ];
}

/**
 * Generate a prefixed hash ID for a table.
 */
function generateId(string $table, int $bytes = 8): string {
    $config = getIdConfig();
    $prefix = $config[$table]['prefix'] ?? 'x';
    return $prefix . bin2hex(random_bytes($bytes));
}

/**
 * Generate a unique prefixed ID for a table/column combination.
 */
function generateUniqueId(PDO $db, string $table): string {
    $config = getIdConfig();
    if (!isset($config[$table])) {
        throw new InvalidArgumentException("Unknown table for ID generation: {$table}");
    }

    $column = $config[$table]['column'];
    $id = generateId($table);

    // Retry on the extremely rare chance of collision.
    while (true) {
        $stmt = $db->prepare("SELECT 1 FROM {$table} WHERE {$column} = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetchColumn()) {
            return $id;
        }
        $id = generateId($table);
    }
}

/**
 * Normalize any incoming identifier to a trimmed string.
 */
function normalizeId($value): string {
    return trim((string)$value);
}

/**
 * Ensure avatar filename is stored without uploads prefix; return with uploads prefix when needed.
 */
function appendAvatarPath(?string $value): string {
    $default = '/uploads/avatars/DefaultAvatar.png';
    if (!$value) {
        return $default;
    }
    if (strpos($value, '/uploads/') === 0) {
        return $value;
    }
    return '/uploads/avatars/' . ltrim($value, '/');
}

/**
 * Ensure banner filename is stored without uploads prefix; return with uploads prefix when needed.
 */
function appendBannerPath(?string $value): string {
    $default = '/uploads/banners/DefaultBanner.jpeg';
    if (!$value) {
        return $default;
    }
    if (strpos($value, '/uploads/') === 0) {
        return $value;
    }
    return '/uploads/banners/' . ltrim($value, '/');
}

/**
 * Strip any leading /uploads/.../ prefix before storing filenames in DB.
 */
function stripUploadPrefix(?string $value): ?string {
    if (!$value) {
        return $value;
    }
    return preg_replace('#^/uploads/(avatars|banners)/#', '', $value);
}

/**
 * Auto-follow sub-communities for users with auto-join enabled.
 */
function autoJoinCampusGroups(PDO $db, string $communityId, ?string $parentCommunityId, string $communityName, ?string $parentName, ?string $creatorUserId): void {
    if (!$parentCommunityId) {
        return;
    }

    $params = [':parent_id' => $parentCommunityId];
    $creatorFilter = '';
    if ($creatorUserId) {
        $creatorFilter = ' AND u.user_id <> :creator_id';
        $params[':creator_id'] = $creatorUserId;
    }

    $usersStmt = $db->prepare("
        SELECT u.user_id, u.first_name, u.last_name
        FROM users u
        LEFT JOIN account_settings s ON s.user_id = u.user_id
        WHERE u.recent_university_id = :parent_id
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.extras, '$.auto_join_campus')), '1') IN ('1', 'true')
          {$creatorFilter}
    ");
    $usersStmt->execute($params);
    $targets = $usersStmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$targets) {
        return;
    }

    $checkStmt = $db->prepare("
        SELECT 1 FROM followed_communities WHERE user_id = :uid AND community_id = :cid LIMIT 1
    ");
    $insertFollow = $db->prepare("
        INSERT INTO followed_communities (id, user_id, community_id)
        VALUES (:id, :uid, :cid)
    ");
    $insertNotif = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
        VALUES (:nid, :rid, :aid, :type, :ref, :message)
    ");

    $parentSuffix = $parentName ? " in {$parentName}" : '';
    $message = "You're now following a new community! {$communityName} just launched{$parentSuffix}. Drop in to introduce yourself and see what's new.";

    foreach ($targets as $user) {
        $uid = normalizeId($user['user_id']);
        if ($uid === '') {
            continue;
        }
        $checkStmt->execute([':uid' => $uid, ':cid' => $communityId]);
        if ($checkStmt->fetchColumn()) {
            continue;
        }
        $followId = generateUniqueId($db, 'followed_communities');
        $insertFollow->execute([
            ':id' => $followId,
            ':uid' => $uid,
            ':cid' => $communityId
        ]);

        $notificationId = generateUniqueId($db, 'notifications');
        $insertNotif->execute([
            ':nid' => $notificationId,
            ':rid' => $uid,
            ':aid' => $creatorUserId ?: $uid,
            ':type' => 'auto_follow',
            ':ref' => $communityId,
            ':message' => $message
        ]);
    }
}
?>
