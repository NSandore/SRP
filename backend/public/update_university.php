<?php
// update_university.php

// Keep responses as valid JSON; log errors server-side.
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Basic request logging (server-side only).
$requestId = uniqid('update_university_', true);
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
error_log(sprintf(
    '[%s] start method=%s content_length=%d remote_addr=%s',
    $requestId,
    $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    $contentLength,
    $_SERVER['REMOTE_ADDR'] ?? 'unknown'
));

// Include the database connection
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

require_once __DIR__ . '/../session_bootstrap.php';

startSession(); // Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

// Helper function to retrieve and trim POST values
function getPostValue($key, $default = null) {
    return isset($_POST[$key]) ? trim($_POST[$key]) : $default;
}

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

// Log basic payload shape (no sensitive values).
error_log(sprintf(
    '[%s] payload post_keys=%s files=%s',
    $requestId,
    implode(',', array_keys($_POST)),
    implode(',', array_keys($_FILES))
));

// Retrieve and validate required fields
$community_id = isset($_POST['community_id']) ? normalizeId($_POST['community_id']) : '';
if ($community_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid or missing community_id.']);
    exit;
}

$name = getPostValue('name');
if (!$name) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'University name is required.']);
    exit;
}

$tagline        = getPostValue('tagline');
$location       = getPostValue('location');
$website        = getPostValue('website');
$phone          = getPostValue('phone');
$primary_color  = getPostValue('primary_color', '#0077B5');
$secondary_color = getPostValue('secondary_color', '#005f8d');
$aliasesProvided = array_key_exists('aliases', $_POST);
$aliasesJson = $aliasesProvided ? normalizeAliases($_POST['aliases']) : null;

// Get a database connection
$db = getDB();

// Permission: super admin OR ambassador admin for this community
$sessionUserId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
$sessionRoleId = isset($_SESSION['role_id']) ? (int)$_SESSION['role_id'] : null;
if (!$sessionUserId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authenticated.']);
    exit;
}

error_log(sprintf('[%s] auth user_id=%s role_id=%s community_id=%s', $requestId, $sessionUserId, (string)$sessionRoleId, $community_id));

if (!canEditCommunitySettings($sessionUserId, $sessionRoleId, $community_id, $db)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No permission to update this community.']);
    exit;
}

// Define upload directories (adjust these paths according to your folder structure)
$logoUploadDir = __DIR__ . '/../../uploads/logos/';
$bannerUploadDir = __DIR__ . '/../../uploads/banners/';

// Initialize variables to hold new file paths (if provided)
$newLogoPath = null;
$newBannerPath = null;

// Process logo file upload if provided
if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
    error_log(sprintf(
        '[%s] logo upload name=%s size=%d type=%s',
        $requestId,
        $_FILES['logo']['name'] ?? '',
        $_FILES['logo']['size'] ?? 0,
        $_FILES['logo']['type'] ?? ''
    ));
    // Validate file type (allow JPEG, PNG, GIF)
    $allowedLogoTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $logoMimeType = mime_content_type($_FILES['logo']['tmp_name']);
    if (!in_array($logoMimeType, $allowedLogoTypes)) {
        error_log(sprintf('[%s] invalid logo mime=%s', $requestId, $logoMimeType));
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid logo file type.']);
        exit;
    }

    // Ensure the logo upload directory exists and is writable
    if (!is_dir($logoUploadDir) || !is_writable($logoUploadDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Logo upload directory is not writable.']);
        exit;
    }

    // Generate a unique filename for the logo
    $logoExtension = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
    $logoFilename = 'logo_' . $community_id . '_' . time() . '.' . $logoExtension;
    $logoDestination = $logoUploadDir . $logoFilename;

    if (move_uploaded_file($_FILES['logo']['tmp_name'], $logoDestination)) {
        $newLogoPath = '/uploads/logos/' . $logoFilename;
        // (Optional) Delete the previous logo file if needed.
    } else {
        error_log(sprintf('[%s] logo upload move_failed tmp=%s dest=%s', $requestId, $_FILES['logo']['tmp_name'], $logoDestination));
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Logo upload failed.']);
        exit;
    }
} elseif (isset($_FILES['logo'])) {
    error_log(sprintf('[%s] logo upload error=%d', $requestId, $_FILES['logo']['error']));
}

// Process banner file upload if provided
if (isset($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
    error_log(sprintf(
        '[%s] banner upload name=%s size=%d type=%s',
        $requestId,
        $_FILES['banner']['name'] ?? '',
        $_FILES['banner']['size'] ?? 0,
        $_FILES['banner']['type'] ?? ''
    ));
    // Validate file type (allow only JPEG and PNG)
    $allowedBannerTypes = ['image/jpeg', 'image/png'];
    $bannerMimeType = mime_content_type($_FILES['banner']['tmp_name']);
    if (!in_array($bannerMimeType, $allowedBannerTypes)) {
        error_log(sprintf('[%s] invalid banner mime=%s', $requestId, $bannerMimeType));
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid banner file type. Only JPEG and PNG allowed.']);
        exit;
    }

    // Ensure the banner upload directory exists and is writable
    if (!is_dir($bannerUploadDir) || !is_writable($bannerUploadDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Banner upload directory is not writable.']);
        exit;
    }

    // Generate a unique filename for the banner
    $bannerExtension = pathinfo($_FILES['banner']['name'], PATHINFO_EXTENSION);
    $bannerFilename = 'banner_' . $community_id . '_' . time() . '.' . $bannerExtension;
    $bannerDestination = $bannerUploadDir . $bannerFilename;

    if (move_uploaded_file($_FILES['banner']['tmp_name'], $bannerDestination)) {
        $newBannerPath = '/uploads/banners/' . $bannerFilename;
        // (Optional) Delete the previous banner file if needed.
    } else {
        error_log(sprintf('[%s] banner upload move_failed tmp=%s dest=%s', $requestId, $_FILES['banner']['tmp_name'], $bannerDestination));
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Banner upload failed.']);
        exit;
    }
} elseif (isset($_FILES['banner'])) {
    error_log(sprintf('[%s] banner upload error=%d', $requestId, $_FILES['banner']['error']));
}

// Build the UPDATE query
$query = "UPDATE communities 
          SET name = :name, 
              tagline = :tagline, 
              location = :location, 
              website = :website, 
              phone = :phone, 
              primary_color = :primary_color, 
              secondary_color = :secondary_color";

if ($aliasesProvided) {
    $query .= ", aliases = :aliases";
}

if ($newLogoPath !== null) {
    $query .= ", logo_path = :logo_path";
}

if ($newBannerPath !== null) {
    $query .= ", banner_path = :banner_path";
}

$query .= " WHERE id = :community_id";

$stmt = $db->prepare($query);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . implode(" - ", $db->errorInfo())]);
    exit;
}

// Bind parameters
$stmt->bindParam(':name', $name);
$stmt->bindParam(':tagline', $tagline);
$stmt->bindParam(':location', $location);
$stmt->bindParam(':website', $website);
$stmt->bindValue(':phone', $phone !== '' ? $phone : null, PDO::PARAM_STR);
$stmt->bindParam(':primary_color', $primary_color);
$stmt->bindParam(':secondary_color', $secondary_color);
if ($aliasesProvided) {
    $stmt->bindValue(':aliases', $aliasesJson, PDO::PARAM_STR);
}
if ($newLogoPath !== null) {
    $stmt->bindParam(':logo_path', $newLogoPath);
}
if ($newBannerPath !== null) {
    $stmt->bindParam(':banner_path', $newBannerPath);
}
$stmt->bindParam(':community_id', $community_id, PDO::PARAM_STR);

// Execute the query and return the updated university data
error_log(sprintf('[%s] executing update query', $requestId));
if ($stmt->execute()) {
    error_log(sprintf('[%s] update success', $requestId));
    // Audit logging must never break a successful update response.
    try {
        $auditId = generateUniqueId($db, 'audit_logs');
        $auditAction = sprintf('community_settings_updated:%s', $community_id);
        $auditStmt = $db->prepare("
            INSERT INTO audit_logs (id, user_id, action, timestamp)
            VALUES (:id, :uid, :action, NOW())
        ");
        $auditStmt->execute([
            ':id' => $auditId,
            ':uid' => $sessionUserId,
            ':action' => $auditAction,
        ]);
    } catch (Throwable $auditError) {
        error_log('Audit log insert failed in update_university.php: ' . $auditError->getMessage());
    }

    // Fetch the updated record
    $selectStmt = $db->prepare("SELECT * FROM communities WHERE id = :community_id");
    $selectStmt->execute([':community_id' => $community_id]);
    $updatedUniversity = $selectStmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'university' => $updatedUniversity]);
} else {
    error_log(sprintf('[%s] update failed error=%s', $requestId, implode(' - ', $stmt->errorInfo())));
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Update failed: ' . implode(" - ", $stmt->errorInfo())]);
}

$stmt->closeCursor();
$db = null;
?>
