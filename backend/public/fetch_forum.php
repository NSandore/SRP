<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';
require_once __DIR__ . '/../includes/info_board_translations.php';

header('Content-Type: application/json');

if (!isset($_GET['forum_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'forum_id is required']);
    exit;
}

$forum_id = normalizeId($_GET['forum_id']);
$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT
            f.forum_id,
            f.community_id,
            f.name,
            f.description,
            f.banner_path,
            f.image_layout,
            f.created_at,
            f.created_by,
            u.first_name AS created_by_first_name,
            u.last_name AS created_by_last_name,
            u.avatar_path AS created_by_avatar_path
        FROM forums f
        LEFT JOIN users u ON u.user_id = f.created_by
        WHERE f.forum_id = :forum_id
          AND f.is_hidden = 0
    ");
    $stmt->execute([':forum_id' => $forum_id]);
    $forum = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($forum) {
        $forum['created_by_avatar_path'] = appendAvatarPath($forum['created_by_avatar_path'] ?? null);
        $forum['banner_path'] = appendBannerPath($forum['banner_path'] ?? null);
        if (srp_is_info_board_community($forum['community_id'] ?? '')) {
            $translated = srp_translate_info_board_rows(
                $db,
                [$forum],
                'forum',
                'forum_id',
                ['name', 'description']
            );
            $forum = $translated[0] ?? $forum;
        }
        $withTags = srp_attach_tags_to_forums($db, [$forum]);
        echo json_encode($withTags[0]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Forum not found']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>
