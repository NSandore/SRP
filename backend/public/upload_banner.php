<?php
// upload_banner.php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

header('Content-Type: application/json');

// Include the database connection
require_once __DIR__ . '/../db_connection.php';

if (srp_is_dev_mode()) {
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
}

// Check if the file is provided
if (!isset($_FILES['banner'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing banner file']);
    exit;
}

// The actor is always the authenticated session's own user, never the
// client-supplied user_id — this endpoint only ever replaces the caller's
// own banner.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}
$user_id = normalizeId($_SESSION['user_id']);

// Set upload directory path (adjust as needed)
$uploadDir = __DIR__ . '/../../uploads/banners/';

// Ensure the upload directory exists and is writable
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Upload directory does not exist and could not be created.']);
        exit;
    }
}
if (!is_writable($uploadDir)) {
    @chmod($uploadDir, 0775);
    if (!is_writable($uploadDir)) {
        $perms = substr(sprintf('%o', fileperms($uploadDir)), -4);
        $owner = fileowner($uploadDir);
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => "Upload directory is not writable (perms {$perms}, owner {$owner})."
        ]);
        exit;
    }
}

// Check for upload errors
if ($_FILES['banner']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File upload error: ' . $_FILES['banner']['error']]);
    exit;
}

// Validate file type. The stored extension is derived from the detected
// MIME type, never the client-supplied filename — otherwise a real image
// with an attacker-chosen name (e.g. "x.png.php") could be stored under an
// executable extension.
$allowedMimeTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png'];
$bannerMimeType = mime_content_type($_FILES['banner']['tmp_name']);
if (!isset($allowedMimeTypes[$bannerMimeType]) || @getimagesize($_FILES['banner']['tmp_name']) === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid file type. Only JPEG and PNG allowed.']);
    exit;
}

// Generate a unique filename
$extension = $allowedMimeTypes[$bannerMimeType];
$filename = 'banner_' . $user_id . '_' . time() . '.' . $extension;
$destination = $uploadDir . $filename;

// Move the uploaded file
if (move_uploaded_file($_FILES['banner']['tmp_name'], $destination)) {
    $storedName = $filename;
    $bannerPath = appendBannerPath($storedName);

    try {
        $db = getDB(); // Get the PDO connection

        // Retrieve the current banner path
        $stmt = $db->prepare("SELECT banner_path FROM users WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $current = $stmt->fetch();
        if ($current && isset($current['banner_path'])) {
            $currentBanner = appendBannerPath($current['banner_path']);
            // Delete the current file if it is not the default banner
            if ($currentBanner !== '/uploads/banners/DefaultBanner.jpeg') {
                $currentFile = __DIR__ . '/../../' . ltrim($currentBanner, '/');
                if (file_exists($currentFile)) {
                    unlink($currentFile);
                }
            }
        }

        // Update the user's banner path in the database. user_id is a
        // prefixed string id (e.g. "u1a2b3c..."), not an integer — binding
        // it as PARAM_INT previously coerced it to 0, silently matching no
        // row and orphaning the newly uploaded file.
        $stmt = $db->prepare("UPDATE users SET banner_path = :bannerPath WHERE user_id = :user_id");
        $stmt->bindParam(':bannerPath', $storedName);
        $stmt->bindParam(':user_id', $user_id, PDO::PARAM_STR);
        if (!$stmt->execute() || $stmt->rowCount() === 0) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database update failed: ' . implode(":", $stmt->errorInfo())]);
            exit;
        }

        echo json_encode(['success' => true, 'banner_path' => $bannerPath]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ']);
    }
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload failed.']);
}
?>
