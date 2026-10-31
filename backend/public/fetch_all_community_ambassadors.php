<?php
// fetch_all_community_ambassadors.php

require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized'
    ]);
    exit;
}

$user_id = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();

    // Fetch all followed community IDs for the user
    $communityQuery = "SELECT community_id FROM followed_communities WHERE user_id = :user_id";
    $stmt = $db->prepare($communityQuery);
    $stmt->execute([':user_id' => $user_id]);
    $followedCommunities = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!$followedCommunities) {
        echo json_encode([
            'success' => true,
            'ambassadors' => []
        ]);
        exit;
    }

    // Fetch ambassadors from all followed communities
    $placeholders = implode(',', array_fill(0, count($followedCommunities), '?'));

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
              WHERE a.community_id IN ($placeholders)
                AND u.deletion_status = 'active'
              ORDER BY a.added_at ASC";
    
    $stmt = $db->prepare($query);
    $stmt->execute($followedCommunities);
    $ambassadors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'ambassadors' => $ambassadors
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error'
    ]);
    exit;
}
?>
