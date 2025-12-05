<?php
// create_community.php
// Super-admin only: create a community immediately (group or university).

session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['role_id'] ?? null) != 1) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

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

if ($name === '' || $type === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Name and type are required.']);
    exit;
}

try {
    $db = getDB();
    $communityId = generateUniqueId($db, 'communities');
$defaultLogo = ($type === 'group') ? 'DefaultGroup.png' : 'default-logo.png';
$defaultBanner = '/uploads/banners/DefaultBanner.jpeg';

$stmt = $db->prepare("
    INSERT INTO communities (id, name, community_type, tagline, location, website, primary_color, secondary_color, created_at, logo_path, banner_path)
    VALUES (:id, :name, :type, :tagline, :location, :website, :primary_color, :secondary_color, NOW(), :logo_path, :banner_path)
");
$stmt->execute([
    ':id' => $communityId,
    ':name' => $name,
    ':type' => $type,
    ':tagline' => $tagline,
    ':location' => $location,
    ':website' => $website,
    ':primary_color' => $primaryColor,
    ':secondary_color' => $secondaryColor,
    ':logo_path' => $defaultLogo,
    ':banner_path' => $defaultBanner
]);

    echo json_encode(['success' => true, 'community_id' => $communityId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
