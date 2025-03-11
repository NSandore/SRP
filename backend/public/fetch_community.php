<?php
// fetch_community.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include database connection
require_once __DIR__ . '/../db_connection.php';

// Check if community_id is provided
if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

// Sanitize input
$community_id = (int) $_GET['community_id'];

try {
    $db = getDB();

    // Fetch the community name and logo_path
    $query = "SELECT * FROM communities WHERE id = :community_id";
    $stmt = $db->prepare($query);
    $stmt->execute([':community_id' => $community_id]);
    $community = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$community) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Community not found']);
        exit;
    }

    // Return community data
    echo json_encode([
        'success'   => true,
        'community' => $community
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
    exit;
}
?>
