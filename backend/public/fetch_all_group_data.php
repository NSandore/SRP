<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Check if user_id is provided
if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit;
}

$user_id = (int)$_GET['user_id'];
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$limit = 10; // Number of communities per page
$offset = ($page - 1) * $limit;

$db = getDB();

try {
    // Create or replace the view to include community_type
    $db->exec("
        CREATE OR REPLACE VIEW all_community_data AS
        SELECT 
            c.id AS community_id, 
            c.community_type, 
            c.name, 
            c.location, 
            c.tagline, 
            c.logo_path, 
            COUNT(fc.user_id) AS followers_count
        FROM communities c
        LEFT JOIN followed_communities fc ON fc.community_id = c.id
        GROUP BY c.id, c.community_type, c.name, c.location, c.tagline, c.logo_path
    ");

    // Prepare the main query with search, filtering by community_type = 'group', and pagination
    $query = "
        SELECT 
            aud.*, 
            CASE WHEN fc.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed
        FROM all_community_data aud
        LEFT JOIN followed_communities fc 
            ON aud.community_id = fc.community_id AND fc.user_id = :user_id
        WHERE aud.community_type = 'group'
    ";

    $params = [':user_id' => $user_id];

    // Add search condition if a search term is provided
    if ($search !== '') {
        $query .= " AND (aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }

    $query .= " ORDER BY aud.name ASC LIMIT :limit OFFSET :offset";

    $stmt = $db->prepare($query);

    // Bind parameters
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

    // Get total count for pagination (only groups)
    $countQuery = "
        SELECT COUNT(*) as total
        FROM all_community_data aud
        WHERE aud.community_type = 'group'
    ";
    if ($search !== '') {
        $countQuery .= " AND (aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search)";
    }

    $countStmt = $db->prepare($countQuery);
    if ($search !== '') {
        $countStmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
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
