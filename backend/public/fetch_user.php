<?php
// fetch_user.php

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

// Safely retrieve and sanitize the user_id
$user_id = (int) $_GET['user_id'];

try {
    // Call getDB() to get the PDO connection
    $db = getDB();

    // Prepare and execute the query
    $query = "SELECT 
                user_id,
                role_id,
                recent_university_id,
                first_name,
                last_name,
                email,
                phone,
                education_status,
                is_over_18,
                created_at,
                updated_at,
                headline,
                about,
                skills,
                avatar_path,
                banner_path,
                primary_color,
                secondary_color,
                verified,
                verified_community_id
              FROM users
              WHERE user_id = :user_id";

    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'User not found'
        ]);
        exit;
    }

    // Return the user data
    echo json_encode([
        'success' => true,
        'user'    => $user
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database error: ' . $e->getMessage()
    ]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Server error: ' . $e->getMessage()
    ]);
    exit;
}
