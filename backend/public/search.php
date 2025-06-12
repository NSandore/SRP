<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
$db = getDB();

$results = [
    'users' => [],
    'forums' => [],
    'threads' => [],
    'tags' => []
];

if ($q === '') {
    echo json_encode($results);
    exit;
}

try {
    if ($q[0] === '@') {
        $term = substr($q, 1);
        $stmt = $db->prepare("SELECT up.user_id, up.first_name, up.last_name, u.is_public FROM user_profiles up JOIN users u ON up.user_id = u.user_id WHERE CONCAT(up.first_name,' ',up.last_name) LIKE :q LIMIT :lim");
        $stmt->bindValue(':q', '%' . $term . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $viewer_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        foreach ($users as &$u) {
            if ((int)$u['is_public'] === 0 && $viewer_id !== (int)$u['user_id']) {
                $u['last_name'] = substr($u['last_name'], 0, 1) . '.';
            }
            unset($u['is_public']);
        }
        $results['users'] = $users;
    } elseif ($q[0] === '#') {
        $term = substr($q, 1);
        $stmt = $db->prepare("SELECT DISTINCT LOWER(SUBSTRING_INDEX(SUBSTRING(content, LOCATE('#', content)+1), ' ', 1)) AS tag FROM posts WHERE content LIKE :q LIMIT :lim");
        $stmt->bindValue(':q', '%#' . $term . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $tags = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $results['tags'] = array_filter($tags);
    } else {
        $stmt = $db->prepare("SELECT forum_id, name FROM forums WHERE name LIKE :q LIMIT :lim");
        $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $results['forums'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $db->prepare("SELECT thread_id, forum_id, title FROM threads WHERE title LIKE :q LIMIT :lim");
        $stmt->bindValue(':q', '%' . $q . '%', PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $results['threads'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode($results);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
