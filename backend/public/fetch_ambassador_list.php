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

    // Fetch ambassadors for this community
    $aQuery = "SELECT
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
    $aStmt = $db->prepare($aQuery);
    $aStmt->execute([':community_id' => $community_id]);
    $ambassadors = $aStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($ambassadors as &$amb) {
        $amb['is_admin'] = false;
    }

    // Fetch admins for this community
    $admQuery = "SELECT u.user_id, u.avatar_path, u.first_name, u.last_name, u.headline
                 FROM community_admins ca
                 JOIN users u ON ca.user_email = u.email
                 WHERE ca.community_id = :community_id";
    $admStmt = $db->prepare($admQuery);
    $admStmt->execute([':community_id' => $community_id]);
    $admins = $admStmt->fetchAll(PDO::FETCH_ASSOC);

    // Combine ambassadors and admins, marking admins appropriately
    $combined = [];
    foreach ($ambassadors as $amb) {
        $combined[$amb['user_id']] = $amb;
    }
    foreach ($admins as $adm) {
        if (isset($combined[$adm['user_id']])) {
            $combined[$adm['user_id']]['is_admin'] = true;
        } else {
            $combined[$adm['user_id']] = [
                'id' => null,
                'user_id' => $adm['user_id'],
                'community_id' => $community_id,
                'added_at' => null,
                'avatar_path' => $adm['avatar_path'],
                'first_name' => $adm['first_name'],
                'last_name' => $adm['last_name'],
                'headline' => $adm['headline'],
                'is_admin' => true
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'ambassadors' => array_values($combined)
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
