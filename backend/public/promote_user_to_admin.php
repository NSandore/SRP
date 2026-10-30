<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$community_id = isset($input['community_id']) ? normalizeId($input['community_id']) : '';
$user_email = isset($input['user_email']) ? trim($input['user_email']) : '';
$user_id = isset($input['user_id']) ? normalizeId($input['user_id']) : '';

if ($community_id === '' || ($user_email === '' && $user_id === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id or user identifier']);
    exit;
}

$sessionRoleId = (int)$_SESSION['role_id'];
$sessionUserId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();

    // Permission: only community admins or super admin
    if (!canManageAmbassadors($sessionUserId, $sessionRoleId, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only admins can promote users.']);
        exit;
    }

    // Resolve email from user_id if needed
    if ($user_email === '' && $user_id !== '') {
        $estmt = $db->prepare("SELECT email FROM users WHERE user_id = :uid");
        $estmt->execute([':uid' => $user_id]);
        $resolvedEmail = $estmt->fetchColumn();
        if (!$resolvedEmail) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }
        $user_email = $resolvedEmail;
    }

    // Find target user_id
    $uidStmt = $db->prepare("SELECT user_id, first_name, last_name FROM users WHERE email = :email");
    $uidStmt->execute([':email' => $user_email]);
    $targetUser = $uidStmt->fetch(PDO::FETCH_ASSOC);
    if (!$targetUser) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }

    // Ensure the user is already an ambassador (no new ambassadors can be added here)
    $existingStmt = $db->prepare("SELECT id, community_role FROM ambassadors WHERE community_id = :cid AND user_id = :uid");
    $existingStmt->execute([':cid' => $community_id, ':uid' => $targetUser['user_id']]);
    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'User must already be an ambassador before they can be promoted. Ask them to apply and verify first.'
        ]);
        exit;
    }

    if (strtolower($existing['community_role'] ?? '') === 'admin') {
        echo json_encode(['success' => true]);
        exit;
    }

    $upd = $db->prepare("UPDATE ambassadors SET community_role = 'admin' WHERE id = :id");
    $upd->execute([':id' => $existing['id']]);

    // Audit ambassador role promotion.
    $auditId = generateUniqueId($db, 'audit_logs');
    $auditAction = sprintf(
        'ambassador_role_changed:%s:%s:%s->admin',
        $community_id,
        $targetUser['user_id'],
        strtolower($existing['community_role'] ?? 'unknown')
    );
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (id, user_id, action, timestamp)
        VALUES (:id, :uid, :action, NOW())
    ");
    $auditStmt->execute([
        ':id' => $auditId,
        ':uid' => $sessionUserId,
        ':action' => $auditAction,
    ]);

    // Send notification
    $notificationId = generateUniqueId($db, 'notifications');
    $actorId = $sessionUserId;
    $actorName = trim(($_SESSION['first_name'] ?? '') . ' ' . ($_SESSION['last_name'] ?? ''));
    $communityStmt = $db->prepare("SELECT name FROM communities WHERE id = :cid");
    $communityStmt->execute([':cid' => $community_id]);
    $communityName = $communityStmt->fetchColumn() ?: 'this community';
    $message = sprintf(
        "%s promoted you to admin of %s.",
        $actorName ?: 'An admin',
        $communityName
    );
    $nstmt = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
        VALUES (:nid, :recipient, :actor, 'announcement', :ref, :msg, NOW())
    ");
    $nstmt->execute([
        ':nid' => $notificationId,
        ':recipient' => $targetUser['user_id'],
        ':actor' => $actorId,
        ':ref' => $community_id,
        ':msg' => $message
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
