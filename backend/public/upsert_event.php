<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/event_notifications.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$eventId = isset($input['event_id']) ? trim((string)$input['event_id']) : '';
$title = isset($input['title']) ? trim((string)$input['title']) : '';
$description = isset($input['description']) ? trim((string)$input['description']) : '';
$startAtRaw = isset($input['start_at']) ? trim((string)$input['start_at']) : '';
$timezone = isset($input['timezone']) ? trim((string)$input['timezone']) : '';
$communityId = isset($input['community_id']) ? trim((string)$input['community_id']) : '';
$location = isset($input['location']) ? trim((string)$input['location']) : '';
$meetingProvider = isset($input['meeting_provider']) ? trim((string)$input['meeting_provider']) : '';
$meetingLink = isset($input['meeting_link']) ? trim((string)$input['meeting_link']) : '';
$meetingId = isset($input['meeting_id']) ? trim((string)$input['meeting_id']) : '';
$durationMinutes = isset($input['duration_minutes']) ? (int)$input['duration_minutes'] : 0;
$endAtRaw = isset($input['end_at']) ? trim((string)$input['end_at']) : '';
$allowedAudiences = eventAllowedAudiences($input['allowed_audiences'] ?? null);
$inviteUserIds = isset($input['invite_user_ids']) && is_array($input['invite_user_ids'])
    ? $input['invite_user_ids']
    : [];
$notifyRsvpsDateChange = filter_var(
    $input['notify_rsvps_date_change'] ?? false,
    FILTER_VALIDATE_BOOLEAN
);

if ($title === '' || $startAtRaw === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$timezone = $timezone !== '' ? $timezone : 'UTC';
try {
    $tz = new DateTimeZone($timezone);
} catch (Throwable $e) {
    $tz = new DateTimeZone('UTC');
    $timezone = 'UTC';
}

$hasExplicitTz = (bool)preg_match('/[zZ]|[+-]\\d{2}:?\\d{2}$/', $startAtRaw);
try {
    $startAt = $hasExplicitTz ? new DateTime($startAtRaw) : new DateTime($startAtRaw, $tz);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid start time']);
    exit;
}

$startUtc = clone $startAt;
$startUtc->setTimezone(new DateTimeZone('UTC'));

$endUtc = null;
if ($endAtRaw !== '') {
    $endHasTz = (bool)preg_match('/[zZ]|[+-]\\d{2}:?\\d{2}$/', $endAtRaw);
    try {
        $endAt = $endHasTz ? new DateTime($endAtRaw) : new DateTime($endAtRaw, $tz);
        $endUtc = $endAt->setTimezone(new DateTimeZone('UTC'));
    } catch (Throwable $e) {
        $endUtc = null;
    }
}

if ($endUtc === null && $durationMinutes > 0) {
    $endUtc = clone $startUtc;
    $endUtc->modify('+' . $durationMinutes . ' minutes');
}

if ($durationMinutes <= 0) {
    $durationMinutes = 60;
    if ($endUtc === null) {
        $endUtc = clone $startUtc;
        $endUtc->modify('+60 minutes');
    }
}

$meetingProvider = $meetingProvider !== '' ? $meetingProvider : ($meetingLink !== '' ? 'zoom' : 'other');
$isVirtual = $meetingLink !== '' ? 1 : 0;

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();

    $userStmt = $db->prepare("SELECT role_id, is_ambassador FROM users WHERE user_id = :uid LIMIT 1");
    $userStmt->execute([':uid' => $userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
    $roleId = (int)($user['role_id'] ?? 0);
    $isAmbassador = (int)($user['is_ambassador'] ?? 0) === 1;
    $isAdmin = isAdmin($roleId);
    if (!$isAmbassador && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }
    if (!$isAdmin && ($communityId === '' || getCommunityRole($userId, $communityId, $db) === '')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Ambassadors can only create events for their communities']);
        exit;
    }

    $isNewEvent = $eventId === '';
    $previousStartAt = null;
    if ($eventId !== '') {
        $checkStmt = $db->prepare("SELECT created_by, start_at FROM events WHERE event_id = :eid LIMIT 1");
        $checkStmt->execute([':eid' => $eventId]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            $eventId = '';
            $isNewEvent = true;
        } elseif (!$isAdmin && $existing['created_by'] !== $userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Access denied']);
            exit;
        } else {
            $previousStartAt = $existing['start_at'] ?? null;
        }
    }

    if ($eventId === '') {
        $eventId = generateUniqueId($db, 'events');
    }

    $stmt = $db->prepare("
        INSERT INTO events (
            event_id,
            community_id,
            created_by,
            event_type,
            title,
            description,
            start_at,
            end_at,
            timezone,
            is_virtual,
            location,
            meeting_provider,
            meeting_link,
            meeting_id,
            allowed_audiences
        )
        VALUES (
            :event_id,
            :community_id,
            :created_by,
            'webinar',
            :title,
            :description,
            :start_at,
            :end_at,
            :timezone,
            :is_virtual,
            :location,
            :meeting_provider,
            :meeting_link,
            :meeting_id,
            :allowed_audiences
        )
        ON DUPLICATE KEY UPDATE
            community_id = VALUES(community_id),
            title = VALUES(title),
            description = VALUES(description),
            start_at = VALUES(start_at),
            end_at = VALUES(end_at),
            timezone = VALUES(timezone),
            is_virtual = VALUES(is_virtual),
            location = VALUES(location),
            meeting_provider = VALUES(meeting_provider),
            meeting_link = VALUES(meeting_link),
            meeting_id = VALUES(meeting_id),
            allowed_audiences = VALUES(allowed_audiences),
            updated_at = NOW()
    ");

    $stmt->execute([
        ':event_id' => $eventId,
        ':community_id' => $communityId !== '' ? $communityId : null,
        ':created_by' => $userId,
        ':title' => $title,
        ':description' => $description !== '' ? $description : null,
        ':start_at' => $startUtc->format('Y-m-d H:i:s'),
        ':end_at' => $endUtc ? $endUtc->format('Y-m-d H:i:s') : null,
        ':timezone' => $timezone,
        ':is_virtual' => $isVirtual,
        ':location' => $location !== '' ? $location : null,
        ':meeting_provider' => $meetingProvider,
        ':meeting_link' => $meetingLink,
        ':meeting_id' => $meetingId !== '' ? $meetingId : null,
        ':allowed_audiences' => json_encode($allowedAudiences),
    ]);

    $parentCommunityId = null;
    if ($communityId !== '') {
        $parentStmt = $db->prepare(
            "SELECT parent_community_id FROM communities WHERE id = :community_id LIMIT 1"
        );
        $parentStmt->execute([':community_id' => $communityId]);
        $parentCommunityId = $parentStmt->fetchColumn() ?: null;
    }

    $eventRecord = [
        'event_id' => $eventId,
        'community_id' => $communityId !== '' ? $communityId : null,
        'parent_community_id' => $parentCommunityId,
        'created_by' => $userId,
        'title' => $title,
        'description' => $description,
        'start_at' => $startUtc->format('Y-m-d H:i:s'),
        'end_at' => $endUtc ? $endUtc->format('Y-m-d H:i:s') : null,
        'timezone' => $timezone,
        'meeting_provider' => $meetingProvider,
        'meeting_link' => $meetingLink,
        'allowed_audiences' => json_encode($allowedAudiences),
    ];

    $invitedCount = eventProcessInvitations($db, $eventRecord, $userId, $inviteUserIds);
    $notifiedCount = $isNewEvent ? eventNotifyIncludedUsers($db, $eventRecord, $userId) : 0;
    $dateChanged = !$isNewEvent
        && $previousStartAt !== null
        && $previousStartAt !== $eventRecord['start_at'];
    $dateChangeNotifiedCount = ($dateChanged && $notifyRsvpsDateChange)
        ? eventNotifyDateChange($db, $eventRecord, $userId)
        : 0;

    echo json_encode([
        'success' => true,
        'event_id' => $eventId,
        'invited_count' => $invitedCount,
        'notified_count' => $notifiedCount,
        'date_changed' => $dateChanged,
        'date_change_notified_count' => $dateChangeNotifiedCount,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
