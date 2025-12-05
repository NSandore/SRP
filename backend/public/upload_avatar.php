<?php
// upload_avatar.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include the database connection
require_once __DIR__ . '/../db_connection.php';

// Validate the request
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['avatar']) || !isset($_POST['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request.']);
    exit;
}

$user_id = normalizeId($_POST['user_id']);
$uploadDir = __DIR__ . '/../../uploads/avatars/'; // Adjust the path as needed

// Ensure the upload directory exists and is writable
if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload directory does not exist or is not writable.']);
    exit;
}

// Check for upload errors
if ($_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File upload error: ' . $_FILES['avatar']['error']]);
    exit;
}

// Validate the file type
$allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
$fileMimeType = mime_content_type($_FILES['avatar']['tmp_name']);
if (!in_array($fileMimeType, $allowedMimeTypes)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid file type. Only JPEG, PNG, and GIF are allowed.']);
    exit;
}

// Generate a unique filename
$fileExtension = pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION);
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
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload failed.']);
}
?>
