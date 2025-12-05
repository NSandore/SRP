<?php
require_once __DIR__ . '/cors.php';
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 8;
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
    $viewer_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

    // Users (supports @prefix)
    $userTerm = $q[0] === '@' ? substr($q, 1) : $q;
    if ($userTerm !== '') {
        $stmt = $db->prepare("
            SELECT u.user_id, u.first_name, u.last_name, u.avatar_path, u.is_public
            FROM users u
            WHERE CONCAT(u.first_name, ' ', u.last_name) LIKE :uq
               OR u.email LIKE :uq
            ORDER BY u.login_count DESC, u.user_id DESC
            LIMIT :lim
        ");
        $stmt->bindValue(':uq', '%' . $userTerm . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($users as &$u) {
            if ((int)$u['is_public'] === 0 && $viewer_id !== (int)$u['user_id']) {
                $u['last_name'] = substr($u['last_name'], 0, 1) . '.';
            }
            unset($u['is_public']);
        }
        $results['users'] = $users;
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

    // Communities (universities/groups)
    $stmt = $db->prepare("
        SELECT id, community_type, name, tagline, location, logo_path, created_at
        FROM communities
        WHERE name LIKE :q OR tagline LIKE :q OR location LIKE :q
        ORDER BY created_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['communities'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Forums
    $stmt = $db->prepare("
        SELECT forum_id, community_id, name, description, upvotes, downvotes, last_activity_at, updated_at
        FROM forums
        WHERE name LIKE :q OR description LIKE :q
        ORDER BY (last_activity_at IS NULL), last_activity_at DESC, updated_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['forums'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Threads
    $stmt = $db->prepare("
        SELECT thread_id, forum_id, title, upvotes, downvotes, reply_count, last_activity_at
        FROM threads
        WHERE title LIKE :q
        ORDER BY (last_activity_at IS NULL), last_activity_at DESC, updated_at DESC
        LIMIT :lim
    ");
    $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $results['threads'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Posts (top-level only; exclude replies)
    $stmt = $db->prepare("
        SELECT p.post_id, p.thread_id, p.user_id, p.content, p.created_at, t.forum_id,
               p.upvotes, p.downvotes,
               (SELECT COUNT(*) FROM posts r WHERE r.reply_to = p.post_id) AS comment_count
        FROM posts p
        JOIN threads t ON t.thread_id = p.thread_id
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
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
