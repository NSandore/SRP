<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/institution_data/PublicProjection.php';
header('Content-Type: application/json');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = min(50, max(1, isset($_GET['limit']) ? (int)$_GET['limit'] : 8));
$db = getDB();

$results = [
    'users' => [],
    'communities' => [],
    'forums' => [],
    'threads' => [],
    'posts' => [],
    'tags' => []
];

if ($q === '') {
    echo json_encode($results);
    exit;
}

try {
    $viewer_id = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';

    // Users (supports @prefix)
    $userTerm = $q[0] === '@' ? substr($q, 1) : $q;
    if ($userTerm !== '') {
        // Fetch viewer connections for discoverability "connections" handling
        $connections = [];
        if ($viewer_id) {
            $cstmt = $db->prepare("
                SELECT CASE WHEN user_id1 = :vid THEN user_id2 ELSE user_id1 END AS other_id
                FROM connections
                WHERE (user_id1 = :vid OR user_id2 = :vid) AND status = 'accepted'
            ");
            $cstmt->execute([':vid' => $viewer_id]);
            $connections = $cstmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        }

        $stmt = $db->prepare("
            SELECT u.user_id, u.first_name, u.last_name, u.avatar_path, u.is_public, COALESCE(s.discoverable, 2) AS discoverable
            FROM users u
            LEFT JOIN account_settings s ON s.user_id = u.user_id
            WHERE (CONCAT(u.first_name, ' ', u.last_name) LIKE :uq OR u.email LIKE :uq)
            ORDER BY u.login_count DESC, u.user_id DESC
            LIMIT :lim
        ");
        $stmt->bindValue(':uq', '%' . $userTerm . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':viewer', $viewer_id, PDO::PARAM_STR);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $filteredUsers = [];
        foreach ($users as $u) {
            $isViewer = $viewer_id !== '' && $u['user_id'] === $viewer_id;
            $disc = (int)$u['discoverable'];
            $isConnection = $isViewer ? false : in_array($u['user_id'], $connections, true);
            $canShow = $disc === 2 || ($disc === 1 && $isConnection) || $isViewer;
            if (!$canShow) {
                continue;
            }
            if ((int)$u['is_public'] === 0 && !$isViewer) {
                $u['last_name'] = substr($u['last_name'], 0, 1) . '.';
            }
            unset($u['is_public'], $u['discoverable']);
            $filteredUsers[] = $u;
        }
        $results['users'] = $filteredUsers;
    }

    // Tags (supports #prefix)
    if ($q[0] === '#') {
        $term = substr($q, 1);
        $stmt = $db->prepare("SELECT DISTINCT name FROM tags WHERE name LIKE :t OR slug LIKE :t LIMIT :lim");
        $stmt->bindValue(':t', '%' . $term . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $results['tags'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } else {
        $stmt = $db->prepare("SELECT DISTINCT name FROM tags WHERE name LIKE :t OR slug LIKE :t LIMIT :lim");
        $stmt->bindValue(':t', '%' . $q . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $results['tags'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // Discovery/search hides inactive universities from new selections while
    // leaving groups unaffected. Detail-by-ID endpoints remain unfiltered.
    $activeCommunityPredicate = SrpInstitutionPublicProjection::activeUniversityPredicate($db, 'c');
    $communitySearchConditions = [
        'c.name LIKE :q',
        'c.tagline LIKE :q',
        'c.location LIKE :q',
        "(c.aliases IS NOT NULL AND JSON_SEARCH(c.aliases, 'one', :community_alias) IS NOT NULL)",
    ];
    foreach (['official_name', 'city', 'state', 'normalized_domain'] as $optionalSearchColumn) {
        if (SrpInstitutionPublicProjection::hasColumn($db, $optionalSearchColumn)) {
            $communitySearchConditions[] = "c.`{$optionalSearchColumn}` LIKE :q";
        }
    }
    $communitySearchSql = implode(' OR ', $communitySearchConditions);
    $stmt = $db->prepare("
        SELECT 
            c.id, 
            c.community_type, 
            c.parent_community_id,
            c.name, 
            c.tagline, 
            c.location, 
            c.logo_path, 
            c.created_at,
            p.name AS parent_name
        FROM communities c
        LEFT JOIN communities p ON p.id = c.parent_community_id
        WHERE ({$communitySearchSql})
          AND {$activeCommunityPredicate}
        ORDER BY c.created_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':community_alias', $q, PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['communities'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Forums
    $stmt = $db->prepare("
        SELECT f.forum_id, f.community_id, f.name, f.description, f.upvotes, f.downvotes,
               f.last_activity_at, f.updated_at, c.name AS community_name
        FROM forums f
        JOIN communities c ON c.id = f.community_id
        WHERE f.name LIKE :q OR f.description LIKE :q
        ORDER BY (f.last_activity_at IS NULL), f.last_activity_at DESC, f.updated_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['forums'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Threads
    $stmt = $db->prepare("
        SELECT t.thread_id, t.forum_id, t.title, t.upvotes, t.downvotes, t.reply_count, t.last_activity_at,
               f.name AS forum_name, c.name AS community_name
        FROM threads t
        JOIN forums f ON f.forum_id = t.forum_id
        JOIN communities c ON c.id = f.community_id
        WHERE t.title LIKE :q
        ORDER BY (t.last_activity_at IS NULL), t.last_activity_at DESC, t.updated_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['threads'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Posts (top-level only; exclude replies)
    $stmt = $db->prepare("
        SELECT p.post_id, p.thread_id, p.user_id, p.content, p.created_at, t.forum_id,
               t.title AS thread_title, f.name AS forum_name, c.name AS community_name,
               p.upvotes, p.downvotes,
               (SELECT COUNT(*) FROM posts r WHERE r.reply_to = p.post_id) AS comment_count
        FROM posts p
        JOIN threads t ON t.thread_id = p.thread_id
        JOIN forums f ON f.forum_id = t.forum_id
        JOIN communities c ON c.id = f.community_id
        WHERE p.reply_to IS NULL AND p.content LIKE :q
        ORDER BY p.created_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['posts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($results);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
