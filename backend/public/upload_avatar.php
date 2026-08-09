<?php
// upload_avatar.php

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

// Validate the request
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['avatar'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request.']);
    exit;
}

// The actor is always the authenticated session's own user, never the
// client-supplied user_id — this endpoint only ever replaces the caller's
// own avatar.
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}
$user_id = normalizeId($_SESSION['user_id']);
$uploadDir = __DIR__ . '/../../uploads/avatars/'; // Adjust the path as needed

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
if ($_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File upload error: ' . $_FILES['avatar']['error']]);
    exit;
}

// Validate the file type. The stored extension is derived from the
// detected MIME type, never the client-supplied filename — otherwise a
// real image with an attacker-chosen name (e.g. "x.gif.php") could be
// stored under an executable extension.
$allowedMimeTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif'];
$fileMimeType = mime_content_type($_FILES['avatar']['tmp_name']);
if (!isset($allowedMimeTypes[$fileMimeType]) || @getimagesize($_FILES['avatar']['tmp_name']) === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid file type. Only JPEG, PNG, and GIF are allowed.']);
    exit;
}

// Generate a unique filename
$fileExtension = $allowedMimeTypes[$fileMimeType];
$filename = 'avatar_' . $user_id . '_' . time() . '.' . $fileExtension;
$destination = $uploadDir . $filename;

// Move the uploaded file
if (move_uploaded_file($_FILES['avatar']['tmp_name'], $destination)) {
    $storedName = $filename;
    $relativePath = appendAvatarPath($storedName);

    try {
        $db = getDB(); // Get the PDO connection

        // Retrieve the current avatar path
        $stmt = $db->prepare("SELECT avatar_path FROM users WHERE user_id = ?");
        $stmt->execute([$user_id]);
        $current = $stmt->fetch();
        if ($current && isset($current['avatar_path'])) {
            $currentAvatar = appendAvatarPath($current['avatar_path']);
            // Delete the current file if it is not the default
            if ($currentAvatar !== '/uploads/avatars/DefaultAvatar.png') {
                // Build the absolute file path (adjust the prefix as needed)
                $currentFile = __DIR__ . '/../../' . ltrim($currentAvatar, '/');
                if (file_exists($currentFile)) {
                    unlink($currentFile);
                }
            }
        }

        // Update the user's avatar path in the database
        $stmt = $db->prepare("UPDATE users SET avatar_path = ? WHERE user_id = ?");
        $stmt->execute([$storedName, $user_id]);

        echo json_encode(['success' => true, 'avatar_path' => $relativePath]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ']);
    }
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload failed.']);
}
?>
