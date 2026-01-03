<?php
// Shared helpers for report workflows

require_once __DIR__ . '/db_connection.php';

/**
 * Ensure the reports table exists with the expected columns/indexes.
 */
function ensureReportsTable(PDO $db): void
{
    $db->exec("
        CREATE TABLE IF NOT EXISTS reports (
            report_id VARCHAR(32) NOT NULL,
            item_type ENUM('forum','thread','post','comment','announcement','event','user') NOT NULL,
            item_id VARCHAR(32) NOT NULL,
            forum_id VARCHAR(32) DEFAULT NULL,
            thread_id VARCHAR(32) DEFAULT NULL,
            community_id VARCHAR(32) DEFAULT NULL,
            reported_by VARCHAR(32) NOT NULL,
            reported_user_id VARCHAR(32) DEFAULT NULL,
            reason VARCHAR(255) NOT NULL,
            reason_code VARCHAR(64) DEFAULT NULL,
            reason_text TEXT DEFAULT NULL,
            severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
            details TEXT,
            item_context TEXT,
            status ENUM('pending','under_review','retained','removed','dismissed') NOT NULL DEFAULT 'pending',
            resolution_notes TEXT,
            resolved_by VARCHAR(32) DEFAULT NULL,
            resolved_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (report_id),
            KEY idx_reports_status (status),
            KEY idx_reports_community (community_id),
            KEY idx_reports_item (item_id),
            CONSTRAINT fk_reports_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
            CONSTRAINT fk_reports_reporter FOREIGN KEY (reported_by) REFERENCES users (user_id),
            CONSTRAINT fk_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users (user_id)
        )
    ");
}

/**
 * Trim and sanitize free-form details for storage.
 */
function sanitizeDetails(?string $value, int $limit = 2000): string
{
    if (!$value) {
        return '';
    }
    $clean = trim(strip_tags($value));
    if (mb_strlen($clean) > $limit) {
        $clean = mb_substr($clean, 0, $limit);
    }
    return $clean;
}

/**
 * Create a short text preview for a reported item.
 */
function summarizeText(?string $text, int $limit = 240): string
{
    if (!$text) {
        return '';
    }
    $clean = trim(preg_replace('/\s+/', ' ', strip_tags($text)));
    if (mb_strlen($clean) <= $limit) {
        return $clean;
    }
    return mb_substr($clean, 0, $limit - 3) . '...';
}

/**
 * Resolve the community/forum/thread context for a given item.
 */
function getReportContext(PDO $db, string $itemType, string $itemId): array
{
    switch ($itemType) {
        case 'forum':
            $stmt = $db->prepare("
                SELECT f.forum_id, f.community_id, c.name AS community_name, f.name AS forum_name, f.description
                FROM forums f
                JOIN communities c ON c.id = f.community_id
                WHERE f.forum_id = :id
            ");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('Forum not found');
            }
            return [
                'forum_id' => $row['forum_id'],
                'thread_id' => null,
                'community_id' => $row['community_id'],
                'community_name' => $row['community_name'],
                'item_context' => summarizeText($row['description'] ?: $row['forum_name']),
                'item_title' => $row['forum_name'] ?? 'Forum',
                'reported_user_id' => null,
            ];
        case 'thread':
            $stmt = $db->prepare("
                SELECT t.thread_id, t.title, t.user_id, f.forum_id, f.community_id, c.name AS community_name
                FROM threads t
                JOIN forums f ON f.forum_id = t.forum_id
                JOIN communities c ON c.id = f.community_id
                WHERE t.thread_id = :id
            ");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('Thread not found');
            }
            return [
                'forum_id' => $row['forum_id'],
                'thread_id' => $row['thread_id'],
                'community_id' => $row['community_id'],
                'community_name' => $row['community_name'],
                'item_context' => summarizeText($row['title']),
                'item_title' => $row['title'] ?? 'Thread',
                'reported_user_id' => $row['user_id'] ?? null,
            ];
        case 'post':
        case 'comment':
            $stmt = $db->prepare("
                SELECT p.post_id, p.content, p.user_id, t.thread_id, t.title, f.forum_id, f.community_id, c.name AS community_name
                FROM posts p
                JOIN threads t ON t.thread_id = p.thread_id
                JOIN forums f ON f.forum_id = t.forum_id
                JOIN communities c ON c.id = f.community_id
                WHERE p.post_id = :id
            ");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('Post not found');
            }
            return [
                'forum_id' => $row['forum_id'],
                'thread_id' => $row['thread_id'],
                'community_id' => $row['community_id'],
                'community_name' => $row['community_name'],
                'item_context' => summarizeText($row['content']),
                'item_title' => $row['title'] ?? 'Post',
                'reported_user_id' => $row['user_id'] ?? null,
            ];
        case 'announcement':
            $stmt = $db->prepare("
                SELECT a.announcement_id, a.title, a.body, a.community_id, a.created_by, c.name AS community_name
                FROM announcements a
                LEFT JOIN communities c ON c.id = a.community_id
                WHERE a.announcement_id = :id
            ");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('Announcement not found');
            }
            return [
                'forum_id' => null,
                'thread_id' => null,
                'community_id' => $row['community_id'],
                'community_name' => $row['community_name'] ?? '',
                'item_context' => summarizeText($row['body'] ?: $row['title']),
                'item_title' => $row['title'] ?? 'Announcement',
                'reported_user_id' => $row['created_by'] ?? null,
            ];
        case 'event':
            $stmt = $db->prepare("
                SELECT e.event_id, e.title, e.description, e.community_id, e.created_by, c.name AS community_name
                FROM events e
                LEFT JOIN communities c ON c.id = e.community_id
                WHERE e.event_id = :id
            ");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('Event not found');
            }
            return [
                'forum_id' => null,
                'thread_id' => null,
                'community_id' => $row['community_id'],
                'community_name' => $row['community_name'] ?? '',
                'item_context' => summarizeText($row['description'] ?: $row['title']),
                'item_title' => $row['title'] ?? 'Event',
                'reported_user_id' => $row['created_by'] ?? null,
            ];
        case 'user':
            $stmt = $db->prepare("SELECT user_id, first_name, last_name FROM users WHERE user_id = :id");
            $stmt->execute([':id' => $itemId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new InvalidArgumentException('User not found');
            }
            $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
            return [
                'forum_id' => null,
                'thread_id' => null,
                'community_id' => null,
                'community_name' => '',
                'item_context' => $name ?: 'User profile',
                'item_title' => $name ?: 'User profile',
                'reported_user_id' => $row['user_id'],
            ];
        default:
            throw new InvalidArgumentException('Unsupported item type');
    }
}

/**
 * Fetch the user IDs that should receive a moderation notification.
 */
function getModerationRecipients(PDO $db, ?string $communityId, string $reporterId = ''): array
{
    $ids = [];

    // Super admins (role_name = super_admin OR legacy role_id = 1)
    $adminStmt = $db->query("
        SELECT u.user_id
        FROM users u
        LEFT JOIN roles r ON r.role_id = u.role_id
        WHERE u.role_id = 1 OR r.role_name = 'super_admin'
    ");
    $ids = array_merge($ids, $adminStmt->fetchAll(PDO::FETCH_COLUMN));

    // Ambassadors for the community
    if ($communityId) {
        $ambStmt = $db->prepare("SELECT user_id FROM ambassadors WHERE community_id = :cid");
        $ambStmt->execute([':cid' => $communityId]);
        $ids = array_merge($ids, $ambStmt->fetchAll(PDO::FETCH_COLUMN));
    }

    // Deduplicate and remove the reporter themselves
    $ids = array_filter(array_unique($ids), function ($id) use ($reporterId) {
        return $id !== $reporterId;
    });

    return array_values($ids);
}

/**
 * Insert notifications for a set of recipients.
 */
function sendReportNotifications(PDO $db, array $recipients, string $actorId, string $message): void
{
    if (empty($recipients)) {
        return;
    }

    $insert = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
        VALUES (:nid, :rid, :actor, :type, :ref, :msg)
    ");

    foreach ($recipients as $recipientId) {
        $insert->execute([
            ':nid' => generateUniqueId($db, 'notifications'),
            ':rid' => $recipientId,
            ':actor' => $actorId,
            ':type' => 'message',
            ':ref' => null,
            ':msg' => $message,
        ]);
    }
}

function setItemHidden(PDO $db, string $itemType, string $itemId, bool $hidden): void
{
    $value = $hidden ? 1 : 0;
    switch ($itemType) {
        case 'post':
        case 'comment':
            $stmt = $db->prepare("UPDATE posts SET is_hidden = :val WHERE post_id = :id");
            break;
        case 'thread':
            $stmt = $db->prepare("UPDATE threads SET is_hidden = :val WHERE thread_id = :id");
            break;
        case 'forum':
            $stmt = $db->prepare("UPDATE forums SET is_hidden = :val WHERE forum_id = :id");
            break;
        case 'announcement':
            $stmt = $db->prepare("UPDATE announcements SET is_hidden = :val WHERE announcement_id = :id");
            break;
        case 'event':
            $stmt = $db->prepare("UPDATE events SET is_hidden = :val WHERE event_id = :id");
            break;
        case 'user':
        default:
            return;
    }
    $stmt->execute([':val' => $value, ':id' => $itemId]);
}
?>
