<?php
// fetch_ambassador_list.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 0);
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
                a.community_role,
                a.added_at,
                u.avatar_path,
                u.first_name,
                u.last_name,
                u.headline,
                u.email,
                COALESCE(s.show_online, 1) AS show_online,
                JSON_UNQUOTE(JSON_EXTRACT(s.extras, '$.last_seen_at')) AS last_seen_at,
                JSON_EXTRACT(s.extras, '$.ambassador_specialties') AS ambassador_specialties,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.extras, '$.ambassador_accepting_questions')), '1') AS ambassador_accepting_questions,
                (SELECT COUNT(DISTINCT m.sender_id)
                   FROM messages m
                  WHERE m.recipient_id = a.user_id
                    AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recent_questioners
              FROM ambassadors a
              JOIN users u ON a.user_id = u.user_id
              LEFT JOIN account_settings s ON s.user_id = u.user_id
              WHERE a.community_id = :community_id
                AND u.deletion_status = 'active'
              ORDER BY recent_questioners ASC, a.added_at ASC";
    $aStmt = $db->prepare($aQuery);
    $aStmt->execute([':community_id' => $community_id]);
    $ambassadors = $aStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($ambassadors as &$amb) {
        if (empty($amb['community_role'])) {
            $amb['community_role'] = 'member';
        }
        $lastSeenTs = isset($amb['last_seen_at']) ? strtotime($amb['last_seen_at']) : false;
        $amb['is_online'] = ((int)$amb['show_online'] === 1) && $lastSeenTs !== false && (time() - $lastSeenTs) <= 300;
        $specialties = json_decode($amb['ambassador_specialties'] ?? '[]', true);
        $amb['ambassador_specialties'] = is_array($specialties) ? array_values($specialties) : [];
        $amb['ambassador_accepting_questions'] = filter_var($amb['ambassador_accepting_questions'], FILTER_VALIDATE_BOOLEAN);
        $recentQuestioners = (int)($amb['recent_questioners'] ?? 0);
        $amb['availability'] = $recentQuestioners >= 8 ? 'limited' : 'available';
        unset($amb['last_seen_at']);
        unset($amb['recent_questioners']);
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
        'error' => 'Database error'
    ]);
    exit;
}
?>
