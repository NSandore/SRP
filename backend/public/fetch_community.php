<?php
// fetch_community.php

require_once __DIR__ . '/cors.php';

// Keep production responses valid JSON; errors remain available in server logs.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include database connection
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/institution_data/PublicProjection.php';

// Check if community_id is provided
if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

// Sanitize input
$community_id = normalizeId($_GET['community_id']);
if ($community_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

try {
    $db = getDB();

    // Keep this detail-by-ID lookup available for inactive universities while
    // exposing only the explicit public projection.
    $publicProjection = SrpInstitutionPublicProjection::selectList($db, 'c');
    $query = "SELECT {$publicProjection}
              FROM communities c
              WHERE c.id = :community_id
              LIMIT 1";
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
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ']);
    exit;
}
?>
