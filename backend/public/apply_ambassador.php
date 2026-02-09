<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/onboarding.php';

header('Content-Type: application/json');

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

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid payload']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$communityId = normalizeId($payload['community_id'] ?? '');
$motivation = trim((string)($payload['motivation_message'] ?? ''));
$connectionConfirmed = (int)!empty($payload['connection_confirmed']);

if ($communityId === '' || $motivation === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'community_id and motivation_message are required']);
    exit;
}

if ($connectionConfirmed !== 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'You must confirm your connection to this community']);
    exit;
}

try {
    $db = getDB();
    srp_ensure_onboarding_tables($db);

    $communityStmt = $db->prepare("
        SELECT id, name, community_type
        FROM communities
        WHERE id = :cid
        LIMIT 1
    ");
    $communityStmt->execute([':cid' => $communityId]);
    $community = $communityStmt->fetch(PDO::FETCH_ASSOC);
    if (!$community) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Community not found']);
        exit;
    }

    if (strtolower((string)$community['community_type']) !== 'university') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Ambassador applications are currently available for universities only. Group ambassador assignment is handled by group admins.'
        ]);
        exit;
    }

    $alreadyAmbassadorStmt = $db->prepare("
        SELECT 1
        FROM ambassadors
        WHERE user_id = :uid AND community_id = :cid
        LIMIT 1
    ");
    $alreadyAmbassadorStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if ($alreadyAmbassadorStmt->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'You are already an ambassador for this university']);
        exit;
    }

    $pendingStmt = $db->prepare("
        SELECT 1
        FROM ambassador_applications
        WHERE user_id = :uid
          AND community_id = :cid
          AND status = 'pending'
        LIMIT 1
    ");
    $pendingStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if ($pendingStmt->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'You already have a pending ambassador application for this university']);
        exit;
    }

    if (!srp_can_apply_for_ambassador($db, $userId, $communityId)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'To apply, you must follow this university and have it as your current or prior school in your history.'
        ]);
        exit;
    }

    $adminAmbassadorStmt = $db->prepare("
        SELECT user_id
        FROM ambassadors
        WHERE community_id = :cid AND community_role = 'admin'
    ");
    $adminAmbassadorStmt->execute([':cid' => $communityId]);
    $adminAmbassadors = $adminAmbassadorStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    $routedTo = 'super_admins';
    $recipients = [];
    if ($adminAmbassadors) {
        $routedTo = 'community_admins';
        $recipients = array_values(array_unique(array_filter(array_map('normalizeId', $adminAmbassadors))));
    } else {
        $superStmt = $db->prepare("SELECT user_id FROM users WHERE role_id = :role_id");
        $superStmt->execute([':role_id' => ROLE_SUPER_ADMIN]);
        $recipients = array_values(array_unique(array_filter(array_map('normalizeId', $superStmt->fetchAll(PDO::FETCH_COLUMN) ?: []))));
    }

    $applicationId = generateUniqueId($db, 'ambassador_applications');
    $insertApplication = $db->prepare("
        INSERT INTO ambassador_applications (
            application_id, user_id, community_id, motivation_message, connection_confirmed, routed_to, status
        ) VALUES (
            :id, :uid, :cid, :motivation, :confirmed, :routed_to, 'pending'
        )
    ");
    $insertApplication->execute([
        ':id' => $applicationId,
        ':uid' => $userId,
        ':cid' => $communityId,
        ':motivation' => $motivation,
        ':confirmed' => $connectionConfirmed,
        ':routed_to' => $routedTo,
    ]);

    $insertNotification = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
        VALUES (:nid, :rid, :aid, 'announcement', :ref, :message)
    ");
    $message = "New ambassador application for {$community['name']}. Review within 12-48 hours.";
    foreach ($recipients as $recipientId) {
        $notificationId = generateUniqueId($db, 'notifications');
        $insertNotification->execute([
            ':nid' => $notificationId,
            ':rid' => $recipientId,
            ':aid' => $userId,
            ':ref' => $communityId,
            ':message' => $message,
        ]);
    }

    echo json_encode([
        'success' => true,
        'application_id' => $applicationId,
        'routed_to' => $routedTo,
        'message' => "Application sent. Review typically takes 12-48 hours. You can keep using the platform while unverified.",
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
