<?php
// fetch_follower_count.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include database connection
require_once __DIR__ . '/../db_connection.php';

// Check that a user_id is provided
if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

// Sanitize and retrieve the user_id
$user_id = (int) $_GET['user_id'];

try {
    // Get the database connection
    $db = getDB();

    // Fetch the follower_count stored on the user record
    $queryFollowersCount = "
        SELECT follower_count
        FROM users
        WHERE user_id = :user_id
        LIMIT 1
    ";
    $stmtFollowersCount = $db->prepare($queryFollowersCount);
    $stmtFollowersCount->execute([':user_id' => $user_id]);
    $result = $stmtFollowersCount->fetch(PDO::FETCH_ASSOC);
    $count = $result ? (int) $result['follower_count'] : 0;

    // Return the follower count
    echo json_encode([
        'success' => true,
        'follower_count' => $count
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
