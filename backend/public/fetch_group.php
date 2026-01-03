<?php
// fetch_group.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

$community_id = normalizeId($_GET['community_id']);
$viewer_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : null;

try {
    $db = getDB();
    $stmt = $db->prepare(
        "SELECT c.*, COUNT(fc.user_id) AS followers_count
         FROM communities c
         LEFT JOIN followed_communities fc ON fc.community_id = c.id
         WHERE c.id = :id AND c.community_type = 'group'
         GROUP BY c.id"
    );
    $stmt->execute([':id' => $community_id]);
    $group = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$group) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Group not found']);
        exit;
    }
    if ($viewer_id) {
        $followStmt = $db->prepare(
            "SELECT 1 FROM followed_communities WHERE community_id = :community_id AND user_id = :user_id LIMIT 1"
        );
        $followStmt->execute([':community_id' => $community_id, ':user_id' => $viewer_id]);
        $group['is_following'] = (bool)$followStmt->fetchColumn();
    } else {
        $group['is_following'] = false;
    }

    // Resolve parent community details if present.
    if (!empty($group['parent_community_id'])) {
        $pstmt = $db->prepare("SELECT id, name, community_type FROM communities WHERE id = :pid LIMIT 1");
        $pstmt->execute([':pid' => $group['parent_community_id']]);
        $parent = $pstmt->fetch(PDO::FETCH_ASSOC);
        if ($parent) {
            $group['parent_name'] = $parent['name'];
            $group['parent_type'] = $parent['community_type'];
        }
    }

    // Count direct sub-communities (if any nested groups exist).
    $childStmt = $db->prepare("SELECT COUNT(*) FROM communities WHERE parent_community_id = :pid");
    $childStmt->execute([':pid' => $community_id]);
    $group['child_count'] = (int)$childStmt->fetchColumn();

    echo json_encode(['success' => true, 'group' => $group]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
?>
