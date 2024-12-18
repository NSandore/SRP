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
$limit = 10; // Number of universities per page
$offset = ($page - 1) * $limit;

$db = getDB();

try {
    // Create or replace the view
    $db->exec("
        CREATE OR REPLACE VIEW all_university_data AS
        SELECT 
            u.id AS university_id, 
            u.name, 
            u.location, 
            u.tagline, 
            u.logo_path, 
            COUNT(fu.user_id) AS followers_count
        FROM universities u
        LEFT JOIN followed_universities fu ON fu.university_id = u.id
        GROUP BY u.id, u.name, u.location, u.tagline, u.logo_path
    ");

    // Prepare the main query with search and pagination
    $query = "
        SELECT 
            aud.*, 
            CASE WHEN fu.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed
        FROM all_university_data aud
        LEFT JOIN followed_universities fu 
            ON aud.university_id = fu.university_id AND fu.user_id = :user_id
    ";

    $params = [':user_id' => $user_id];

    // Add search condition if search term is provided
    if ($search !== '') {
        $query .= " WHERE aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search";
        $params[':search'] = '%' . $search . '%';
    }

    $query .= " ORDER BY aud.name ASC LIMIT :limit OFFSET :offset";

    $stmt = $db->prepare($query);

    // Bind parameters
    foreach ($params as $key => &$val) {
        if ($key === ':limit' || $key === ':offset') {
            $stmt->bindParam($key, $val, PDO::PARAM_INT);
        } else {
            $stmt->bindParam($key, $val, PDO::PARAM_STR);
        }
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    $universities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get total count for pagination
    $countQuery = "
        SELECT COUNT(*) as total
        FROM all_university_data aud
    ";
    if ($search !== '') {
        $countQuery .= " WHERE aud.name LIKE :search OR aud.location LIKE :search OR aud.tagline LIKE :search";
    }

    $countStmt = $db->prepare($countQuery);
    if ($search !== '') {
        $countStmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
    }
    $countStmt->execute();
    $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalUniversities = $totalResult ? (int)$totalResult['total'] : 0;
    $totalPages = ceil($totalUniversities / $limit);

    // Structure the response
    $response = [
        'universities' => $universities,
        'total_pages' => $totalPages,
        'current_page' => $page
    ];

    echo json_encode($response);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
