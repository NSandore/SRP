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

$community_id = normalizeId($_GET['community_id']);

try {
    $db = getDB();

    // Fetch ambassadors for this community
    $aQuery = "SELECT
                a.id,
                a.user_id,
                a.community_id,
                a.role,
                a.added_at,
                u.avatar_path,
                u.first_name,
                u.last_name,
                u.headline,
                u.email,
                COALESCE(s.show_online, 1) AS show_online,
                JSON_UNQUOTE(JSON_EXTRACT(s.extras, '$.last_seen_at')) AS last_seen_at
              FROM ambassadors a
              JOIN users u ON a.user_id = u.user_id
              LEFT JOIN account_settings s ON s.user_id = u.user_id
              WHERE a.community_id = :community_id
              ORDER BY a.added_at ASC";
    $aStmt = $db->prepare($aQuery);
    $aStmt->execute([':community_id' => $community_id]);
    $ambassadors = $aStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($ambassadors as &$amb) {
        if (empty($amb['role'])) {
            $amb['role'] = 'moderator';
        }
        $lastSeenTs = isset($amb['last_seen_at']) ? strtotime($amb['last_seen_at']) : false;
        $amb['is_online'] = ((int)$amb['show_online'] === 1) && $lastSeenTs !== false && (time() - $lastSeenTs) <= 300;
        unset($amb['last_seen_at']);
    }
    unset($amb);

    echo json_encode([
        'success' => true,
        'ambassadors' => array_values($ambassadors)
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
