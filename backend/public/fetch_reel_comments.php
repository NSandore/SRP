<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';

[$db, $viewerId] = srp_bootstrap(requireAuth: false);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$reelId = normalizeId($_GET['reel_id'] ?? '');
$limit = max(1, min(50, (int)($_GET['limit'] ?? 30)));
if ($reelId === '') {
    srp_json(['success' => false, 'error' => 'reel_id is required.'], 400);
}

try {
    if (!srp_reel_fetch_ready($db, $reelId, $viewerId)) {
        srp_json(['success' => false, 'error' => 'Reel not found.'], 404);
    }
    $cursor = srp_reel_decode_cursor($_GET['cursor'] ?? null);
    $params = [':reel_id' => $reelId];
    $cursorSql = '';
    if ($cursor !== null) {
        $time = (string)($cursor['time'] ?? '');
        $id = normalizeId($cursor['id'] ?? '');
        if ($time === '' || $id === '') {
            throw new InvalidArgumentException('Invalid cursor.');
        }
        $cursorSql = 'AND (rc.created_at, rc.reel_comment_id) < (:cursor_time, :cursor_id)';
        $params[':cursor_time'] = $time;
        $params[':cursor_id'] = $id;
    }
    $stmt = $db->prepare("
        SELECT
            rc.reel_comment_id,
            rc.reel_comment_id AS comment_id,
            rc.reel_id,
            rc.user_id,
            rc.parent_comment_id,
            rc.body,
            rc.created_at,
            rc.updated_at,
            u.first_name,
            u.last_name,
            u.avatar_path
        FROM reel_comments rc
        JOIN users u ON u.user_id = rc.user_id
        WHERE rc.reel_id = :reel_id
          AND rc.is_hidden = 0
          AND rc.deleted_at IS NULL
          {$cursorSql}
        ORDER BY rc.created_at DESC, rc.reel_comment_id DESC
        LIMIT :lim
    ");
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':lim', $limit + 1, PDO::PARAM_INT);
    $stmt->execute();
    $comments = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $hasMore = count($comments) > $limit;
    $comments = array_slice($comments, 0, $limit);
    foreach ($comments as &$comment) {
        $comment['avatar_path'] = appendAvatarPath($comment['avatar_path'] ?? null);
    }
    unset($comment);
    $nextCursor = null;
    if ($hasMore && $comments) {
        $last = $comments[array_key_last($comments)];
        $nextCursor = srp_reel_encode_cursor([
            'time' => $last['created_at'],
            'id' => $last['reel_comment_id'],
        ]);
    }
    srp_json([
        'success' => true,
        'comments' => $comments,
        'next_cursor' => $nextCursor,
    ]);
} catch (InvalidArgumentException $e) {
    srp_json(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    srp_safe_error('Unable to fetch Reel comments.', $e);
}
