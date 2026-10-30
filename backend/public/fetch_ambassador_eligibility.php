<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/onboarding.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$communityId = normalizeId($_GET['community_id'] ?? '');
if ($communityId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'community_id is required']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => true,
        'can_apply' => false,
        'reason' => 'login_required',
    ]);
    exit;
}

try {
    $db = getDB();
    srp_ensure_onboarding_tables($db);

    $userId = normalizeId($_SESSION['user_id']);

    $communityStmt = $db->prepare("SELECT community_type FROM communities WHERE id = :cid LIMIT 1");
    $communityStmt->execute([':cid' => $communityId]);
    $communityType = strtolower((string)$communityStmt->fetchColumn());
    if ($communityType === '') {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Community not found']);
        exit;
    }

    if ($communityType !== 'university') {
        echo json_encode([
            'success' => true,
            'can_apply' => false,
            'reason' => 'unsupported_community_type',
        ]);
        exit;
    }

    $isAmbassadorStmt = $db->prepare("
        SELECT 1 FROM ambassadors
        WHERE user_id = :uid AND community_id = :cid
        LIMIT 1
    ");
    $isAmbassadorStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if ($isAmbassadorStmt->fetchColumn()) {
        echo json_encode([
            'success' => true,
            'can_apply' => false,
            'reason' => 'already_ambassador',
        ]);
        exit;
    }

    $pendingStmt = $db->prepare("
        SELECT 1
        FROM ambassador_applications
        WHERE user_id = :uid AND community_id = :cid AND status = 'pending'
        LIMIT 1
    ");
    $pendingStmt->execute([':uid' => $userId, ':cid' => $communityId]);
    if ($pendingStmt->fetchColumn()) {
        echo json_encode([
            'success' => true,
            'can_apply' => false,
            'reason' => 'pending_application',
        ]);
        exit;
    }

    if (!srp_can_be_ambassador($db, $userId, $communityId)) {
        echo json_encode([
            'success' => true,
            'can_apply' => false,
            'reason' => 'staff_verification_required',
        ]);
        exit;
    }

    $canApply = srp_can_apply_for_ambassador($db, $userId, $communityId);
    echo json_encode([
        'success' => true,
        'can_apply' => $canApply,
        'reason' => $canApply ? null : 'not_eligible',
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
