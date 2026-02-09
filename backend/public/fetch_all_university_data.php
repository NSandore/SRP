<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : null;
$isGuest = $user_id === null;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$communityType = isset($_GET['community_type']) ? strtolower(trim((string)$_GET['community_type'])) : 'university';
if (!in_array($communityType, ['university', 'group'], true)) {
    $communityType = 'university';
}
$limit = 10; // Number of communities per page
$offset = ($page - 1) * $limit;

$db = getDB();

try {
    // Create or replace the view to include community_type
    $db->exec("
        CREATE OR REPLACE VIEW all_community_data AS
        SELECT 
            c.id AS community_id, 
            c.community_type,  -- Include community_type
            c.parent_community_id,
            c.name, 
            c.location, 
            c.tagline, 
            c.aliases,
            c.logo_path, 
            COUNT(fc.user_id) AS followers_count
        FROM communities c
        LEFT JOIN followed_communities fc ON fc.community_id = c.id
        GROUP BY c.id, c.community_type, c.parent_community_id, c.name, c.location, c.tagline, c.aliases, c.logo_path
    ");

    // Prepare the main query with search, filtering by community_type = 'university', and pagination
    if ($isGuest) {
        $query = "
            SELECT 
                aud.*, 
                0 AS is_followed
            FROM all_community_data aud
            WHERE aud.community_type = :community_type
        ";
        $params = [':community_type' => $communityType];
    } else {
        $query = "
            SELECT 
                aud.*, 
                CASE WHEN fc.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed
            FROM all_community_data aud
            LEFT JOIN followed_communities fc 
                ON aud.community_id = fc.community_id AND fc.user_id = :user_id
            WHERE aud.community_type = :community_type
        ";
        $params = [':user_id' => $user_id, ':community_type' => $communityType];
    }

    // Add search condition if a search term is provided
    if ($search !== '') {
        $query .= " AND (aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search";
        $query .= " OR (aud.aliases IS NOT NULL AND JSON_SEARCH(aud.aliases, 'one', :search_exact) IS NOT NULL)";
        $query .= ")";
        $params[':search'] = '%' . $search . '%';
        $params[':search_exact'] = $search;
    }

    $query .= " ORDER BY aud.name ASC LIMIT :limit OFFSET :offset";

    $stmt = $db->prepare($query);

    // Bind the parameters (note: :limit and :offset are bound separately below)
    foreach ($params as $key => &$val) {
        $stmt->bindParam($key, $val, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Ensure $communities is an array
    if (!is_array($communities)) {
        $communities = [];
    }

    // Get total count for pagination (only universities)
    $countQuery = "
        SELECT COUNT(*) as total
        FROM all_community_data aud
        WHERE aud.community_type = :community_type
    ";
    if ($search !== '') {
        $countQuery .= " AND (aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search";
        $countQuery .= " OR (aud.aliases IS NOT NULL AND JSON_SEARCH(aud.aliases, 'one', :search_exact) IS NOT NULL)";
        $countQuery .= ")";
    }

    $countStmt = $db->prepare($countQuery);
    $countStmt->bindValue(':community_type', $communityType, PDO::PARAM_STR);
    if ($search !== '') {
        $countStmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
        $countStmt->bindValue(':search_exact', $search, PDO::PARAM_STR);
    }
    $countStmt->execute();
    $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalCommunities = $totalResult ? (int)$totalResult['total'] : 0;
    $totalPages = ceil($totalCommunities / $limit);

    $response = [
        'communities' => $communities,
        'total_pages' => $totalPages,
        'current_page' => $page
    ];

    echo json_encode($response);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
