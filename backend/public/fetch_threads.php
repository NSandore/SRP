<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';
require_once __DIR__ . '/../includes/info_board_translations.php';

header('Content-Type: application/json');

$forum_id = isset($_GET['forum_id']) ? normalizeId($_GET['forum_id']) : '';
if ($forum_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'forum_id is required']);
    exit;
}
// Get the current user's ID if provided; default to empty if not logged in
$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : '';
$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT 
            t.thread_id,
            t.forum_id,
            f.community_id,
            t.user_id,
            u.first_name,
            u.last_name,
            u.verified AS author_verified,
            ac.logo_path AS ambassador_logo_path,
            t.title,
            t.image_path,
            t.image_layout,
            t.created_at,
            t.updated_at,
            t.updated_by,
            ub.first_name AS updated_by_first_name,
            ub.last_name AS updated_by_last_name,
            ub.avatar_path AS updated_by_avatar_path,
            -- Count upvotes and downvotes from thread_votes
            (SELECT COUNT(*) FROM thread_votes WHERE thread_id = t.thread_id AND vote_type = 'up') AS upvotes,
            (SELECT COUNT(*) FROM thread_votes WHERE thread_id = t.thread_id AND vote_type = 'down') AS downvotes,
            -- Get the current user's vote on this thread (if any)
            (SELECT vote_type FROM thread_votes WHERE thread_id = t.thread_id AND user_id = :user_id LIMIT 1) AS vote_type,
            COUNT(p.post_id) AS post_count
        FROM threads t
        JOIN forums f ON t.forum_id = f.forum_id
        JOIN users u ON u.user_id = t.user_id
        LEFT JOIN ambassadors a
               ON a.user_id = t.user_id
              AND a.community_id = f.community_id
        LEFT JOIN communities ac
               ON ac.id = a.community_id
        LEFT JOIN users ub ON ub.user_id = t.updated_by
        LEFT JOIN posts p ON t.thread_id = p.thread_id
        WHERE t.forum_id = :forum_id
          AND t.is_hidden = 0
        GROUP BY t.thread_id, t.forum_id, f.community_id, t.user_id, u.first_name, u.last_name, u.verified, ac.logo_path, t.title, t.image_path, t.image_layout, t.created_at, t.updated_at, t.updated_by, ub.first_name, ub.last_name, ub.avatar_path
        ORDER BY t.created_at DESC
    ");
    $stmt->execute([
      ':forum_id' => $forum_id,
      ':user_id' => $user_id
    ]);
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $threads = srp_attach_tags_to_threads($db, $threads);
    foreach ($threads as &$t) {
        $t['updated_by_avatar_path'] = appendAvatarPath($t['updated_by_avatar_path'] ?? null);
    }
    unset($t);

    if ($threads && srp_is_info_board_community($threads[0]['community_id'] ?? '')) {
        $threads = srp_translate_info_board_rows(
            $db,
            $threads,
            'thread',
            'thread_id',
            ['title']
        );
    }

    echo json_encode($threads);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>
