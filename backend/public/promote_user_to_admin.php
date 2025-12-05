<?php
session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

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

    // Permission: only ambassador admins or super admin (role_id=1)
    if ($sessionRoleId !== 1) {
        $permStmt = $db->prepare("SELECT role FROM ambassadors WHERE community_id = :cid AND user_id = :uid");
        $permStmt->execute([':cid' => $community_id, ':uid' => $sessionUserId]);
        $viewerRole = $permStmt->fetchColumn();
        if ($viewerRole !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only admins can promote users.']);
            exit;
        }
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
    $existingStmt = $db->prepare("SELECT id, role FROM ambassadors WHERE community_id = :cid AND user_id = :uid");
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

    if (strtolower($existing['role'] ?? '') === 'admin') {
        echo json_encode(['success' => true]);
        exit;
    }

    $upd = $db->prepare("UPDATE ambassadors SET role = 'admin' WHERE id = :id");
    $upd->execute([':id' => $existing['id']]);

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
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
