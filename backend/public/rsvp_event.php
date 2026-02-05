<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

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
    $eventStmt = $db->prepare("SELECT event_id FROM events WHERE event_id = :eid LIMIT 1");
    $eventStmt->execute([':eid' => $eventId]);
    if (!$eventStmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Event not found']);
        exit;
    }

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
            INSERT INTO event_registrations (id, event_id, user_id, status, registered_at, reminder_sent_at)
            VALUES (:id, :eid, :uid, 'registered', NOW(), NULL)
            ON DUPLICATE KEY UPDATE
                status = 'registered',
                registered_at = NOW(),
                reminder_sent_at = NULL
        ");
        $upsertStmt->execute([
            ':id' => $regId,
            ':eid' => $eventId,
            ':uid' => $userId,
        ]);
        $status = 'registered';
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
