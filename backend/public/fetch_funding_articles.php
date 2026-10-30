<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/info_board_funding_collection.php';
require_once __DIR__ . '/../includes/info_board_translations.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    $groups = srp_info_board_funding_collection();
    $titles = srp_info_board_funding_titles();
    $placeholders = implode(', ', array_fill(0, count($titles), '?'));

    $stmt = $db->prepare("
        SELECT
            t.thread_id,
            t.forum_id,
            t.title,
            t.content_kind,
            t.created_at,
            p.post_id AS article_post_id,
            p.content AS article_content
        FROM forums f
        JOIN threads t ON t.forum_id = f.forum_id
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
        WHERE f.community_id = ?
          AND f.is_system_container = 1
          AND t.is_hidden = 0
          AND t.content_kind IN ('article', 'megathread')
          AND t.title IN ({$placeholders})
        ORDER BY t.created_at ASC, t.thread_id ASC
    ");
    $stmt->execute(array_merge([srp_info_board_community_id()], $titles));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Some guides intentionally appear in more than one place in the hierarchy.
    // The earliest seeded thread is the canonical Funding destination.
    $canonicalRows = [];
    foreach ($rows as $row) {
        $sourceTitle = (string)$row['title'];
        if (!isset($canonicalRows[$sourceTitle])) {
            $row['source_title'] = $sourceTitle;
            $canonicalRows[$sourceTitle] = $row;
        }
    }

    $translatedRows = array_values($canonicalRows);
    if ($translatedRows) {
        $translatedRows = srp_translate_info_board_rows(
            $db,
            $translatedRows,
            'thread',
            'thread_id',
            ['title']
        );
        $translatedRows = srp_translate_info_board_rows(
            $db,
            $translatedRows,
            'post',
            'article_post_id',
            ['article_content']
        );
    }

    $articlesBySourceTitle = [];
    foreach ($translatedRows as $row) {
        $plain = trim(preg_replace(
            '/\s+/',
            ' ',
            html_entity_decode(strip_tags((string)($row['article_content'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8')
        ));
        $length = function_exists('mb_strlen') ? mb_strlen($plain) : strlen($plain);
        $excerpt = function_exists('mb_substr') ? mb_substr($plain, 0, 180) : substr($plain, 0, 180);
        $articlesBySourceTitle[(string)$row['source_title']] = [
            'thread_id' => (string)$row['thread_id'],
            'forum_id' => (string)$row['forum_id'],
            'title' => (string)$row['title'],
            'content_kind' => (string)$row['content_kind'],
            'excerpt' => $excerpt . ($length > 180 ? '…' : ''),
        ];
    }

    $responseGroups = [];
    $articleCount = 0;
    foreach ($groups as $group) {
        $articles = [];
        foreach ($group['articles'] as $title) {
            if (isset($articlesBySourceTitle[$title])) {
                $articles[] = $articlesBySourceTitle[$title];
            }
        }
        if (!$articles) {
            continue;
        }
        $articleCount += count($articles);
        $responseGroups[] = [
            'key' => $group['key'],
            'title' => $group['title'],
            'description' => $group['description'],
            'articles' => $articles,
        ];
    }

    echo json_encode([
        'success' => true,
        'article_count' => $articleCount,
        'groups' => $responseGroups,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
