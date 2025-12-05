<?php
// fetch_connections_list.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include your database connection function
require_once __DIR__ . '/../db_connection.php';

// Check that a user_id is provided
if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

// Sanitize and retrieve the user_id
$user_id = normalizeId($_GET['user_id']);

try {
    // Get the database connection
    $db = getDB();

// Fetch the list of users this user follows (only accepted connections treated as follow)
$queryFollowing = "
    SELECT followed_user_id
    FROM user_follows
    WHERE follower_id = :user_id
";
$stmtFollowing = $db->prepare($queryFollowing);
$stmtFollowing->execute([':user_id' => $user_id]);
$following = $stmtFollowing->fetchAll(PDO::FETCH_COLUMN); // Get an array of followed user IDs

// Fetch the list of users that follow this user
$queryFollowers = "
    SELECT follower_id
    FROM user_follows
    WHERE followed_user_id = :user_id
";
$stmtFollowers = $db->prepare($queryFollowers);
$stmtFollowers->execute([':user_id' => $user_id]);
$followers = $stmtFollowers->fetchAll(PDO::FETCH_COLUMN); // Get an array of follower user IDs

// Return the lists
echo json_encode([
    'success' => true,
    'following' => $following,
        'followers' => $followers
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}
