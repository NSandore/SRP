<?php
session_start(); // Start the session to access session variables

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/sanitize.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

// Retrieve input (supports JSON or multipart form data)
$data = json_decode(file_get_contents('php://input'), true);
$usingForm = !empty($_POST) || !empty($_FILES);
$community_id = $usingForm ? normalizeId($_POST['community_id'] ?? '') : (isset($data['community_id']) ? normalizeId($data['community_id']) : '');
$name = srp_sanitize_plain($usingForm ? ($_POST['name'] ?? '') : ($data['name'] ?? ''), 255);
$description = srp_sanitize_plain($usingForm ? ($_POST['description'] ?? '') : ($data['description'] ?? ''), 2000);
$tagsRaw = $usingForm ? ($_POST['tags'] ?? '[]') : ($data['tags'] ?? []);
if (is_string($tagsRaw)) {
    $decodedTags = json_decode($tagsRaw, true);
    $tags = is_array($decodedTags) ? $decodedTags : [];
} elseif (is_array($tagsRaw)) {
    $tags = $tagsRaw;
} else {
    $tags = [];
}
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(403); // Forbidden
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}
$creatorUserId = normalizeId($_SESSION['user_id']);
$roleId = (int)$_SESSION['role_id'];

// **Validate Input**
if (empty($name)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Forum name is required.']);
    exit;
}

try {
    $db = getDB();

    if (!hasVerifiedEmail($creatorUserId, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'Verify your email to manage community configuration.']);
        exit;
    }

    // If community_id not provided, default to the earliest community
    if (empty($community_id)) {
        if (!isSuperAdmin($roleId)) {
            http_response_code(403);
            echo json_encode(['error' => 'Community selection is required.']);
            exit;
        }
        $defaultCommunity = $db->query("SELECT id FROM communities ORDER BY id ASC LIMIT 1")->fetchColumn();
        if (!$defaultCommunity) {
            http_response_code(400);
            echo json_encode(['error' => 'Community not found. Please create a community first.']);
            exit;
        }
        $community_id = $defaultCommunity;
    }

    if (!canManageForums($creatorUserId, $roleId, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to create forums in this community.']);
        exit;
    }

    // Ensure community exists
    $check = $db->prepare("SELECT id FROM communities WHERE id = :cid LIMIT 1");
    $check->execute([':cid' => $community_id]);
    if (!$check->fetchColumn()) {
        http_response_code(400);
        echo json_encode(['error' => 'Community not found. Please choose a valid community.']);
        exit;
    }

    $forumId = generateUniqueId($db, 'forums');
    $bannerPath = '/uploads/banners/DefaultBanner.jpeg';
    $bannerUploadDir = __DIR__ . '/../../uploads/banners/';

    if (isset($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png'];
        $bannerMimeType = mime_content_type($_FILES['banner']['tmp_name']);
        if (!in_array($bannerMimeType, $allowedTypes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid banner file type. Only JPEG and PNG allowed.']);
            exit;
        }
        if (!is_dir($bannerUploadDir) || !is_writable($bannerUploadDir)) {
            http_response_code(500);
            echo json_encode(['error' => 'Banner upload directory is not writable.']);
            exit;
        }
        $bannerExtension = pathinfo($_FILES['banner']['name'], PATHINFO_EXTENSION);
        $bannerFilename = 'forum_' . $forumId . '_' . time() . '.' . $bannerExtension;
        $bannerDestination = $bannerUploadDir . $bannerFilename;
        if (move_uploaded_file($_FILES['banner']['tmp_name'], $bannerDestination)) {
            $bannerPath = '/uploads/banners/' . $bannerFilename;
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Banner upload failed.']);
            exit;
        }
    } elseif (isset($_FILES['banner'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Banner upload error.']);
        exit;
    }

    $stmt = $db->prepare("
        INSERT INTO forums (forum_id, community_id, name, description, banner_path, created_at, created_by)
        VALUES (:forum_id, :cid, :name, :desc, :banner_path, NOW(), :created_by)
    ");
    $stmt->execute([
        ':forum_id' => $forumId,
        ':cid' => $community_id,
        ':name' => $name,
        ':desc' => $description,
        ':banner_path' => $bannerPath,
        ':created_by' => $creatorUserId
    ]);

    $tagIds = srp_resolve_tag_ids($db, $tags);
    srp_sync_tag_mappings($db, 'forum_tags', 'forum_id', $forumId, $tagIds);

    echo json_encode([
        'success' => true,
        'forum_id' => $forumId,
        'created_at' => date('Y-m-d H:i:s') // Return the created_at timestamp
    ]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ']);
}
?>
