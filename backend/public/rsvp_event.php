<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
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
$action = isset($input['action']) ? trim((string)$input['action']) : 'register';

if ($eventId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing event id']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    $eventStmt = $db->prepare("
        SELECT
            e.event_id,
            e.community_id,
            c.parent_community_id,
            e.created_by,
            e.title,
            e.start_at,
            e.timezone,
            e.meeting_provider,
            e.meeting_link,
            e.allowed_audiences,
            e.is_hidden
        FROM events e
        LEFT JOIN communities c ON c.id = e.community_id
        WHERE e.event_id = :eid
        LIMIT 1
    ");
    $eventStmt->execute([':eid' => $eventId]);
    $event = $eventStmt->fetch(PDO::FETCH_ASSOC);
    if (!$event || (int)$event['is_hidden'] === 1) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Event not found']);
        exit;
    }

    $viewer = eventUserContext($db, $userId);
    if (!$viewer || !eventUserCanAccess($db, $event, $viewer)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'This event is not available to your account']);
        exit;
    }

    $registrationStmt = $db->prepare("
        SELECT id, status, confirmation_sent_at, creator_notified_at
        FROM event_registrations
        WHERE event_id = :eid AND user_id = :uid
        LIMIT 1
    ");
    $registrationStmt->execute([':eid' => $eventId, ':uid' => $userId]);
    $existingRegistration = $registrationStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    if ($action === 'cancel') {
        $updateStmt = $db->prepare("
            UPDATE event_registrations
            SET status = 'cancelled'
            WHERE event_id = :eid AND user_id = :uid
        ");
        $updateStmt->execute([':eid' => $eventId, ':uid' => $userId]);
        $status = 'cancelled';
    } else {
        $regId = generateUniqueId($db, 'event_registrations');
        $upsertStmt = $db->prepare("
            INSERT INTO event_registrations (
                id, event_id, user_id, status, registered_at,
                confirmation_sent_at, creator_notified_at, reminder_sent_at
            )
            VALUES (:id, :eid, :uid, 'registered', NOW(), NULL, NULL, NULL)
            ON DUPLICATE KEY UPDATE
                status = 'registered',
                registered_at = NOW()
        ");
        $upsertStmt->execute([
            ':id' => $regId,
            ':eid' => $eventId,
            ':uid' => $userId,
        ]);
        $status = 'registered';

        $isNewRegistration = !$existingRegistration
            || ($existingRegistration['status'] ?? '') !== 'registered';
        if ($isNewRegistration) {
            $creatorId = normalizeId($event['created_by'] ?? '');
            if (
                $creatorId !== ''
                && $creatorId !== $userId
                && empty($existingRegistration['creator_notified_at'])
            ) {
                if (eventPreference($db, $creatorId, 'notif_in_app', 1) === 1) {
                    $memberName = trim(
                        ($viewer['first_name'] ?? '') . ' ' . ($viewer['last_name'] ?? '')
                    ) ?: 'A member';
                    $safeName = htmlspecialchars($memberName, ENT_QUOTES, 'UTF-8');
                    $safeTitle = htmlspecialchars((string)$event['title'], ENT_QUOTES, 'UTF-8');
                    $message = "{$safeName} RSVP'd to <a href=\"/events-feed?event={$eventId}\">"
                        . "{$safeTitle}</a>.";
                    eventInsertNotificationOnce($db, $creatorId, $userId, $eventId, $message);
                }
                $markCreator = $db->prepare("
                    UPDATE event_registrations
                    SET creator_notified_at = NOW()
                    WHERE event_id = :eid AND user_id = :uid
                ");
                $markCreator->execute([':eid' => $eventId, ':uid' => $userId]);
            }

            $isZoom = strtolower((string)($event['meeting_provider'] ?? '')) === 'zoom';
            $joinLink = trim((string)($event['meeting_link'] ?? ''));
            if (
                $isZoom
                && $joinLink !== ''
                && empty($existingRegistration['confirmation_sent_at'])
                && eventPreference($db, $userId, 'notif_email', 1) === 1
            ) {
                $memberName = trim(
                    ($viewer['first_name'] ?? '') . ' ' . ($viewer['last_name'] ?? '')
                );
                $safeTitle = htmlspecialchars((string)$event['title'], ENT_QUOTES, 'UTF-8');
                $safeLink = htmlspecialchars($joinLink, ENT_QUOTES, 'UTF-8');
                $sent = eventSendEmail(
                    (string)($viewer['email'] ?? ''),
                    $memberName,
                    "Your RSVP: {$event['title']}",
                    "Your RSVP is confirmed for {$event['title']}. Join the Zoom call: {$joinLink}",
                    "<p>Your RSVP is confirmed for <strong>{$safeTitle}</strong>.</p>"
                        . "<p><a href=\"{$safeLink}\">Join the Zoom call</a></p>"
                );
                if ($sent) {
                    $markConfirmation = $db->prepare("
                        UPDATE event_registrations
                        SET confirmation_sent_at = NOW()
                        WHERE event_id = :eid AND user_id = :uid
                    ");
                    $markConfirmation->execute([':eid' => $eventId, ':uid' => $userId]);
                }
            }
        }
    }

    $countStmt = $db->prepare("
        SELECT COUNT(*) FROM event_registrations
        WHERE event_id = :eid AND status = 'registered'
    ");
    $countStmt->execute([':eid' => $eventId]);
    $count = (int)$countStmt->fetchColumn();

    echo json_encode(['success' => true, 'status' => $status, 'count' => $count]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
