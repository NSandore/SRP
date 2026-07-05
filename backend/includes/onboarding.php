<?php
require_once __DIR__ . '/../db_connection.php';

const SRP_UNVERIFIED_DAILY_POST_LIMIT = 1;

function srp_ensure_onboarding_tables(PDO $db): void {
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_verification_requests (
            request_id VARCHAR(32) PRIMARY KEY,
            user_id VARCHAR(32) NOT NULL,
            community_id VARCHAR(32) DEFAULT NULL,
            verification_type ENUM('student', 'staff_representative') NOT NULL,
            verification_method ENUM('school_email', 'id_photo', 'tuition_statement', 'manual_review', 'staff_attestation') NOT NULL,
            school_email VARCHAR(100) DEFAULT NULL,
            staff_position VARCHAR(150) DEFAULT NULL,
            attestation_confirmed TINYINT(1) NOT NULL DEFAULT 0,
            notes TEXT DEFAULT NULL,
            selfie_path VARCHAR(255) DEFAULT NULL,
            id_front_path VARCHAR(255) DEFAULT NULL,
            supporting_doc_path VARCHAR(255) DEFAULT NULL,
            status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
            reviewed_by VARCHAR(32) DEFAULT NULL,
            reviewed_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_verification_user_status (user_id, status),
            KEY idx_verification_community_status (community_id, status),
            CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            CONSTRAINT fk_verification_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
            CONSTRAINT fk_verification_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $columns = [
        'selfie_path' => "ALTER TABLE user_verification_requests ADD COLUMN selfie_path VARCHAR(255) DEFAULT NULL",
        'id_front_path' => "ALTER TABLE user_verification_requests ADD COLUMN id_front_path VARCHAR(255) DEFAULT NULL",
        'supporting_doc_path' => "ALTER TABLE user_verification_requests ADD COLUMN supporting_doc_path VARCHAR(255) DEFAULT NULL",
    ];
    foreach ($columns as $column => $ddl) {
        $existsStmt = $db->prepare("
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'user_verification_requests'
              AND COLUMN_NAME = :col
            LIMIT 1
        ");
        $existsStmt->execute([':col' => $column]);
        if (!$existsStmt->fetchColumn()) {
            $db->exec($ddl);
        }
    }

    $db->exec("
        CREATE TABLE IF NOT EXISTS ambassador_applications (
            application_id VARCHAR(32) PRIMARY KEY,
            user_id VARCHAR(32) NOT NULL,
            community_id VARCHAR(32) NOT NULL,
            motivation_message TEXT NOT NULL,
            connection_confirmed TINYINT(1) NOT NULL DEFAULT 0,
            routed_to ENUM('community_admins', 'super_admins') NOT NULL,
            status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
            reviewed_by VARCHAR(32) DEFAULT NULL,
            reviewed_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_amb_application_user_status (user_id, status),
            KEY idx_amb_application_community_status (community_id, status),
            UNIQUE KEY uq_amb_pending (user_id, community_id, status),
            CONSTRAINT fk_amb_application_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            CONSTRAINT fk_amb_application_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
            CONSTRAINT fk_amb_application_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $eduColumns = [
        'still_attending' => "ALTER TABLE educational_experience ADD COLUMN still_attending TINYINT(1) NOT NULL DEFAULT 0",
    ];
    foreach ($eduColumns as $column => $ddl) {
        $existsStmt = $db->prepare("
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'educational_experience'
              AND COLUMN_NAME = :col
            LIMIT 1
        ");
        $existsStmt->execute([':col' => $column]);
        if (!$existsStmt->fetchColumn()) {
            $db->exec($ddl);
        }
    }
}

function srp_decode_json_assoc($raw): array {
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function srp_get_account_settings_extras(PDO $db, string $userId): array {
    $stmt = $db->prepare("SELECT extras FROM account_settings WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    $raw = $stmt->fetchColumn();
    return srp_decode_json_assoc($raw);
}

function srp_save_account_settings_extras(PDO $db, string $userId, array $extras): void {
    $encoded = json_encode($extras, JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        $encoded = '{}';
    }

    $stmt = $db->prepare("
        INSERT INTO account_settings (user_id, extras, updated_at)
        VALUES (:uid, :extras, NOW())
        ON DUPLICATE KEY UPDATE
            extras = :extras,
            updated_at = NOW()
    ");
    $stmt->execute([
        ':uid' => $userId,
        ':extras' => $encoded,
    ]);
}

function srp_normalize_role_intent($value): ?string {
    $normalized = strtolower(trim((string)$value));
    if ($normalized === '') {
        return null;
    }

    $map = [
        'prospect' => 'prospect',
        'student' => 'student',
        'alumni' => 'alumni',
        'staff' => 'staff_representative',
        'staff representative' => 'staff_representative',
        'staff / representative' => 'staff_representative',
        'staff_representative' => 'staff_representative',
    ];

    if (isset($map[$normalized])) {
        return $map[$normalized];
    }
    return null;
}

function srp_role_label(string $roleIntent): string {
    if ($roleIntent === 'student') return 'Student';
    if ($roleIntent === 'alumni') return 'Alumni';
    if ($roleIntent === 'staff_representative') return 'Staff / Representative';
    return 'Prospect';
}

function srp_default_onboarding_state(): array {
    return [
        'current_step' => 1,
        'completed_steps' => [],
        'status' => 'in_progress',
        'role_intent' => null,
        'role_selected' => false,
        'interests_selected' => false,
        'follows_selected' => false,
        'profile_basics_completed' => false,
        'context_completed' => false,
        'verification_requested' => false,
        'verification_skipped' => false,
        'started_at' => gmdate('c'),
        'completed_at' => null,
        'last_updated_at' => gmdate('c'),
    ];
}

function srp_mark_step_complete(array &$state, int $step): void {
    $steps = $state['completed_steps'] ?? [];
    if (!is_array($steps)) {
        $steps = [];
    }
    $steps[] = $step;
    $steps = array_values(array_unique(array_map('intval', $steps)));
    sort($steps);
    $state['completed_steps'] = $steps;
}

function srp_get_onboarding_state(PDO $db, string $userId): array {
    $extras = srp_get_account_settings_extras($db, $userId);
    $state = srp_default_onboarding_state();
    if (isset($extras['onboarding']) && is_array($extras['onboarding'])) {
        $state = array_merge($state, $extras['onboarding']);
    }

    $userStmt = $db->prepare("
        SELECT education_status, is_verified
        FROM users
        WHERE user_id = :uid
        LIMIT 1
    ");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    if ((int)($user['is_verified'] ?? 0) === 1) {
        srp_mark_step_complete($state, 1);
    }

    $normalizedEducationStatus = srp_normalize_role_intent($user['education_status'] ?? '');
    $roleSelected = !empty($state['role_selected']);
    if (
        !$roleSelected
        && (
            !empty($state['interests_selected'])
            || !empty($state['follows_selected'])
            || !empty($state['profile_basics_completed'])
            || !empty($state['context_completed'])
            || !empty($state['verification_requested'])
            || !empty($state['verification_skipped'])
            || ($state['status'] ?? '') === 'completed'
        )
    ) {
        $roleSelected = true;
    }
    if (!$roleSelected && $normalizedEducationStatus && $normalizedEducationStatus !== 'prospect') {
        $roleSelected = true;
    }

    $state['role_selected'] = $roleSelected;
    if (!empty($state['role_selected']) && empty($state['role_intent']) && $normalizedEducationStatus) {
        $state['role_intent'] = $normalizedEducationStatus;
    }
    if (!empty($state['role_selected']) && !empty($state['role_intent'])) {
        srp_mark_step_complete($state, 2);
    }

    if (!empty($state['interests_selected'])) {
        srp_mark_step_complete($state, 3);
    }
    if (!empty($state['follows_selected'])) {
        srp_mark_step_complete($state, 4);
    }
    if (!empty($state['context_completed'])) {
        srp_mark_step_complete($state, 6);
    }
    if (!empty($state['verification_requested']) || !empty($state['verification_skipped'])) {
        srp_mark_step_complete($state, 7);
    }

    $state['last_updated_at'] = gmdate('c');
    return $state;
}

function srp_save_onboarding_state(PDO $db, string $userId, array $state): void {
    $extras = srp_get_account_settings_extras($db, $userId);
    $state['last_updated_at'] = gmdate('c');
    $extras['onboarding'] = $state;
    srp_save_account_settings_extras($db, $userId, $extras);
}

function srp_user_has_verified_email(PDO $db, string $userId): bool {
    $stmt = $db->prepare("SELECT is_verified FROM users WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $userId]);
    return (int)$stmt->fetchColumn() === 1;
}

function srp_get_today_post_count(PDO $db, string $userId): int {
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM posts
        WHERE user_id = :uid
          AND DATE(created_at) = UTC_DATE()
    ");
    $stmt->execute([':uid' => $userId]);
    return (int)$stmt->fetchColumn();
}

function srp_get_posting_window(PDO $db, string $userId): array {
    $isVerified = srp_user_has_verified_email($db, $userId);
    if ($isVerified) {
        return [
            'is_verified' => true,
            'daily_limit' => null,
            'used_today' => 0,
            'remaining_today' => null,
            'can_post' => true,
        ];
    }

    $used = srp_get_today_post_count($db, $userId);
    $remaining = max(0, SRP_UNVERIFIED_DAILY_POST_LIMIT - $used);

    return [
        'is_verified' => false,
        'daily_limit' => SRP_UNVERIFIED_DAILY_POST_LIMIT,
        'used_today' => $used,
        'remaining_today' => $remaining,
        'can_post' => $remaining > 0,
    ];
}

function srp_can_apply_for_ambassador(PDO $db, string $userId, string $communityId): bool {
    $followStmt = $db->prepare("
        SELECT 1
        FROM followed_communities
        WHERE user_id = :uid AND community_id = :cid
        LIMIT 1
    ");
    $followStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if (!$followStmt->fetchColumn()) {
        return false;
    }

    $currentStmt = $db->prepare("
        SELECT 1
        FROM users
        WHERE user_id = :uid AND recent_university_id = :cid
        LIMIT 1
    ");
    $currentStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if ($currentStmt->fetchColumn()) {
        return true;
    }

    $historyStmt = $db->prepare("
        SELECT 1
        FROM educational_experience
        WHERE user_id = :uid AND community_id = :cid
        LIMIT 1
    ");
    $historyStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    return (bool)$historyStmt->fetchColumn();
}
