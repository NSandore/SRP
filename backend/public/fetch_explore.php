<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

$tagsParam = isset($_GET['tags']) ? trim($_GET['tags']) : '';
$limitForums = isset($_GET['limit_forums']) ? max(1, (int)$_GET['limit_forums']) : 24;
$limitThreads = isset($_GET['limit_threads']) ? max(1, (int)$_GET['limit_threads']) : 24;

try {
    $db = getDB();
    srp_ensure_tag_tables($db);

    $tagValues = [];
    if ($tagsParam !== '') {
        $tagValues = array_filter(array_map('trim', explode(',', $tagsParam)));
    }
    $tagIds = srp_resolve_tag_ids($db, $tagValues, 20);

    $tagPlaceholders = [];
    $tagParams = [];
    foreach ($tagIds as $idx => $tagId) {
        $ph = ":tg{$idx}";
        $tagPlaceholders[] = $ph;
        $tagParams[$ph] = $tagId;
    }
    $tagInClause = implode(',', $tagPlaceholders);

    // Forums
    $forumFilter = "f.is_hidden = 0";
    $forumJoin = "";
    if (!empty($tagIds)) {
        $forumJoin = "LEFT JOIN forum_tags ft ON ft.forum_id = f.forum_id";
        $forumFilter .= " AND ft.tag_id IN ({$tagInClause})";
    }

    $forumQuery = "
        SELECT 
            f.forum_id,
            f.community_id,
            f.name,
            f.description,
            f.created_at,
            COUNT(t.thread_id) AS thread_count,
            (SELECT COUNT(*) FROM forum_votes WHERE forum_id = f.forum_id AND vote_type = 'up') AS upvotes,
            (SELECT COUNT(*) FROM forum_votes WHERE forum_id = f.forum_id AND vote_type = 'down') AS downvotes
        FROM forums f
        LEFT JOIN threads t ON f.forum_id = t.forum_id
        {$forumJoin}
        WHERE {$forumFilter}
        GROUP BY f.forum_id, f.community_id, f.name, f.description, f.created_at
        ORDER BY COALESCE(f.last_activity_at, f.created_at) DESC
        LIMIT :forum_limit
    ";
    $forumStmt = $db->prepare($forumQuery);
    foreach ($tagParams as $key => $val) {
        $forumStmt->bindValue($key, $val);
    }
    $forumStmt->bindValue(':forum_limit', $limitForums, PDO::PARAM_INT);
    $forumStmt->execute();
    $forums = $forumStmt->fetchAll(PDO::FETCH_ASSOC);
    $forums = srp_attach_tags_to_forums($db, $forums);

    // Threads
    $threadFilter = "t.is_hidden = 0 AND f.is_hidden = 0";
    $threadJoins = "
        LEFT JOIN thread_tags tt ON tt.thread_id = t.thread_id
        LEFT JOIN forum_tags ft ON ft.forum_id = f.forum_id
    ";
    if (!empty($tagIds)) {
        $threadFilter .= " AND (tt.tag_id IN ({$tagInClause}) OR ft.tag_id IN ({$tagInClause}))";
    }

    $idSubquery = "
        SELECT DISTINCT t.thread_id
        FROM threads t
        INNER JOIN forums f ON t.forum_id = f.forum_id
        {$threadJoins}
        WHERE {$threadFilter}
    ";

    $threadQuery = "
        SELECT
            t.*,
            u.first_name,
            u.last_name,
            u.verified AS author_verified,
            ac.logo_path AS ambassador_logo_path,
            c.name AS community_name,
            c.community_type,
            c.id AS community_id,
            (SELECT COUNT(p.post_id) FROM posts p WHERE p.thread_id = t.thread_id) AS post_count
        FROM ({$idSubquery}) ids
        INNER JOIN threads t ON t.thread_id = ids.thread_id
        INNER JOIN forums f ON t.forum_id = f.forum_id
        INNER JOIN communities c ON f.community_id = c.id
        INNER JOIN users u ON t.user_id = u.user_id
        LEFT JOIN ambassadors a
               ON a.user_id = t.user_id
              AND a.community_id = c.id
        LEFT JOIN communities ac
               ON ac.id = a.community_id
        ORDER BY COALESCE(t.last_activity_at, t.created_at) DESC
        LIMIT :thread_limit
    ";

    $threadStmt = $db->prepare($threadQuery);
    foreach ($tagParams as $key => $val) {
        $threadStmt->bindValue($key, $val);
    }
    $threadStmt->bindValue(':thread_limit', $limitThreads, PDO::PARAM_INT);
    $threadStmt->execute();
    $threads = $threadStmt->fetchAll(PDO::FETCH_ASSOC);
    $threads = srp_attach_tags_to_threads($db, $threads);

    echo json_encode([
        'success' => true,
        'forums' => $forums,
        'threads' => $threads,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
