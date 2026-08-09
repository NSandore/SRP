<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/rate_limit.php';

[$db, $userId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$reelId = normalizeId(is_array($input) ? ($input['reel_id'] ?? '') : '');
$body = srp_reel_comment_body(is_array($input) ? ($input['body'] ?? '') : '');
$parentCommentId = normalizeId(is_array($input) ? ($input['parent_comment_id'] ?? '') : '');
if ($reelId === '' || $body === '') {
    srp_json(['success' => false, 'error' => 'reel_id and a comment body are required.'], 400);
}

try {
    srp_rate_limit_enforce(
        $db,
        'reel-comment:' . $userId . ':' . srp_client_ip(),
        60,
        3600,
        'Too many comments. Please wait before posting again.'
    );
    $reel = srp_reel_fetch_ready($db, $reelId, $userId);
    if (!$reel) {
        srp_json(['success' => false, 'error' => 'Reel not found.'], 404);
    }
    if ($parentCommentId !== '') {
        $parentStmt = $db->prepare("
            SELECT 1
            FROM reel_comments
            WHERE reel_comment_id = :comment_id
              AND reel_id = :reel_id
              AND is_hidden = 0
              AND deleted_at IS NULL
            LIMIT 1
        ");
        $parentStmt->execute([
            ':comment_id' => $parentCommentId,
            ':reel_id' => $reelId,
        ]);
        if (!$parentStmt->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'Parent comment not found.'], 404);
        }
    }

    $db->beginTransaction();
    $commentId = generateUniqueId($db, 'reel_comments');
    $stmt = $db->prepare("
        INSERT INTO reel_comments (
            reel_comment_id, reel_id, user_id, parent_comment_id, body
        ) VALUES (
            :comment_id, :reel_id, :user_id, :parent_comment_id, :body
        )
    ");
    $stmt->execute([
        ':comment_id' => $commentId,
        ':reel_id' => $reelId,
        ':user_id' => $userId,
        ':parent_comment_id' => $parentCommentId !== '' ? $parentCommentId : null,
        ':body' => $body,
    ]);
    $db->prepare('UPDATE reels SET comment_count = comment_count + 1 WHERE reel_id = :reel_id')
        ->execute([':reel_id' => $reelId]);
    $db->commit();

    $commentStmt = $db->prepare("
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
        WHERE rc.reel_comment_id = :comment_id
        LIMIT 1
    ");
    $commentStmt->execute([':comment_id' => $commentId]);
    $comment = $commentStmt->fetch(PDO::FETCH_ASSOC);
    if ($comment) {
        $comment['avatar_path'] = appendAvatarPath($comment['avatar_path'] ?? null);
    }

    srp_json(['success' => true, 'comment' => $comment], 201);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    srp_safe_error('Unable to create the Reel comment.', $e);
}
