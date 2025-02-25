<?php
// fetch_ambassador_list.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include the database connection file
require_once __DIR__ . '/../db_connection.php';

// Check that community_id is provided
if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'community_id is required'
    ]);
    exit;
}

$community_id = (int) $_GET['community_id'];

try {
    $db = getDB();

    // Prepare a query to join ambassadors and users tables.
    // This query returns ambassador details for the specified community
    // along with selected user fields.
    $query = "SELECT 
                a.id,
                a.user_id,
                a.community_id,
                a.added_at,
                u.avatar_path,
                u.first_name,
                u.last_name,
                u.headline
              FROM ambassadors a
              JOIN users u ON a.user_id = u.user_id
              WHERE a.community_id = :community_id
              ORDER BY a.added_at ASC";
    
    $stmt = $db->prepare($query);
    $stmt->execute([':community_id' => $community_id]);
    $ambassadors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'ambassadors' => $ambassadors
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
}
?>
