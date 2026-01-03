<?php
// fetch_subcommunities.php
// Retrieve all child communities for a given parent community.

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['parent_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing parent_id']);
    exit;
}

$parentId = normalizeId($_GET['parent_id']);
$viewerId = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : null;

try {
    $db = getDB();

    // Verify parent exists
    $pstmt = $db->prepare("SELECT id, name, community_type FROM communities WHERE id = :pid LIMIT 1");
    $pstmt->execute([':pid' => $parentId]);
    $parent = $pstmt->fetch(PDO::FETCH_ASSOC);
    if (!$parent) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Parent community not found']);
        exit;
    }

    $params = [':parent_id' => $parentId];
    $followSelect = '';
    $followJoin = '';
    if ($viewerId) {
        $followSelect = ', CASE WHEN uf.user_id IS NULL THEN 0 ELSE 1 END AS is_following';
        $followJoin = 'LEFT JOIN followed_communities uf ON uf.community_id = c.id AND uf.user_id = :viewer_id';
        $params[':viewer_id'] = $viewerId;
    }

    $query = "
        SELECT 
            c.id AS community_id,
            c.parent_community_id,
            c.community_type,
            c.name,
            c.tagline,
            c.location,
            c.logo_path,
            COUNT(fc.user_id) AS followers_count
            {$followSelect}
        FROM communities c
        LEFT JOIN followed_communities fc ON fc.community_id = c.id
        {$followJoin}
        WHERE c.parent_community_id = :parent_id
        GROUP BY c.id, c.parent_community_id, c.community_type, c.name, c.tagline, c.location, c.logo_path
        ORDER BY c.name ASC
    ";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $children = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    echo json_encode([
        'success' => true,
        'parent' => $parent,
        'subcommunities' => $children
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
