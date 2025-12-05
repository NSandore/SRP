<?php
session_start(); // Start the session

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');
require_once '../db_connection.php';
$db = getDB();

// Get the raw POST data and decode the JSON payload.
$input = json_decode(file_get_contents('php://input'), true);

// Validate input.
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input data']);
    exit;
}

if (!isset($input['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

// Retrieve and sanitize the data.
$user_id       = normalizeId($input['user_id']);
$first_name    = isset($input['first_name']) ? trim($input['first_name']) : null;
$last_name     = isset($input['last_name']) ? trim($input['last_name']) : null;
$headline      = isset($input['headline']) ? trim($input['headline']) : null;
$about         = isset($input['about']) ? trim($input['about']) : null;
$is_public     = isset($input['is_public']) ? (int)$input['is_public'] : 1;
$skills        = isset($input['skills']) ? (is_array($input['skills']) ? implode(", ", $input['skills']) : trim($input['skills'])) : null;
$avatar_path   = isset($input['avatar_path']) ? stripUploadPrefix(trim($input['avatar_path'])) : null;
$banner_path   = isset($input['banner_path']) ? stripUploadPrefix(trim($input['banner_path'])) : null;
$primary_color = isset($input['primary_color']) ? trim($input['primary_color']) : null;
$secondary_color = isset($input['secondary_color']) ? trim($input['secondary_color']) : null;

// Handle skills field: if it's an array, join it into a comma-separated string; otherwise, trim the string.
if (isset($input['skills'])) {
    if (is_array($input['skills'])) {
        $skills = implode(", ", array_map('trim', $input['skills']));
    } else {
        $skills = trim($input['skills']);
    }
} else {
    $skills = null;
}

// Prepare the UPDATE query.
$query = "UPDATE users 
          SET first_name = :first_name,
              last_name = :last_name,
              headline = :headline,
              about = :about,
              skills = :skills,
              avatar_path = :avatar_path,
              banner_path = :banner_path,
              primary_color = :primary_color,
              secondary_color = :secondary_color,
              is_public = :is_public
          WHERE user_id = :user_id";

$stmt = $db->prepare($query);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . implode(" - ", $db->errorInfo())]);
    exit;
}

// Bind parameters to the query.
$stmt->bindParam(':first_name', $first_name);
$stmt->bindParam(':last_name', $last_name);
$stmt->bindParam(':headline', $headline);
$stmt->bindParam(':about', $about);
$stmt->bindParam(':skills', $skills);
$stmt->bindParam(':avatar_path', $avatar_path);
$stmt->bindParam(':banner_path', $banner_path);
$stmt->bindParam(':primary_color', $primary_color);
$stmt->bindParam(':secondary_color', $secondary_color);
$stmt->bindParam(':is_public', $is_public, PDO::PARAM_INT);
$stmt->bindParam(':user_id', $user_id, PDO::PARAM_STR);

if ($stmt->execute()) {
    // Update the session with new profile data
    $_SESSION['first_name'] = $first_name;
    $_SESSION['last_name'] = $last_name;
    $_SESSION['headline'] = $headline;
    $_SESSION['about'] = $about;
    $_SESSION['skills'] = $skills;
    $_SESSION['avatar_path'] = appendAvatarPath($avatar_path);          // Update this key
    $_SESSION['banner_path'] = appendBannerPath($banner_path);          // And this key
    $_SESSION['primary_color'] = $primary_color;
    $_SESSION['secondary_color'] = $secondary_color;
    $_SESSION['is_public'] = $is_public;
    
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    error_log("Execute failed: " . implode(" - ", $stmt->errorInfo()));
    echo json_encode(['success' => false, 'error' => 'Update failed: ' . implode(" - ", $stmt->errorInfo())]);
}

$stmt->closeCursor();
$db = null;
?>
