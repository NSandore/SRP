<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

// Validate that thread_id is provided
if (!isset($_GET['thread_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'thread_id is required']);
    exit;
}

$thread_id = normalizeId($_GET['thread_id']);

// Retrieve user_id from query params if provided
$user_id = isset($_GET['user_id']) ? normalizeId($_GET['user_id']) : '';

$db = getDB();

try {
    // Left join post_votes to get a per-post user_vote
    $stmt = $db->prepare("
        SELECT 
            p.post_id,
            p.thread_id,
            p.user_id,
            p.content,
            p.created_at,
            p.upvotes,
            p.downvotes,
            p.reply_to,
            p.verified,
            p.verified_by,
            p.verified_at,
            v.vote_type AS user_vote,
            u.first_name,
            u.last_name,
            u.avatar_path,
            CASE 
              WHEN c.user_id1 IS NOT NULL THEN 1 
              ELSE 0 
            END AS is_connection
        FROM posts p
        LEFT JOIN post_votes v
               ON p.post_id = v.post_id
              AND v.user_id = :user_id
        LEFT JOIN users u ON u.user_id = p.user_id
        LEFT JOIN connections c 
               ON c.status = 'accepted'
              AND (
                    (c.user_id1 = :user_id AND c.user_id2 = p.user_id)
                 OR (c.user_id2 = :user_id AND c.user_id1 = p.user_id)
                  )
        WHERE p.thread_id = :thread_id
          AND p.is_hidden = 0
        ORDER BY p.created_at ASC
    ");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id
    ]);
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalize avatar paths
    foreach ($posts as &$p) {
        $p['avatar_path'] = appendAvatarPath($p['avatar_path'] ?? null);
    }

    echo json_encode($posts);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
