<?php
declare(strict_types=1);

const SRP_ACCOUNT_RECOVERY_DAYS = 30;

function srp_account_fingerprint(string $value): string {
    $key = (string)(getenv('APP_ENCRYPTION_KEY') ?: '');
    if ($key === '') {
        throw new RuntimeException('APP_ENCRYPTION_KEY is required for account deletion records.');
    }
    return hash_hmac('sha256', strtolower(trim($value)), $key);
}

function srp_account_deletion_summary(array $user): array {
    $scheduled = (string)($user['scheduled_purge_at'] ?? '');
    $seconds = $scheduled !== '' ? max(0, strtotime($scheduled . ' UTC') - time()) : 0;
    return [
        'status' => $user['deletion_status'] ?? 'active',
        'scheduled_purge_at' => $scheduled !== '' ? gmdate('c', strtotime($scheduled . ' UTC')) : null,
        'days_remaining' => $seconds > 0 ? (int)ceil($seconds / 86400) : 0,
        'can_force_delete' => ($user['deletion_status'] ?? '') === 'pending',
    ];
}

function srp_latest_open_deletion(PDO $db, string $userId): ?array {
    $stmt = $db->prepare("
        SELECT * FROM account_deletion_records
        WHERE user_id = :uid AND recovered_at IS NULL AND purged_at IS NULL
        ORDER BY requested_at DESC LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function srp_request_account_deletion(PDO $db, array $user, string $requestIp): array {
    $userId = normalizeId($user['user_id'] ?? '');
    if ($userId === '' || ($user['deletion_status'] ?? 'active') !== 'active') {
        throw new RuntimeException('This account is not eligible for a new deletion request.');
    }

    $requestedAt = gmdate('Y-m-d H:i:s');
    $scheduledAt = gmdate('Y-m-d H:i:s', time() + (SRP_ACCOUNT_RECOVERY_DAYS * 86400));
    $snapshot = [
        'first_name' => $user['first_name'] ?? '',
        'last_name' => $user['last_name'] ?? '',
        'avatar_path' => $user['avatar_path'] ?? 'DefaultAvatar.png',
        'banner_path' => $user['banner_path'] ?? 'DefaultBanner.jpeg',
        'is_public' => (int)($user['is_public'] ?? 1),
        'verified' => (int)($user['verified'] ?? 0),
        'verified_community_id' => $user['verified_community_id'] ?? null,
        'is_ambassador' => (int)($user['is_ambassador'] ?? 0),
    ];

    $recordId = generateUniqueId($db, 'account_deletion_records');
    $insert = $db->prepare("
        INSERT INTO account_deletion_records (
            deletion_id, user_id, email_fingerprint, request_ip_fingerprint,
            requested_at, scheduled_purge_at, recovery_snapshot
        ) VALUES (:id, :uid, :email_hash, :ip_hash, :requested, :scheduled, :snapshot)
    ");
    $insert->execute([
        ':id' => $recordId,
        ':uid' => $userId,
        ':email_hash' => srp_account_fingerprint((string)$user['email']),
        ':ip_hash' => $requestIp !== '' ? srp_account_fingerprint($requestIp) : null,
        ':requested' => $requestedAt,
        ':scheduled' => $scheduledAt,
        ':snapshot' => json_encode($snapshot, JSON_UNESCAPED_SLASHES),
    ]);

    $update = $db->prepare("
        UPDATE users SET
            first_name = 'Deleted', last_name = 'User',
            avatar_path = 'DefaultAvatar.png', banner_path = 'DefaultBanner.jpeg',
            is_public = 0, verified = 0, verified_community_id = NULL,
            is_ambassador = 0, deletion_status = 'pending',
            deletion_requested_at = :requested, scheduled_purge_at = :scheduled,
            fully_deleted_at = NULL
        WHERE user_id = :uid
    ");
    $update->execute([':requested' => $requestedAt, ':scheduled' => $scheduledAt, ':uid' => $userId]);

    $revoke = $db->prepare("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = :uid AND revoked_at IS NULL");
    $revoke->execute([':uid' => $userId]);

    return srp_account_deletion_summary([
        'deletion_status' => 'pending',
        'scheduled_purge_at' => $scheduledAt,
    ]);
}

function srp_recover_account(PDO $db, array $user): void {
    $userId = normalizeId($user['user_id'] ?? '');
    $record = srp_latest_open_deletion($db, $userId);
    if (!$record || ($user['deletion_status'] ?? '') !== 'pending') {
        throw new RuntimeException('This account is not awaiting deletion.');
    }
    if (strtotime((string)$record['scheduled_purge_at'] . ' UTC') <= time()) {
        throw new RuntimeException('The recovery window has ended.');
    }
    $snapshot = json_decode((string)($record['recovery_snapshot'] ?? '{}'), true) ?: [];
    $update = $db->prepare("
        UPDATE users SET first_name = :first_name, last_name = :last_name,
            avatar_path = :avatar, banner_path = :banner, is_public = :is_public,
            verified = :verified, verified_community_id = :verified_community_id,
            is_ambassador = :is_ambassador,
            deletion_status = 'active', deletion_requested_at = NULL,
            scheduled_purge_at = NULL, fully_deleted_at = NULL
        WHERE user_id = :uid
    ");
    $update->execute([
        ':first_name' => (string)($snapshot['first_name'] ?? 'Member'),
        ':last_name' => (string)($snapshot['last_name'] ?? ''),
        ':avatar' => (string)($snapshot['avatar_path'] ?? 'DefaultAvatar.png'),
        ':banner' => (string)($snapshot['banner_path'] ?? 'DefaultBanner.jpeg'),
        ':is_public' => (int)($snapshot['is_public'] ?? 1),
        ':verified' => (int)($snapshot['verified'] ?? 0),
        ':verified_community_id' => $snapshot['verified_community_id'] ?? null,
        ':is_ambassador' => (int)($snapshot['is_ambassador'] ?? 0),
        ':uid' => $userId,
    ]);
    $close = $db->prepare("UPDATE account_deletion_records SET recovered_at = NOW(), recovery_snapshot = NULL WHERE deletion_id = :id");
    $close->execute([':id' => $record['deletion_id']]);
}

function srp_purge_account(PDO $db, array $user, bool $forced = false): void {
    $userId = normalizeId($user['user_id'] ?? '');
    $record = srp_latest_open_deletion($db, $userId);
    if (!$record || ($user['deletion_status'] ?? '') !== 'pending') {
        throw new RuntimeException('This account is not awaiting deletion.');
    }

    $privateTables = [
        'account_settings', 'ambassador_applications', 'ambassadors',
        'announcement_dismissals', 'connections', 'educational_experience',
        'event_invitations', 'event_registrations', 'followed_communities',
        'forum_votes', 'messages', 'notifications', 'poll_votes', 'post_votes',
        'reel_likes', 'reel_saves', 'saved_forums', 'saved_posts', 'saved_threads',
        'survey_responses', 'thread_votes', 'user_education', 'user_experience',
        'user_follows', 'user_interests', 'user_sessions', 'verified_users'
    ];
    foreach ($privateTables as $table) {
        $columns = $db->prepare("
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
        ");
        $columns->execute([':table' => $table]);
        $available = $columns->fetchAll(PDO::FETCH_COLUMN);
        $userColumns = array_values(array_intersect(
            ['user_id', 'user_id1', 'user_id2', 'follower_id', 'followed_user_id',
             'sender_id', 'recipient_id', 'recipient_user_id', 'actor_user_id',
             'invited_user_id', 'invited_by'],
            $available
        ));
        if (!$userColumns) continue;
        $where = implode(' OR ', array_map(static fn($column) => "{$column} = ?", $userColumns));
        $stmt = $db->prepare("DELETE FROM {$table} WHERE {$where}");
        $stmt->execute(array_fill(0, count($userColumns), $userId));
    }

    $verification = $db->prepare("SELECT selfie_path, id_front_path, supporting_doc_path FROM user_verification_requests WHERE user_id = :uid");
    $verification->execute([':uid' => $userId]);
    foreach ($verification->fetchAll(PDO::FETCH_ASSOC) as $documents) {
        foreach ($documents as $path) {
            if (!$path) continue;
            $fullPath = dirname(__DIR__, 2) . '/' . ltrim((string)$path, '/');
            if (is_file($fullPath)) @unlink($fullPath);
        }
    }
    $deleteVerification = $db->prepare("DELETE FROM user_verification_requests WHERE user_id = :uid");
    $deleteVerification->execute([':uid' => $userId]);

    $deleteRequests = $db->prepare("DELETE FROM community_creation_requests WHERE user_email = :email");
    $deleteRequests->execute([':email' => (string)$user['email']]);

    $profileMedia = [
        ['value' => $user['avatar_path'] ?? '', 'directory' => 'avatars', 'default' => 'DefaultAvatar.png'],
        ['value' => $user['banner_path'] ?? '', 'directory' => 'banners', 'default' => 'DefaultBanner.jpeg'],
    ];
    foreach ($profileMedia as $media) {
        $filename = basename((string)$media['value']);
        if ($filename === '' || $filename === $media['default']) continue;
        $mediaPath = dirname(__DIR__, 2) . '/uploads/' . $media['directory'] . '/' . $filename;
        if (is_file($mediaPath)) @unlink($mediaPath);
    }

    $replacementEmail = 'deleted+' . substr(preg_replace('/[^a-zA-Z0-9]/', '', $userId), 0, 24) . '+' . time() . '@deleted.invalid';
    $unusablePassword = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT);
    $update = $db->prepare("
        UPDATE users SET
            recent_university_id = NULL, first_name = 'Deleted', last_name = 'User',
            email = :replacement_email, phone = NULL, password_hash = :password_hash,
            education_status = 'Prospect', is_over_18 = 0, headline = NULL,
            about = NULL, skills = NULL, avatar_path = 'DefaultAvatar.png',
            banner_path = 'DefaultBanner.jpeg', primary_color = '#0077B5',
            secondary_color = '#005f8d', verified = 0, verified_community_id = NULL,
            is_ambassador = 0, follower_count = 0, following_count = 0,
            verification_code = NULL, is_verified = 0, is_public = 0,
            deletion_status = 'purged', fully_deleted_at = NOW()
        WHERE user_id = :uid
    ");
    $update->execute([
        ':replacement_email' => $replacementEmail,
        ':password_hash' => $unusablePassword,
        ':uid' => $userId,
    ]);
    $close = $db->prepare("
        UPDATE account_deletion_records
        SET purged_at = NOW(), forced = :forced, recovery_snapshot = NULL
        WHERE deletion_id = :id
    ");
    $close->execute([':forced' => $forced ? 1 : 0, ':id' => $record['deletion_id']]);
}
