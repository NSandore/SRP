<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

if (!isset($_GET['thread_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'thread_id is required']);
    exit;
}

$thread_id = normalizeId($_GET['thread_id']);
$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : ''; // Optional user_id for vote tracking
$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT 
            t.thread_id, 
            t.forum_id, 
            t.user_id, 
            u.first_name,
            u.last_name,
            u.avatar_path AS creator_avatar_path,
            t.title, 
            t.created_at, 
            t.updated_at,
            t.updated_by,
            ub.first_name AS updated_by_first_name,
            ub.last_name AS updated_by_last_name,
            t.upvotes, 
            t.downvotes,
            f.name AS forum_name,
            f.community_id,
            c.community_type,
            (SELECT vote_type FROM thread_votes WHERE thread_id = t.thread_id AND user_id = :user_id) AS user_vote
        FROM threads t
        JOIN users u ON u.user_id = t.user_id
        JOIN forums f ON t.forum_id = f.forum_id
        JOIN communities c ON f.community_id = c.id
        LEFT JOIN users ub ON ub.user_id = t.updated_by
        WHERE t.thread_id = :thread_id
          AND t.is_hidden = 0
          AND f.is_hidden = 0
    ");
    $stmt->execute([':thread_id' => $thread_id, ':user_id' => $user_id]);
    $thread = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($thread) {
        $thread['creator_avatar_path'] = appendAvatarPath($thread['creator_avatar_path'] ?? null);
        $withTags = srp_attach_tags_to_threads($db, [$thread]);
        echo json_encode($withTags[0]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Thread not found']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
