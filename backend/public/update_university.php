<?php
// update_university.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include the database connection
require_once __DIR__ . '/../db_connection.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

// Helper function to retrieve and trim POST values
function getPostValue($key, $default = null) {
    return isset($_POST[$key]) ? trim($_POST[$key]) : $default;
}

// Retrieve and validate required fields
$community_id = isset($_POST['community_id']) ? (int)$_POST['community_id'] : 0;
if ($community_id <= 0) {
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
$primary_color  = getPostValue('primary_color', '#0077B5');
$secondary_color = getPostValue('secondary_color', '#005f8d');

// Get a database connection
$db = getDB();

// Define upload directories (adjust these paths according to your folder structure)
$logoUploadDir = __DIR__ . '/../../uploads/logos/';
$bannerUploadDir = __DIR__ . '/../../uploads/banners/';

// Initialize variables to hold new file paths (if provided)
$newLogoPath = null;
$newBannerPath = null;

// Process logo file upload if provided
if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
    // Validate file type (allow JPEG, PNG, GIF)
    $allowedLogoTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $logoMimeType = mime_content_type($_FILES['logo']['tmp_name']);
    if (!in_array($logoMimeType, $allowedLogoTypes)) {
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
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Logo upload failed.']);
        exit;
    }
}

// Process banner file upload if provided
if (isset($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
    // Validate file type (allow only JPEG and PNG)
    $allowedBannerTypes = ['image/jpeg', 'image/png'];
    $bannerMimeType = mime_content_type($_FILES['banner']['tmp_name']);
    if (!in_array($bannerMimeType, $allowedBannerTypes)) {
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
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Banner upload failed.']);
        exit;
    }
}

// Build the UPDATE query
$query = "UPDATE communities 
          SET name = :name, 
              tagline = :tagline, 
              location = :location, 
              website = :website, 
              primary_color = :primary_color, 
              secondary_color = :secondary_color";

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
$stmt->bindParam(':primary_color', $primary_color);
$stmt->bindParam(':secondary_color', $secondary_color);
if ($newLogoPath !== null) {
    $stmt->bindParam(':logo_path', $newLogoPath);
}
if ($newBannerPath !== null) {
    $stmt->bindParam(':banner_path', $newBannerPath);
}
$stmt->bindParam(':community_id', $community_id, PDO::PARAM_INT);

// Execute the query and return the updated university data
if ($stmt->execute()) {
    // Fetch the updated record
    $selectStmt = $db->prepare("SELECT * FROM communities WHERE id = :community_id");
    $selectStmt->execute([':community_id' => $community_id]);
    $updatedUniversity = $selectStmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'university' => $updatedUniversity]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Update failed: ' . implode(" - ", $stmt->errorInfo())]);
}

$stmt->closeCursor();
$db = null;
?>
