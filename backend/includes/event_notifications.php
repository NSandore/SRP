<?php

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/permissions.php';

function eventAllowedAudiences($raw): array {
    if ($raw === null || $raw === '') {
        return ['public', 'members', 'ambassadors', 'admins'];
    }
    $allowed = is_array($raw) ? $raw : json_decode((string)$raw, true);
    if (!is_array($allowed)) return ['public', 'members', 'ambassadors', 'admins'];
    $valid = ['public', 'members', 'verified', 'ambassadors', 'admins'];
    return array_values(array_unique(array_values(array_intersect($valid, array_map('strval', $allowed)))));
}

function eventPreference(PDO $db, string $userId, string $key, int $default = 1): int {
    $stmt = $db->prepare("
        SELECT notif_in_app, notif_email, extras
        FROM account_settings
        WHERE user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return $default;
    if ($key === 'notif_in_app' || $key === 'notif_email') {
        return isset($row[$key]) ? (int)$row[$key] : $default;
    }
    $extras = json_decode((string)($row['extras'] ?? ''), true);
    if (!is_array($extras) || !array_key_exists($key, $extras)) return $default;
    return filter_var($extras[$key], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
}

function eventUserContext(PDO $db, string $userId): ?array {
    $stmt = $db->prepare("
        SELECT
            u.user_id,
            u.role_id,
            u.is_ambassador,
            u.verified,
            u.verified_community_id,
            u.email,
            u.first_name,
            u.last_name
        FROM users u
        WHERE u.user_id = :uid
        LIMIT 1
    ");
    $stmt->execute([':uid' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) return null;

    $ambStmt = $db->prepare("SELECT community_id, community_role FROM ambassadors WHERE user_id = :uid");
    $ambStmt->execute([':uid' => $userId]);
    $ambassadorRows = $ambStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $user['ambassador_community_ids'] = array_values(array_map(
        static fn(array $row): string => (string)$row['community_id'],
        $ambassadorRows
    ));
    $user['admin_community_ids'] = array_values(array_map(
        static fn(array $row): string => (string)$row['community_id'],
        array_filter(
            $ambassadorRows,
            static fn(array $row): bool => strtolower((string)($row['community_role'] ?? '')) === 'admin'
        )
    ));

    $followStmt = $db->prepare("SELECT community_id FROM followed_communities WHERE user_id = :uid");
    $followStmt->execute([':uid' => $userId]);
    $user['followed_community_ids'] = $followStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    return $user;
}

function eventUserCanAccess(PDO $db, array $event, ?array $user): bool {
    $allowed = eventAllowedAudiences($event['allowed_audiences'] ?? null);
    if (!$user) {
        return in_array('public', $allowed, true);
    }

    $userId = normalizeId($user['user_id'] ?? '');
    if ($userId === '') return false;
    if ($userId === normalizeId($event['created_by'] ?? '')) return true;
    if (isSuperAdmin((int)($user['role_id'] ?? 0))) return true;

    $inviteStmt = $db->prepare("
        SELECT 1 FROM event_invitations
        WHERE event_id = :eid AND invited_user_id = :uid
        LIMIT 1
    ");
    $inviteStmt->execute([':eid' => $event['event_id'], ':uid' => $userId]);
    if ($inviteStmt->fetchColumn()) return true;

    $isAdminUser = isAdmin((int)($user['role_id'] ?? 0));
    $communityId = normalizeId($event['community_id'] ?? '');
    $parentCommunityId = normalizeId($event['parent_community_id'] ?? '');
    $ambassadorCommunityIds = array_map('strval', $user['ambassador_community_ids'] ?? []);
    $adminCommunityIds = array_map('strval', $user['admin_community_ids'] ?? []);
    $followedCommunityIds = array_map('strval', $user['followed_community_ids'] ?? []);
    $verifiedCommunityId = normalizeId($user['verified_community_id'] ?? '');
    $isVerified = (int)($user['verified'] ?? 0) === 1 && $verifiedCommunityId !== '';

    if ($communityId === '') {
        return in_array('public', $allowed, true)
            || ($isAdminUser && in_array('admins', $allowed, true))
            || (!empty($ambassadorCommunityIds) && in_array('ambassadors', $allowed, true))
            || ($isVerified && in_array('verified', $allowed, true))
            || in_array('members', $allowed, true);
    }

    if (in_array('public', $allowed, true)) return true;

    $isCommunityAdmin = $isAdminUser || in_array($communityId, $adminCommunityIds, true);
    $isCommunityAmbassador = in_array($communityId, $ambassadorCommunityIds, true);
    $isCommunityMember = in_array($communityId, $followedCommunityIds, true);
    $isVerifiedCommunityMember = $isVerified
        && ($verifiedCommunityId === $communityId || $verifiedCommunityId === $parentCommunityId);

    return ($isCommunityAdmin && in_array('admins', $allowed, true))
        || ($isCommunityAmbassador && in_array('ambassadors', $allowed, true))
        || ($isVerifiedCommunityMember && in_array('verified', $allowed, true))
        || ($isCommunityMember && in_array('members', $allowed, true));
}

function eventInsertNotificationOnce(
    PDO $db,
    string $recipientId,
    ?string $actorId,
    string $eventId,
    string $message
): bool {
    $check = $db->prepare("
        SELECT 1
        FROM notifications
        WHERE recipient_user_id = :rid
          AND COALESCE(actor_user_id, '') = :aid
          AND notification_type = 'event'
          AND reference_id = :ref
          AND message = :message
        LIMIT 1
    ");
    $check->execute([
        ':rid' => $recipientId,
        ':aid' => $actorId ?: '',
        ':ref' => $eventId,
        ':message' => $message,
    ]);
    if ($check->fetchColumn()) return false;

    $insert = $db->prepare("
        INSERT INTO notifications (
            notification_id, recipient_user_id, actor_user_id,
            notification_type, reference_id, message, created_at
        )
        VALUES (:nid, :rid, :aid, 'event', :ref, :message, NOW())
    ");
    $insert->execute([
        ':nid' => generateUniqueId($db, 'notifications'),
        ':rid' => $recipientId,
        ':aid' => $actorId ?: null,
        ':ref' => $eventId,
        ':message' => $message,
    ]);
    return true;
}

function eventSendEmail(
    string $email,
    string $name,
    string $subject,
    string $text,
    string $html
): bool {
    $apiKey = getenv('MAILERSEND_API_KEY');
    $fromEmail = getenv('MAILERSEND_FROM_EMAIL');
    $fromName = getenv('MAILERSEND_FROM_NAME') ?: 'StudentSphere';
    if (!$apiKey || !$fromEmail || $email === '') return false;

    require_once __DIR__ . '/../vendor/autoload.php';
    if (!class_exists(\MailerSend\MailerSend::class)) return false;
    try {
        $mailer = new \MailerSend\MailerSend(['api_key' => $apiKey]);
        $recipients = [new \MailerSend\Helpers\Builder\Recipient($email, $name ?: $email)];
        $params = (new \MailerSend\Helpers\Builder\EmailParams())
            ->setFrom($fromEmail)
            ->setFromName($fromName)
            ->setRecipients($recipients)
            ->setSubject($subject)
            ->setText($text)
            ->setHtml($html);
        $mailer->email->send($params);
        return true;
    } catch (Throwable $e) {
        error_log('Event email failed: ' . $e->getMessage());
        return false;
    }
}

function eventNotifyIncludedUsers(PDO $db, array $event, string $creatorId): int {
    $users = $db->query("
        SELECT user_id, role_id, is_ambassador, email, first_name, last_name
        FROM users
    ")->fetchAll(PDO::FETCH_ASSOC);
    $count = 0;
    $title = (string)($event['title'] ?? 'Upcoming event');
    $eventId = (string)$event['event_id'];
    $message = "New upcoming event: <a href=\"/events-feed?event={$eventId}\">"
        . htmlspecialchars($title, ENT_QUOTES, 'UTF-8')
        . "</a>.";
    $invitedStmt = $db->prepare("
        SELECT 1 FROM event_invitations
        WHERE event_id = :eid AND invited_user_id = :uid
        LIMIT 1
    ");

    foreach ($users as $row) {
        $uid = normalizeId($row['user_id']);
        if ($uid === '' || $uid === $creatorId) continue;
        $invitedStmt->execute([':eid' => $eventId, ':uid' => $uid]);
        if ($invitedStmt->fetchColumn()) continue;
        $context = eventUserContext($db, $uid);
        if (!$context || !eventUserCanAccess($db, $event, $context)) continue;
        if (eventPreference($db, $uid, 'notify_events', 1) !== 1) continue;
        if (eventPreference($db, $uid, 'notif_in_app', 1) !== 1) continue;
        if (eventInsertNotificationOnce($db, $uid, $creatorId, $eventId, $message)) {
            $count++;
        }
    }
    return $count;
}

function eventProcessInvitations(PDO $db, array $event, string $actorId, array $inviteUserIds): int {
    $eventId = (string)$event['event_id'];
    $title = (string)($event['title'] ?? 'an event');
    $insert = $db->prepare("
        INSERT IGNORE INTO event_invitations (id, event_id, invited_user_id, invited_by)
        VALUES (:id, :eid, :uid, :actor)
    ");
    $update = $db->prepare("
        UPDATE event_invitations
        SET notification_sent_at = NOW()
        WHERE event_id = :eid AND invited_user_id = :uid
    ");
    $count = 0;
    foreach (array_values(array_unique(array_map('normalizeId', $inviteUserIds))) as $uid) {
        if ($uid === '' || $uid === $actorId) continue;
        $insert->execute([
            ':id' => generateUniqueId($db, 'event_invitations'),
            ':eid' => $eventId,
            ':uid' => $uid,
            ':actor' => $actorId,
        ]);
        if ($insert->rowCount() !== 1) continue;
        if (eventPreference($db, $uid, 'notif_in_app', 1) === 1) {
            $message = "You were invited to <a href=\"/events-feed?event={$eventId}\">"
                . htmlspecialchars($title, ENT_QUOTES, 'UTF-8')
                . "</a>.";
            eventInsertNotificationOnce($db, $uid, $actorId, $eventId, $message);
        }
        $update->execute([':eid' => $eventId, ':uid' => $uid]);
        $count++;
    }
    return $count;
}

function eventNotifyDateChange(PDO $db, array $event, string $actorId): int {
    $stmt = $db->prepare("
        SELECT u.user_id, u.email, u.first_name, u.last_name
        FROM event_registrations r
        JOIN users u ON u.user_id = r.user_id
        WHERE r.event_id = :eid AND r.status = 'registered'
    ");
    $stmt->execute([':eid' => $event['event_id']]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $count = 0;
    $title = (string)$event['title'];
    $start = new DateTime((string)$event['start_at'], new DateTimeZone('UTC'));
    $startText = $start->format('M j, Y g:i A') . ' UTC';
    $message = "The date changed for <a href=\"/events-feed?event={$event['event_id']}\">"
        . htmlspecialchars($title, ENT_QUOTES, 'UTF-8')
        . "</a>. New time: {$startText}.";

    foreach ($users as $user) {
        $uid = normalizeId($user['user_id']);
        if (eventPreference($db, $uid, 'notify_events', 1) !== 1) continue;
        if (eventPreference($db, $uid, 'notif_in_app', 1) === 1
            && eventInsertNotificationOnce($db, $uid, $actorId, $event['event_id'], $message)
        ) {
            $count++;
        }
        if (eventPreference($db, $uid, 'notif_email', 1) === 1) {
            $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
            eventSendEmail(
                (string)$user['email'],
                $name,
                "Updated date: {$title}",
                "The date for {$title} changed. New time: {$startText}.",
                "<p>The date for <strong>{$safeTitle}</strong> changed.</p><p>New time: {$startText}</p>"
            );
        }
    }
    return $count;
}
