<?php

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';
require_once __DIR__ . '/../includes/info_board_translations.php';

header('Content-Type: application/json');

$communityId = normalizeId($_GET['community_id'] ?? '');
$viewerId = normalizeId($_GET['user_id'] ?? '');

if ($communityId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'community_id is required']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT
            t.thread_id,
            t.forum_id,
            t.user_id,
            t.title,
            t.content_kind,
            t.is_locked,
            t.created_at,
            t.updated_at,
            t.last_activity_at,
            t.reply_count,
            u.first_name,
            u.last_name,
            p.post_id AS article_post_id,
            p.content AS article_content,
            (SELECT COUNT(*) FROM thread_votes tv WHERE tv.thread_id = t.thread_id AND tv.vote_type = 'up') AS upvotes,
            (SELECT vote_type FROM thread_votes tv WHERE tv.thread_id = t.thread_id AND tv.user_id = :viewer_id LIMIT 1) AS vote_type
        FROM forums f
        JOIN threads t ON t.forum_id = f.forum_id
        JOIN users u ON u.user_id = t.user_id
        LEFT JOIN posts p
          ON p.post_id = (
              SELECT p0.post_id
              FROM posts p0
              WHERE p0.thread_id = t.thread_id
                AND p0.reply_to IS NULL
                AND p0.is_hidden = 0
              ORDER BY p0.created_at ASC, p0.post_id ASC
              LIMIT 1
          )
        WHERE f.community_id = :community_id
          AND f.is_system_container = 1
          AND t.is_hidden = 0
        ORDER BY
          CASE t.content_kind WHEN 'article' THEN 0 WHEN 'megathread' THEN 1 ELSE 2 END,
          t.created_at ASC,
          t.thread_id ASC
    ");
    $stmt->execute([
        ':community_id' => $communityId,
        ':viewer_id' => $viewerId,
    ]);
    $articles = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $articles = srp_attach_tags_to_threads($db, $articles);

    if ($articles && srp_is_info_board_community($communityId)) {
        $articles = srp_translate_info_board_rows(
            $db,
            $articles,
            'thread',
            'thread_id',
            ['title']
        );
        $translatedPosts = srp_translate_info_board_rows(
            $db,
            $articles,
            'post',
            'article_post_id',
            ['article_content']
        );
        $articles = $translatedPosts;
    }

    foreach ($articles as &$article) {
        $plain = trim(preg_replace('/\s+/', ' ', strip_tags((string)($article['article_content'] ?? ''))));
        if (function_exists('mb_substr')) {
            $article['excerpt'] = mb_substr($plain, 0, 240) . (mb_strlen($plain) > 240 ? '…' : '');
        } else {
            $article['excerpt'] = substr($plain, 0, 240) . (strlen($plain) > 240 ? '…' : '');
        }
        unset($article['article_content'], $article['original_article_content']);
        $article['is_locked'] = (bool)$article['is_locked'];
        $article['reply_count'] = (int)$article['reply_count'];
        $article['upvotes'] = (int)$article['upvotes'];
    }
    unset($article);

    echo json_encode([
        'success' => true,
        'community_id' => $communityId,
        'articles' => $articles,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}

