<?php
// create_community.php
// Super-admin can create any community. Community admins can create sub-communities under their own community.

require_once __DIR__ . '/../session_bootstrap.php';

startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

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
$phone = trim($input['phone'] ?? '');
$primaryColor = trim($input['primary_color'] ?? '');
$secondaryColor = trim($input['secondary_color'] ?? '');
$parentCommunityId = isset($input['parent_community_id']) ? normalizeId($input['parent_community_id']) : '';
$aliasesInput = $input['aliases'] ?? null;

function normalizeAliases($raw) {
    if ($raw === null) {
        return null;
    }
    $aliases = [];
    if (is_array($raw)) {
        $aliases = $raw;
    } elseif (is_string($raw)) {
        $trimmed = trim($raw);
        if ($trimmed !== '' && $trimmed[0] === '[') {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $aliases = $decoded;
            } else {
                $aliases = preg_split('/\s*,\s*/', $trimmed);
            }
        } else {
            $aliases = preg_split('/\s*,\s*/', $trimmed);
        }
    }
    $aliases = array_values(array_unique(array_filter(array_map(static function ($item) {
        $val = trim((string)$item);
        return $val !== '' ? $val : null;
    }, $aliases))));
    if (!$aliases) {
        return null;
    }
    return json_encode($aliases);
}

$aliasesJson = normalizeAliases($aliasesInput);

if ($name === '' || $type === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Name and type are required.']);
    exit;
}

$sessionUserId = normalizeId($_SESSION['user_id'] ?? '');
$sessionRoleId = (int)($_SESSION['role_id'] ?? 0);
$isSuperAdminUser = isSuperAdmin($sessionRoleId);

if ($sessionUserId === '') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

try {
    $db = getDB();

    if (!hasVerifiedEmail($sessionUserId, $db)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Verify your email to manage community configuration.']);
        exit;
    }

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
    if (!$isSuperAdminUser) {
        if ($parentCommunityId === '') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only admins can create sub-communities under their community.']);
            exit;
        }

        if (!canEditCommunitySettings($sessionUserId, $sessionRoleId, $parentCommunityId, $db)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only community admins can create sub-communities.']);
            exit;
        }
    }

    $communityId = generateUniqueId($db, 'communities');
    $defaultLogo = ($type === 'group') ? 'DefaultGroup.png' : 'default-logo.png';
    $defaultBanner = '/uploads/banners/DefaultBanner.jpeg';

    $stmt = $db->prepare("
        INSERT INTO communities (id, community_type, parent_community_id, name, tagline, location, website, phone, primary_color, secondary_color, aliases, created_at, logo_path, banner_path)
        VALUES (:id, :type, :parent_id, :name, :tagline, :location, :website, :phone, :primary_color, :secondary_color, :aliases, NOW(), :logo_path, :banner_path)
    ");
    $stmt->execute([
        ':id' => $communityId,
        ':type' => $type,
        ':parent_id' => $parentCommunityId !== '' ? $parentCommunityId : null,
        ':name' => $name,
        ':tagline' => $tagline,
        ':location' => $location,
        ':website' => $website,
        ':phone' => $phone !== '' ? $phone : null,
        ':primary_color' => $primaryColor,
        ':secondary_color' => $secondaryColor,
        ':aliases' => $aliasesJson,
        ':logo_path' => $defaultLogo,
        ':banner_path' => $defaultBanner
    ]);

    autoJoinCampusGroups(
        $db,
        $communityId,
        $parentCommunityId !== '' ? $parentCommunityId : null,
        $name,
        $parentName,
        $sessionUserId
    );

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
