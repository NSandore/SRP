<?php

declare(strict_types=1);

/**
 * Product changelog: super-admin authored entries, a public list, and the
 * "what changed since you were last here" prompt.
 *
 * Per-user read state lives in account_settings.extras['changelog'] rather than
 * a join table, matching how onboarding, 2FA, and notification preferences are
 * already stored.
 */

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/roles.php';
require_once __DIR__ . '/permissions.php';
require_once __DIR__ . '/sanitize.php';
require_once __DIR__ . '/onboarding.php';

/**
 * Return the session user's id when they are a super admin, otherwise ''.
 *
 * The role is re-read from the database rather than trusted from the session,
 * so a demotion takes effect immediately.
 */
function srp_changelog_super_admin_id(PDO $db): string {
    $userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    if ($userId === '') {
        return '';
    }
    $stmt = $db->prepare('SELECT role_id FROM users WHERE user_id = :uid LIMIT 1');
    $stmt->execute([':uid' => $userId]);
    return isSuperAdmin((int)$stmt->fetchColumn()) ? $userId : '';
}

function srp_ensure_changelog_table(PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS changelog_entries (
            changelog_entry_id VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            emoji VARCHAR(16) DEFAULT NULL,
            version_label VARCHAR(40) DEFAULT NULL,
            summary VARCHAR(500) DEFAULT NULL,
            body MEDIUMTEXT DEFAULT NULL,
            status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
            published_at DATETIME DEFAULT NULL,
            created_by VARCHAR(32) DEFAULT NULL,
            published_by VARCHAR(32) DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (changelog_entry_id),
            KEY idx_changelog_status_published (status, published_at),
            KEY idx_changelog_created_by (created_by),
            KEY idx_changelog_published_by (published_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
    );
}

/**
 * An emoji label is decorative. Keep it short and single-line; never let it
 * carry markup into the prompt.
 */
function srp_changelog_clean_emoji(?string $value): ?string {
    $emoji = trim((string)$value);
    if ($emoji === '') {
        return null;
    }
    $emoji = preg_replace('/[\p{C}<>]/u', '', $emoji) ?? '';
    $emoji = trim($emoji);
    if ($emoji === '') {
        return null;
    }
    return mb_substr($emoji, 0, 8, 'UTF-8');
}

/**
 * @return array<string, mixed>
 */
function srp_changelog_normalize_input(array $data): array {
    $title = srp_sanitize_plain((string)($data['title'] ?? ''));
    $title = mb_substr(trim($title), 0, 255, 'UTF-8');
    if ($title === '') {
        throw new InvalidArgumentException('A changelog entry needs a title.');
    }

    $summary = srp_sanitize_plain((string)($data['summary'] ?? ''));
    $summary = mb_substr(trim($summary), 0, 500, 'UTF-8');

    $versionLabel = srp_sanitize_plain((string)($data['version_label'] ?? ''));
    $versionLabel = mb_substr(trim($versionLabel), 0, 40, 'UTF-8');

    // Authored with TipTap, so it must be sanitized server-side on write.
    $body = srp_sanitize_html((string)($data['body'] ?? ''));

    return [
        'title' => $title,
        'summary' => $summary !== '' ? $summary : null,
        'version_label' => $versionLabel !== '' ? $versionLabel : null,
        'emoji' => srp_changelog_clean_emoji($data['emoji'] ?? null),
        'body' => $body !== '' ? $body : null,
    ];
}

/**
 * Shape a row for client use. Never exposes author ids to non-admins.
 *
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function srp_changelog_present(array $row, bool $includeAdminFields = false): array {
    $entry = [
        'changelog_entry_id' => (string)$row['changelog_entry_id'],
        'title' => (string)$row['title'],
        'emoji' => $row['emoji'] !== null ? (string)$row['emoji'] : null,
        'version_label' => $row['version_label'] !== null ? (string)$row['version_label'] : null,
        'summary' => $row['summary'] !== null ? (string)$row['summary'] : null,
        'body' => $row['body'] !== null ? (string)$row['body'] : null,
        'published_at' => $row['published_at'] !== null ? (string)$row['published_at'] : null,
    ];
    if ($includeAdminFields) {
        $entry['status'] = (string)$row['status'];
        $entry['created_at'] = (string)$row['created_at'];
        $entry['updated_at'] = (string)$row['updated_at'];
        $entry['created_by'] = $row['created_by'] !== null ? (string)$row['created_by'] : null;
        $entry['published_by'] = $row['published_by'] !== null ? (string)$row['published_by'] : null;
    }
    return $entry;
}

/**
 * @return list<array<string, mixed>>
 */
function srp_changelog_published(PDO $db, int $limit = 50, int $offset = 0): array {
    $limit = max(1, min(100, $limit));
    $offset = max(0, $offset);
    $stmt = $db->prepare(
        "SELECT * FROM changelog_entries
         WHERE status = 'published' AND published_at IS NOT NULL
         ORDER BY published_at DESC, changelog_entry_id DESC
         LIMIT {$limit} OFFSET {$offset}"
    );
    $stmt->execute();
    return array_map(
        static fn(array $row): array => srp_changelog_present($row),
        $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
    );
}

/**
 * @return array<string, mixed>
 */
function srp_changelog_get_user_state(PDO $db, string $userId): array {
    $extras = srp_get_account_settings_extras($db, $userId);
    $state = is_array($extras['changelog'] ?? null) ? $extras['changelog'] : [];
    return [
        'last_seen_entry_id' => isset($state['last_seen_entry_id'])
            ? (string)$state['last_seen_entry_id']
            : null,
        'last_seen_at' => isset($state['last_seen_at'])
            ? (string)$state['last_seen_at']
            : null,
    ];
}

function srp_changelog_mark_seen(PDO $db, string $userId, string $entryId, string $publishedAt): void {
    $extras = srp_get_account_settings_extras($db, $userId);
    $current = is_array($extras['changelog'] ?? null) ? $extras['changelog'] : [];
    $previous = (string)($current['last_seen_at'] ?? '');

    // Never move the watermark backwards: dismissing an older entry must not
    // re-arm a newer one the user has already acknowledged.
    if ($previous !== '' && strtotime($previous) >= strtotime($publishedAt)) {
        return;
    }
    $extras['changelog'] = [
        'last_seen_entry_id' => $entryId,
        'last_seen_at' => $publishedAt,
        'updated_at' => gmdate('Y-m-d H:i:s'),
    ];
    srp_save_account_settings_extras($db, $userId, $extras);
}

/**
 * The single entry to prompt this user with, or null.
 *
 * Rules, in order:
 *  - only published entries count;
 *  - the newest one wins, so a user who missed several sees only the latest;
 *  - anything at or before the user's watermark is already acknowledged;
 *  - a user who has never dismissed one falls back to their account creation
 *    time, so a new account is not greeted by history it was never absent for.
 *
 * @return array<string, mixed>|null
 */
function srp_changelog_pending_for_user(PDO $db, string $userId): ?array {
    $stmt = $db->prepare(
        "SELECT * FROM changelog_entries
         WHERE status = 'published' AND published_at IS NOT NULL
         ORDER BY published_at DESC, changelog_entry_id DESC
         LIMIT 1"
    );
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }

    $state = srp_changelog_get_user_state($db, $userId);
    $watermark = $state['last_seen_at'];
    if ($watermark === null || $watermark === '') {
        $accountStmt = $db->prepare('SELECT created_at FROM users WHERE user_id = :uid LIMIT 1');
        $accountStmt->execute([':uid' => $userId]);
        $created = $accountStmt->fetchColumn();
        $watermark = is_string($created) && $created !== '' ? $created : null;
    }
    if ($watermark !== null) {
        $publishedTime = strtotime((string)$row['published_at']);
        $watermarkTime = strtotime($watermark);
        if ($publishedTime !== false && $watermarkTime !== false && $publishedTime <= $watermarkTime) {
            return null;
        }
    }
    return srp_changelog_present($row);
}
