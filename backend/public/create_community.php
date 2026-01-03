<?php
// create_community.php
// Super-admin can create any community. Community admins can create sub-communities under their own community.

session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$name = trim($input['name'] ?? '');
$type = trim($input['type'] ?? '');
$tagline = trim($input['tagline'] ?? '');
$location = trim($input['location'] ?? '');
$website = trim($input['website'] ?? '');
$primaryColor = trim($input['primary_color'] ?? '');
$secondaryColor = trim($input['secondary_color'] ?? '');
$parentCommunityId = isset($input['parent_community_id']) ? normalizeId($input['parent_community_id']) : '';

if ($name === '' || $type === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Name and type are required.']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id'] ?? '');
$sessionRoleId = (int)($_SESSION['role_id'] ?? 0);
$isSuperAdmin = $sessionRoleId === 1;

if ($sessionUserId === '') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

try {
    $db = getDB();

    // If a parent is supplied, ensure it exists.
    $parentName = null;
    if ($parentCommunityId !== '') {
        $pstmt = $db->prepare("SELECT name FROM communities WHERE id = :pid LIMIT 1");
        $pstmt->execute([':pid' => $parentCommunityId]);
        $parentName = $pstmt->fetchColumn();
        if (!$parentName) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Parent community not found.']);
            exit;
        }
    }

    // Permission: super admin can create anything. Otherwise must be an admin of the parent community.
    if (!$isSuperAdmin) {
        if ($parentCommunityId === '') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only admins can create sub-communities under their community.']);
            exit;
        }

        $permStmt = $db->prepare("
            SELECT role FROM ambassadors WHERE community_id = :cid AND user_id = :uid LIMIT 1
        ");
        $permStmt->execute([':cid' => $parentCommunityId, ':uid' => $sessionUserId]);
        $role = strtolower((string)$permStmt->fetchColumn());
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only community admins can create sub-communities.']);
            exit;
        }
    }

    $communityId = generateUniqueId($db, 'communities');
    $defaultLogo = ($type === 'group') ? 'DefaultGroup.png' : 'default-logo.png';
    $defaultBanner = '/uploads/banners/DefaultBanner.jpeg';

    $stmt = $db->prepare("
        INSERT INTO communities (id, community_type, parent_community_id, name, tagline, location, website, primary_color, secondary_color, created_at, logo_path, banner_path)
        VALUES (:id, :type, :parent_id, :name, :tagline, :location, :website, :primary_color, :secondary_color, NOW(), :logo_path, :banner_path)
    ");
    $stmt->execute([
        ':id' => $communityId,
        ':type' => $type,
        ':parent_id' => $parentCommunityId !== '' ? $parentCommunityId : null,
        ':name' => $name,
        ':tagline' => $tagline,
        ':location' => $location,
        ':website' => $website,
        ':primary_color' => $primaryColor,
        ':secondary_color' => $secondaryColor,
        ':logo_path' => $defaultLogo,
        ':banner_path' => $defaultBanner
    ]);

    echo json_encode([
        'success' => true,
        'community_id' => $communityId,
        'parent_name' => $parentName
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
