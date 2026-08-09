<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/institution_data/PublicProjection.php';

header('Content-Type: application/json');

$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : null;
$isGuest = $user_id === null;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$scope = isset($_GET['scope']) ? strtolower(trim((string)$_GET['scope'])) : 'all';
if (!in_array($scope, ['all', 'followed', 'unfollowed'], true)) {
    $scope = 'all';
}
$sort = isset($_GET['sort']) ? strtolower(trim((string)$_GET['sort'])) : 'popularity';
if (!in_array($sort, ['popularity', 'alpha'], true)) {
    $sort = 'popularity';
}
$communityType = isset($_GET['community_type']) ? strtolower(trim((string)$_GET['community_type'])) : 'university';
if (!in_array($communityType, ['university', 'group'], true)) {
    $communityType = 'university';
}
$limit = 10; // Number of communities per page
$page = max(1, $page);
$offset = ($page - 1) * $limit;

$db = getDB();

try {
    $publicProjection = SrpInstitutionPublicProjection::selectList(
        $db,
        'c',
        ['id' => 'community_id']
    );
    $activePredicate = SrpInstitutionPublicProjection::activeUniversityPredicate($db, 'c');

    if ($isGuest) {
        $query = "
            SELECT
                {$publicProjection},
                (
                    SELECT COUNT(*)
                    FROM followed_communities follower_count
                    WHERE follower_count.community_id = c.id
                ) AS followers_count,
                0 AS is_followed
            FROM communities c
            WHERE c.community_type = :community_type
              AND {$activePredicate}
        ";
        $params = [':community_type' => $communityType];
    } else {
        $query = "
            SELECT
                {$publicProjection},
                (
                    SELECT COUNT(*)
                    FROM followed_communities follower_count
                    WHERE follower_count.community_id = c.id
                ) AS followers_count,
                CASE WHEN fc.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed
            FROM communities c
            LEFT JOIN followed_communities fc 
                ON c.id = fc.community_id AND fc.user_id = :user_id
            WHERE c.community_type = :community_type
              AND {$activePredicate}
        ";
        $params = [':user_id' => $user_id, ':community_type' => $communityType];

        if ($scope === 'followed') {
            $query .= " AND fc.user_id IS NOT NULL";
        } elseif ($scope === 'unfollowed') {
            $query .= " AND fc.user_id IS NULL";
        }
    }

    if ($search !== '') {
        $searchConditions = [
            'c.name LIKE :search',
            'c.location LIKE :search',
            'c.tagline LIKE :search',
            "(c.aliases IS NOT NULL AND JSON_SEARCH(c.aliases, 'one', :search_exact) IS NOT NULL)",
        ];
        foreach (['official_name', 'city', 'state', 'normalized_domain'] as $optionalSearchColumn) {
            if (SrpInstitutionPublicProjection::hasColumn($db, $optionalSearchColumn)) {
                $searchConditions[] = "c.`{$optionalSearchColumn}` LIKE :search";
            }
        }
        $query .= ' AND (' . implode(' OR ', $searchConditions) . ')';
        $params[':search'] = '%' . $search . '%';
        $params[':search_exact'] = $search;
    }

    $orderBy = $sort === 'alpha'
        ? " ORDER BY c.name ASC"
        : " ORDER BY followers_count DESC, c.name ASC";

    $query .= $orderBy . " LIMIT :limit OFFSET :offset";

    $stmt = $db->prepare($query);

    foreach ($params as $key => &$val) {
        $stmt->bindParam($key, $val, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!is_array($communities)) {
        $communities = [];
    }

    $countQuery = "
        SELECT COUNT(*) as total
        FROM communities c
        " . ($isGuest ? "" : "LEFT JOIN followed_communities fc ON c.id = fc.community_id AND fc.user_id = :user_id") . "
        WHERE c.community_type = :community_type
          AND {$activePredicate}
    ";
    if (!$isGuest) {
        if ($scope === 'followed') {
            $countQuery .= " AND fc.user_id IS NOT NULL";
        } elseif ($scope === 'unfollowed') {
            $countQuery .= " AND fc.user_id IS NULL";
        }
    }
    if ($search !== '') {
        $countQuery .= ' AND (' . implode(' OR ', $searchConditions) . ')';
    }

    $countStmt = $db->prepare($countQuery);
    $countStmt->bindValue(':community_type', $communityType, PDO::PARAM_STR);
    if (!$isGuest) {
        $countStmt->bindValue(':user_id', $user_id, PDO::PARAM_STR);
    }
    if ($search !== '') {
        $countStmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
        $countStmt->bindValue(':search_exact', $search, PDO::PARAM_STR);
    }
    $countStmt->execute();
    $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalCommunities = $totalResult ? (int)$totalResult['total'] : 0;
    $totalPages = max(1, (int)ceil($totalCommunities / $limit));

    $response = [
        'communities' => $communities,
        'total_pages' => $totalPages,
        'current_page' => $page
    ];

    echo json_encode($response);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>
