<?php
// fetch_pinned_items.php

require_once __DIR__ . '/cors.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['community_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing community_id']);
    exit;
}

$communityId = normalizeId($_GET['community_id']);
if ($communityId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid community_id']);
    exit;
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$limit = max(1, min(50, $limit));

try {
    $db = getDB();

    $threadStmt = $db->prepare("
        SELECT
            pi.id AS pin_id,
            pi.community_id,
            pi.item_type,
            pi.item_id,
            pi.pinned_at,
            t.thread_id,
            t.forum_id,
            t.title,
            COALESCE(t.upvotes, 0) AS upvotes,
            COALESCE(t.downvotes, 0) AS downvotes,
            (
                SELECT COUNT(*)
                FROM posts p
                WHERE p.thread_id = t.thread_id
            ) AS post_count,
            COALESCE(f.name, 'Forum') AS forum_name
        FROM pinned_items pi
        JOIN threads t ON t.thread_id = pi.item_id
        LEFT JOIN forums f ON f.forum_id = t.forum_id
        WHERE pi.community_id = :cid
          AND pi.item_type = 'thread'
        ORDER BY pi.pinned_at DESC
        LIMIT :lim
    ");
    $threadStmt->bindValue(':cid', $communityId, PDO::PARAM_STR);
    $threadStmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $threadStmt->execute();
    $threads = $threadStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $forumStmt = $db->prepare("
        SELECT
            pi.id AS pin_id,
            pi.community_id,
            pi.item_type,
            pi.item_id,
            pi.pinned_at,
            f.forum_id,
            f.name AS title,
            f.description,
            COALESCE(f.upvotes, 0) AS upvotes,
            COALESCE(f.downvotes, 0) AS downvotes,
            (
                SELECT COUNT(*)
                FROM threads t
                WHERE t.forum_id = f.forum_id
            ) AS thread_count
        FROM pinned_items pi
        JOIN forums f ON f.forum_id = pi.item_id
        WHERE pi.community_id = :cid
          AND pi.item_type = 'forum'
        ORDER BY pi.pinned_at DESC
        LIMIT :lim
    ");
    $forumStmt->bindValue(':cid', $communityId, PDO::PARAM_STR);
    $forumStmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $forumStmt->execute();
    $forums = $forumStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $items = array_merge($threads, $forums);
    usort($items, static function ($a, $b) {
        $aTs = strtotime((string)($a['pinned_at'] ?? ''));
        $bTs = strtotime((string)($b['pinned_at'] ?? ''));
        return $bTs <=> $aTs;
    });
    $items = array_slice($items, 0, $limit);

    echo json_encode(['success' => true, 'items' => $items]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
    exit;
}
?>
