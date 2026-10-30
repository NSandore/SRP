<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';

[$db, $viewerId] = srp_bootstrap(requireAuth: false);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$scope = strtolower(trim((string)($_GET['scope'] ?? 'feed')));
if (!in_array($scope, ['feed', 'saved'], true)) {
    $scope = 'feed';
}
$targetUserId = normalizeId($_GET['user_id'] ?? '');
$communityId = normalizeId($_GET['community_id'] ?? '');
$priorityReelId = normalizeId($_GET['reel_id'] ?? '');
$limit = max(1, min(30, (int)($_GET['limit'] ?? 12)));

if ($scope === 'saved' && $viewerId === '') {
    srp_json(['success' => false, 'error' => 'You must be logged in to view saved Reels.'], 401);
}

try {
    $cursor = srp_reel_decode_cursor($_GET['cursor'] ?? null);
    if ($priorityReelId === '' && $targetUserId !== '' && $cursor === null) {
        $introStmt = $db->prepare("
            SELECT reel_id
            FROM user_intro_reels
            WHERE user_id = :user_id
            LIMIT 1
        ");
        $introStmt->execute([':user_id' => $targetUserId]);
        $priorityReelId = normalizeId($introStmt->fetchColumn() ?: '');
    }
    $params = [];
    $where = [
        "r.status = 'ready'",
        'r.is_hidden = 0',
        'r.deleted_at IS NULL',
    ];
    $where[] = srp_reel_visibility_sql($viewerId, $params);

    if ($targetUserId !== '') {
        $where[] = 'r.creator_user_id = :target_user_id';
        $params[':target_user_id'] = $targetUserId;
    }
    $scopeJoin = '';
    $communityJoin = '';
    $pinExpression = '0';
    $pinSelect = '0 AS scope_pinned';
    if ($communityId !== '') {
        $communityJoin = "
            LEFT JOIN reel_community_pins scope_pin
              ON scope_pin.reel_id = r.reel_id
             AND scope_pin.community_id = :scope_pin_community
        ";
        $params[':scope_pin_community'] = $communityId;
        $where[] = '(r.community_id = :direct_community_id OR scope_pin.reel_id IS NOT NULL)';
        $params[':direct_community_id'] = $communityId;
        $pinExpression = 'CASE WHEN scope_pin.reel_id IS NULL THEN 0 ELSE 1 END';
        $pinSelect = "{$pinExpression} AS scope_pinned";
    }

    $sortSelect = 'r.feed_sort_at AS cursor_time';
    $orderParts = [];
    if ($communityId !== '') {
        $orderParts[] = 'scope_pinned DESC';
    }
    $orderParts[] = 'r.is_featured DESC';
    $orderParts[] = 'r.feed_sort_at DESC';
    $orderParts[] = 'r.reel_id DESC';
    if ($scope === 'saved') {
        $scopeJoin = 'JOIN reel_saves scope_save ON scope_save.reel_id = r.reel_id AND scope_save.user_id = :scope_saved_viewer';
        $params[':scope_saved_viewer'] = $viewerId;
        $sortSelect = 'scope_save.created_at AS cursor_time';
        $orderParts = [];
        if ($communityId !== '') {
            $orderParts[] = 'scope_pinned DESC';
        }
        $orderParts[] = 'scope_save.created_at DESC';
        $orderParts[] = 'r.reel_id DESC';
        if ($cursor !== null) {
            $cursorTime = (string)($cursor['time'] ?? '');
            $cursorId = normalizeId($cursor['id'] ?? '');
            $cursorPinned = $communityId !== '' ? (int)($cursor['pinned'] ?? -1) : 0;
            if (
                $cursorTime === ''
                || $cursorId === ''
                || ($communityId !== '' && !in_array($cursorPinned, [0, 1], true))
            ) {
                throw new InvalidArgumentException('Invalid cursor.');
            }
            if ($communityId !== '') {
                $where[] = "({$pinExpression}, scope_save.created_at, r.reel_id)
                    < (:cursor_pinned, :cursor_time, :cursor_id)";
                $params[':cursor_pinned'] = $cursorPinned;
            } else {
                $where[] = '(scope_save.created_at, r.reel_id) < (:cursor_time, :cursor_id)';
            }
            $params[':cursor_time'] = $cursorTime;
            $params[':cursor_id'] = $cursorId;
        }
    } elseif ($cursor !== null) {
        $cursorFeatured = isset($cursor['featured']) ? (int)(bool)$cursor['featured'] : -1;
        $cursorPinned = $communityId !== '' ? (int)($cursor['pinned'] ?? -1) : 0;
        $cursorTime = (string)($cursor['time'] ?? '');
        $cursorId = normalizeId($cursor['id'] ?? '');
        if (
            !in_array($cursorFeatured, [0, 1], true)
            || ($communityId !== '' && !in_array($cursorPinned, [0, 1], true))
            || $cursorTime === ''
            || $cursorId === ''
        ) {
            throw new InvalidArgumentException('Invalid cursor.');
        }
        if ($communityId !== '') {
            $where[] = "({$pinExpression}, r.is_featured, r.feed_sort_at, r.reel_id)
                < (:cursor_pinned, :cursor_featured, :cursor_time, :cursor_id)";
            $params[':cursor_pinned'] = $cursorPinned;
        } else {
            $where[] = '(r.is_featured, r.feed_sort_at, r.reel_id)
                < (:cursor_featured, :cursor_time, :cursor_id)';
        }
        $params[':cursor_featured'] = $cursorFeatured;
        $params[':cursor_time'] = $cursorTime;
        $params[':cursor_id'] = $cursorId;
    }
    $orderSql = implode(', ', $orderParts);

    $params[':liked_viewer'] = $viewerId !== '' ? $viewerId : '__guest__';
    $params[':saved_viewer'] = $viewerId !== '' ? $viewerId : '__guest__';
    $sql = "
        SELECT
            r.reel_id,
            r.creator_user_id,
            u.first_name,
            u.last_name,
            u.avatar_path,
            r.caption,
            r.video_path,
            r.thumbnail_path,
            r.duration_ms,
            r.width,
            r.height,
            r.file_size,
            r.community_id,
            c.name AS community_name,
            c.community_type,
            r.created_at,
            r.like_count,
            r.comment_count,
            r.save_count,
            EXISTS(
                SELECT 1 FROM reel_likes rl
                WHERE rl.reel_id = r.reel_id AND rl.user_id = :liked_viewer
            ) AS liked,
            EXISTS(
                SELECT 1 FROM reel_saves rs
                WHERE rs.reel_id = r.reel_id AND rs.user_id = :saved_viewer
            ) AS saved,
            r.is_intro,
            r.is_featured,
            r.feed_sort_at,
            {$sortSelect},
            {$pinSelect},
            COALESCE((
                SELECT JSON_ARRAYAGG(rcp.community_id)
                FROM reel_community_pins rcp
                WHERE rcp.reel_id = r.reel_id
            ), JSON_ARRAY()) AS pinned_community_ids
        FROM reels r
        {$scopeJoin}
        {$communityJoin}
        JOIN users u ON u.user_id = r.creator_user_id
        LEFT JOIN account_settings ast ON ast.user_id = u.user_id
        LEFT JOIN communities c ON c.id = r.community_id
        WHERE " . implode("\n AND ", $where) . "
        ORDER BY {$orderSql}
        LIMIT :result_limit
    ";
    $stmt = $db->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':result_limit', $limit + 2, PDO::PARAM_INT);
    $stmt->execute();
    $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $priority = null;
    if ($priorityReelId !== '' && $cursor === null) {
        $candidate = srp_reel_fetch_ready($db, $priorityReelId, $viewerId);
        if ($candidate) {
            $matchesUser = $targetUserId === '' || $candidate['creator_user_id'] === $targetUserId;
            $matchesCommunity = $communityId === ''
                || ($candidate['community_id'] ?? '') === $communityId
                || in_array($communityId, $candidate['pinned_community_ids'] ?? [], true);
            $matchesScope = true;
            if ($scope === 'saved') {
                $savedCheck = $db->prepare("
                    SELECT 1 FROM reel_saves
                    WHERE reel_id = :reel_id AND user_id = :user_id
                    LIMIT 1
                ");
                $savedCheck->execute([':reel_id' => $priorityReelId, ':user_id' => $viewerId]);
                $matchesScope = (bool)$savedCheck->fetchColumn();
            }
            if ($matchesUser && $matchesCommunity && $matchesScope) {
                $priority = $candidate;
            }
        }
    }

    $filteredRows = [];
    foreach ($rawRows as $row) {
        if ($priority && $row['reel_id'] === $priority['reel_id']) {
            continue;
        }
        $filteredRows[] = $row;
    }
    $capacity = $priority ? max(1, $limit - 1) : $limit;
    $hasMore = count($filteredRows) > $capacity;
    $pageRows = array_slice($filteredRows, 0, $capacity);

    $nextCursor = null;
    if ($hasMore && $pageRows) {
        $last = $pageRows[array_key_last($pageRows)];
        $payload = [
            'time' => (string)$last['cursor_time'],
            'id' => (string)$last['reel_id'],
        ];
        if ($scope === 'feed') {
            $payload['featured'] = !empty($last['is_featured']) ? 1 : 0;
        }
        if ($communityId !== '') {
            $payload['pinned'] = !empty($last['scope_pinned']) ? 1 : 0;
        }
        $nextCursor = srp_reel_encode_cursor($payload);
    }

    $reels = [];
    if ($priority) {
        $reels[] = $priority;
    }
    foreach ($pageRows as $row) {
        $reels[] = srp_reel_normalize_row($row);
    }

    srp_json([
        'success' => true,
        'reels' => $reels,
        'next_cursor' => $nextCursor,
    ]);
} catch (InvalidArgumentException $e) {
    srp_json(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    srp_safe_error('Unable to fetch Reels.', $e);
}
