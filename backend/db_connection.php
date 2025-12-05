<?php
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
        'reports' => ['prefix' => 'rp', 'column' => 'report_id']
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
?>
