<?php
// upload_banner.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include the database connection
require_once __DIR__ . '/../db_connection.php';

// Check if file and user_id are provided
if (!isset($_POST['user_id']) || !isset($_FILES['banner'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id or banner file']);
    exit;
}

$user_id = intval($_POST['user_id']);

// Set upload directory path (adjust as needed)
$uploadDir = __DIR__ . '/../../uploads/banners/';

// Ensure the upload directory exists and is writable
if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload directory does not exist or is not writable.']);
    exit;
}

// Check for upload errors
if ($_FILES['banner']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File upload error: ' . $_FILES['banner']['error']]);
    exit;
}

// Validate file type
$allowedMimeTypes = ['image/jpeg', 'image/png'];
if (!in_array($_FILES['banner']['type'], $allowedMimeTypes)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid file type. Only JPEG and PNG allowed.']);
    exit;
}

// Generate a unique filename
$extension = pathinfo($_FILES['banner']['name'], PATHINFO_EXTENSION);
$filename = 'banner_' . $user_id . '_' . time() . '.' . $extension;
$destination = $uploadDir . $filename;

// Move the uploaded file
if (move_uploaded_file($_FILES['banner']['tmp_name'], $destination)) {
    $bannerPath = '/uploads/banners/' . $filename;

    try {
        $db = getDB(); // Get the PDO connection

        // Retrieve the current banner path
        $stmt = $db->prepare("SELECT banner_path FROM users WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $current = $stmt->fetch();
        if ($current && isset($current['banner_path'])) {
            $currentBanner = $current['banner_path'];
            // Delete the current file if it is not the default banner
            if ($currentBanner !== '/uploads/banners/default-banner.jpg') {
                $currentFile = __DIR__ . '/../../' . ltrim($currentBanner, '/');
                if (file_exists($currentFile)) {
                    unlink($currentFile);
                }
            }
        }

        // Update the user's banner path in the database
        $stmt = $db->prepare("UPDATE users SET banner_path = :bannerPath WHERE user_id = :user_id");
        $stmt->bindParam(':bannerPath', $bannerPath);
        $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database update failed: ' . implode(":", $stmt->errorInfo())]);
            exit;
        }

        echo json_encode(['success' => true, 'banner_path' => $bannerPath]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload failed.']);
}
?>
