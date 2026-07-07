<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require __DIR__ . '/../vendor/autoload.php';
use Mailgun\Mailgun;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$type = trim($input['type'] ?? '');
$description = trim($input['description'] ?? '');
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

if ($name === '' || $type === '' || $description === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$userEmail = $_SESSION['email'] ?? '';
$roleId = $_SESSION['role_id'] ?? null;
$isSuperAdmin = isSuperAdmin($roleId);

try {
    $db = getDB();

    $allowedTypes = ['university', 'group', 'sub_community'];
    if (!in_array($type, $allowedTypes, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid community type']);
        exit;
    }

    $isSubCommunity = $type === 'sub_community';
    $dbType = $isSubCommunity ? 'group' : $type;

    // Validate parent community if provided.
    $parentName = null;
    if ($parentCommunityId !== '') {
        $pstmt = $db->prepare("SELECT name FROM communities WHERE id = :pid LIMIT 1");
        $pstmt->execute([':pid' => $parentCommunityId]);
        $parentName = $pstmt->fetchColumn();
        if (!$parentName) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Parent community not found']);
            exit;
        }
    } elseif ($isSubCommunity) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Sub-communities must specify a parent community.']);
        exit;
    }

    // If requesting a sub-community and not super-admin, ensure the user is an admin of the parent.
    if ($isSubCommunity && $parentCommunityId !== '' && !$isSuperAdmin) {
        $permStmt = $db->prepare("
            SELECT community_role FROM ambassadors WHERE community_id = :cid AND user_id = :uid LIMIT 1
        ");
        $permStmt->execute([':cid' => $parentCommunityId, ':uid' => $userId]);
        $role = strtolower((string)$permStmt->fetchColumn());
        if ($role !== 'admin') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only community admins can request sub-communities.']);
            exit;
        }
    }

    // If super admin, create community immediately
    if ($isSuperAdmin) {
        $communityId = generateUniqueId($db, 'communities');
        $insert = $db->prepare("
            INSERT INTO communities (id, name, community_type, parent_community_id, tagline, location, website, phone, primary_color, secondary_color, aliases, created_at)
            VALUES (:id, :name, :type, :parent_id, :tagline, :location, :website, :phone, :primary_color, :secondary_color, :aliases, NOW())
        ");
        $insert->execute([
            ':id' => $communityId,
            ':name' => $name,
            ':type' => $dbType,
            ':parent_id' => $parentCommunityId !== '' ? $parentCommunityId : null,
            ':tagline' => $tagline,
            ':location' => $location,
            ':website' => $website,
            ':phone' => $phone !== '' ? $phone : null,
            ':primary_color' => $primaryColor,
            ':secondary_color' => $secondaryColor,
            ':aliases' => $aliasesJson
        ]);

        autoJoinCampusGroups(
            $db,
            $communityId,
            $parentCommunityId !== '' ? $parentCommunityId : null,
            $name,
            $parentName,
            $userId
        );

        echo json_encode(['success' => true, 'community_id' => $communityId, 'status' => 'created', 'parent_name' => $parentName]);
        exit;
    }

    $requestId = generateUniqueId($db, 'community_creation_requests');
    $stmt = $db->prepare("INSERT INTO community_creation_requests (id, user_email, name, community_type, parent_community_id, description, tagline, location, website, primary_color, secondary_color, status, created_at) VALUES (:id, :email, :name, :type, :parent_id, :description, :tagline, :location, :website, :primary_color, :secondary_color, 'pending', NOW())");
    $stmt->execute([
        ':id' => $requestId,
        ':email' => $userEmail,
        ':name' => $name,
        ':type' => $dbType,
        ':parent_id' => $parentCommunityId !== '' ? $parentCommunityId : null,
        ':description' => $description,
        ':tagline' => $tagline,
        ':location' => $location,
        ':website' => $website,
        ':primary_color' => $primaryColor,
        ':secondary_color' => $secondaryColor
    ]);

    // send email to admin
    try {
        $mg = Mailgun::create('MAILGUN_API_KEY');
        $domain = 'sandboxe67f4501277d44af9f736a2154a5b6cb.mailgun.org';
        $mg->messages()->send($domain, [
            'from' => 'noreply@studentsphere.com',
            'to' => 'n.sandore5140@gmail.com',
            'subject' => 'New Community Creation Request',
            'text' => "User $userEmail requested a new community:\nName: $name\nType: {$type}\nParent: " . ($parentName ?: 'N/A') . "\nTagline: $tagline\nLocation: $location\nWebsite: $website\nPrimary Color: $primaryColor\nSecondary Color: $secondaryColor\nDescription: $description"
        ]);
    } catch (Exception $e) {
        // ignore mailgun errors but log if needed
    }

    echo json_encode(['success' => true, 'request_id' => $requestId, 'parent_name' => $parentName]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
