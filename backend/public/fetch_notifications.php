<?php
session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id']);
$sessionRoleId = isset($_SESSION['role_id']) ? (int) $_SESSION['role_id'] : 0;
if ($sessionUserId === '') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Support optional user_id param but enforce it matches the session user
$requestedUserId = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : $sessionUserId;
if ($requestedUserId !== $sessionUserId) {
    // Allow super admins to fetch other users' notifications
    if ($sessionRoleId !== 1) {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

$user_id = $requestedUserId;

try {
    $db = getDB();

    $stmt = $db->prepare("
        SELECT n.notification_id,
               n.notification_type,
               n.message,
               n.is_read,
               n.created_at,
               n.actor_user_id,
               u.avatar_path,
               u.first_name,
               u.last_name
        FROM notifications n
        LEFT JOIN users u ON u.user_id = n.actor_user_id
        WHERE n.recipient_user_id = :rid
        ORDER BY n.created_at DESC
    ");
    $stmt->execute([':rid' => $user_id]);
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalize avatar paths
    foreach ($notifications as &$notif) {
        $notif['avatar_path'] = appendAvatarPath($notif['avatar_path'] ?? null);
    }

    echo json_encode(['success' => true, 'notifications' => $notifications]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
