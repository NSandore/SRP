<?php
// create_announcement.php
// Create a global or community announcement.

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$title = trim($input['title'] ?? '');
$body = trim($input['body'] ?? '');
$scope = ($input['scope'] ?? 'community') === 'global' ? 'global' : 'community';
$communityId = $scope === 'community' ? normalizeId($input['community_id'] ?? '') : '';
$announcementType = trim($input['announcement_type'] ?? 'general');
$startsAt = trim($input['starts_at'] ?? '');
$endsAt = trim($input['ends_at'] ?? '');
$showBanner = isset($input['show_banner']) ? (int)!!$input['show_banner'] : 1;
$isDismissible = isset($input['is_dismissible']) ? (int)!!$input['is_dismissible'] : 1;

if ($title === '' || $body === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Title and body are required']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id']);
$sessionRoleId = (int)($_SESSION['role_id'] ?? 0);
$isSuperAdmin = $sessionRoleId === 1;

try {
    $db = getDB();

    // Permission checks
    if ($scope === 'global' && !$isSuperAdmin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Only super admins can publish global announcements.']);
        exit;
    }
    if ($scope === 'community') {
        if ($communityId === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'community_id is required for community announcements.']);
            exit;
        }
        if (!$isSuperAdmin) {
            $permStmt = $db->prepare("
                SELECT role FROM ambassadors WHERE community_id = :cid AND user_id = :uid LIMIT 1
            ");
            $permStmt->execute([':cid' => $communityId, ':uid' => $sessionUserId]);
            $role = strtolower((string)$permStmt->fetchColumn());
            if ($role !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'You must be a community admin to publish announcements.']);
                exit;
            }
        }
    }

    $announcementId = generateUniqueId($db, 'announcements');

    $stmt = $db->prepare("
        INSERT INTO announcements (
            announcement_id,
            community_id,
            created_by,
            announcement_type,
            title,
            body,
            show_banner,
            show_boolean,
            show_login_overlay,
            is_active,
            starts_at,
            ends_at,
            is_dismissible,
            is_hidden,
            created_at
        ) VALUES (
            :id,
            :community_id,
            :created_by,
            :announcement_type,
            :title,
            :body,
            :show_banner,
            0,
            0,
            1,
            :starts_at,
            :ends_at,
            :is_dismissible,
            0,
            NOW()
        )
    ");

    $stmt->execute([
        ':id' => $announcementId,
        ':community_id' => $scope === 'community' ? $communityId : null,
        ':created_by' => $sessionUserId,
        ':announcement_type' => $announcementType ?: 'general',
        ':title' => $title,
        ':body' => $body,
        ':show_banner' => $showBanner,
        ':starts_at' => $startsAt !== '' ? $startsAt : null,
        ':ends_at' => $endsAt !== '' ? $endsAt : null,
        ':is_dismissible' => $isDismissible
    ]);

    echo json_encode(['success' => true, 'announcement_id' => $announcementId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
