<?php
// remove_ambassador.php
// Revokes ambassador access for a user within a community (admins only).

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
$user_id = isset($input['user_id']) ? normalizeId($input['user_id']) : '';
$reason = isset($input['reason']) ? trim($input['reason']) : '';

if ($community_id === '' || $user_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id or user_id']);
    exit;
}

try {
    $db = getDB();

    // Permission: only community admins (or super admin)
    $sessionUserId = normalizeId($_SESSION['user_id']);
    $sessionRoleId = (int)($_SESSION['role_id'] ?? 0);
    if (!canManageAmbassadors($sessionUserId, $sessionRoleId, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only admins can remove ambassadors.']);
        exit;
    }

    // Do not allow removing admin ambassadors
    $adminCheck = $db->prepare("SELECT community_role FROM ambassadors WHERE community_id = :cid AND user_id = :uid");
    $adminCheck->execute([':cid' => $community_id, ':uid' => $user_id]);
    $targetRole = $adminCheck->fetchColumn();
    if ($targetRole === 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cannot remove an admin ambassador.']);
        exit;
    }

    // Remove ambassador row
    $stmt = $db->prepare("DELETE FROM ambassadors WHERE community_id = :cid AND user_id = :uid");
    $stmt->execute([':cid' => $community_id, ':uid' => $user_id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Ambassador record not found.']);
        exit;
    }

    // Keep users.is_ambassador in sync with actual ambassador memberships.
    $countStmt = $db->prepare("SELECT COUNT(*) FROM ambassadors WHERE user_id = :uid");
    $countStmt->execute([':uid' => $user_id]);
    $membershipCount = (int)$countStmt->fetchColumn();
    $flagStmt = $db->prepare("UPDATE users SET is_ambassador = :is_ambassador WHERE user_id = :uid");
    $flagStmt->execute([
        ':is_ambassador' => $membershipCount > 0 ? 1 : 0,
        ':uid' => $user_id
    ]);

    // Fetch community name for messaging
    $cstmt = $db->prepare("SELECT name FROM communities WHERE id = :cid LIMIT 1");
    $cstmt->execute([':cid' => $community_id]);
    $community = $cstmt->fetch(PDO::FETCH_ASSOC);
    $communityName = $community ? $community['name'] : 'this community';

    // Notify the user
    $notificationId = generateUniqueId($db, 'notifications');
    $actorId = normalizeId($_SESSION['user_id']);
    $actorName = trim(($_SESSION['first_name'] ?? '') . ' ' . ($_SESSION['last_name'] ?? ''));
    $reasonText = $reason !== '' ? " Reason: {$reason}" : '';
    $message = sprintf(
        "%s revoked your ambassador access for %s.%s",
        $actorName ?: 'An admin',
        $communityName,
        $reasonText
    );
    $nstmt = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
        VALUES (:nid, :recipient, :actor, 'announcement', :ref, :msg, NOW())
    ");
    $nstmt->execute([
        ':nid' => $notificationId,
        ':recipient' => $user_id,
        ':actor' => $actorId,
        ':ref' => $community_id,
        ':msg' => $message
    ]);

    // Audit ambassador removal.
    $auditId = generateUniqueId($db, 'audit_logs');
    $auditAction = sprintf('ambassador_removed:%s:%s', $community_id, $user_id);
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (id, user_id, action, timestamp)
        VALUES (:id, :uid, :action, NOW())
    ");
    $auditStmt->execute([
        ':id' => $auditId,
        ':uid' => $sessionUserId,
        ':action' => $auditAction,
    ]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
