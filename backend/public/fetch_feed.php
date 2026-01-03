<?php
// fetch_feed.php

session_start();
header('Content-Type: application/json');
require_once '../db_connection.php';

if (!isset($_GET['user_id'])) {
    echo json_encode(["success" => false, "error" => "Missing user_id"]);
    exit;
}

$user_id = normalizeId($_GET['user_id']);
$sort = isset($_GET['sort']) ? strtolower(trim($_GET['sort'])) : 'recent';
if (!in_array($sort, ['recent', 'trending'], true)) {
    $sort = 'recent';
}

try {
    $db = getDB();

    // Helpers
    $tableExists = function (PDO $db, string $tableName): bool {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t");
        $stmt->execute([':t' => $tableName]);
        return (bool)$stmt->fetchColumn();
    };

    // Followed communities
    $fcStmt = $db->prepare("SELECT community_id FROM followed_communities WHERE user_id = :uid");
    $fcStmt->execute([':uid' => $user_id]);
    $followedCommunities = $fcStmt->fetchAll(PDO::FETCH_COLUMN);

    // Followed users
    $fuStmt = $db->prepare("SELECT followed_user_id FROM user_follows WHERE follower_id = :uid");
    $fuStmt->execute([':uid' => $user_id]);
    $followedUsers = $fuStmt->fetchAll(PDO::FETCH_COLUMN);

    // Interest tags (if table exists)
    $interestTags = [];
    if ($tableExists($db, 'user_interests')) {
        $tiStmt = $db->prepare("SELECT tag_id FROM user_interests WHERE user_id = :uid");
        $tiStmt->execute([':uid' => $user_id]);
        $interestTags = $tiStmt->fetchAll(PDO::FETCH_COLUMN);
    }

    $conditions = [];
    $params = [':uid' => $user_id];
    $placeholders = [];

    $addInClause = function (array $items, string $prefix, string $field) use (&$params, &$placeholders) {
        $localPlaceholders = [];
        foreach ($items as $idx => $val) {
            $ph = ":{$prefix}{$idx}";
            $localPlaceholders[] = $ph;
            $params[$ph] = $val;
        }
        if (!empty($localPlaceholders)) {
            $placeholders[$field] = implode(',', $localPlaceholders);
        }
    };

    $addInClause($followedCommunities, 'fc', 'community');
    $addInClause($followedUsers, 'fu', 'user');
    $addInClause($interestTags, 'tg', 'tag');

    if (!empty($placeholders['community'])) {
        $conditions[] = "f.community_id IN ({$placeholders['community']})";
    }
    if (!empty($placeholders['user'])) {
        $conditions[] = "t.user_id IN ({$placeholders['user']})";
    }
    if (!empty($placeholders['tag'])) {
        $conditions[] = "tt.tag_id IN ({$placeholders['tag']})";
    }

    if (empty($conditions)) {
        echo json_encode(["success" => true, "threads" => []]);
        exit;
    }

    $whereClause = implode(' OR ', $conditions);
    $orderClause = $sort === 'trending'
        ? "ORDER BY (t.upvotes - t.downvotes) DESC, COALESCE(t.last_activity_at, t.created_at) DESC"
        : "ORDER BY COALESCE(t.last_activity_at, t.created_at) DESC";

    // Build an ID-only subquery to satisfy ONLY_FULL_GROUP_BY
    $idSubquery = "
        SELECT DISTINCT t.thread_id
        FROM threads t
        INNER JOIN forums f ON t.forum_id = f.forum_id
        INNER JOIN communities c ON f.community_id = c.id
        LEFT JOIN thread_tags tt ON tt.thread_id = t.thread_id
        WHERE {$whereClause}
          AND t.is_hidden = 0
          AND f.is_hidden = 0
    ";

    $query = "
        SELECT 
          t.*, 
          COALESCE(tv.vote_type, '') AS user_vote,
          u.first_name, 
          u.last_name,
          c.name AS community_name,
          c.community_type,
          c.id AS community_id
        FROM ({$idSubquery}) ids
        INNER JOIN threads t ON t.thread_id = ids.thread_id
        LEFT JOIN thread_votes tv 
          ON t.thread_id = tv.thread_id 
         AND tv.user_id = :uid
        INNER JOIN forums f 
          ON t.forum_id = f.forum_id
        INNER JOIN communities c 
          ON f.community_id = c.id
        INNER JOIN users u
          ON t.user_id = u.user_id
        {$orderClause}
    ";

    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "threads" => $threads]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
}
?>
