<?php
// fetch_connections_list.php

require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';

header('Content-Type: application/json');

// Include your database connection function
require_once __DIR__ . '/../db_connection.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$user_id = normalizeId($_SESSION['user_id']);

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
        'error' => 'Database error'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error'
    ]);
}
