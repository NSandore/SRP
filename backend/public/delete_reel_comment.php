<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$commentId = normalizeId(is_array($input)
    ? ($input['reel_comment_id'] ?? ($input['comment_id'] ?? ''))
    : '');
if ($commentId === '') {
    srp_json(['success' => false, 'error' => 'comment_id is required.'], 400);
}

try {
    $stmt = $db->prepare("
        SELECT rc.reel_comment_id, rc.reel_id, rc.user_id, r.community_id
        FROM reel_comments rc
        JOIN reels r ON r.reel_id = rc.reel_id
        WHERE rc.reel_comment_id = :comment_id
          AND rc.deleted_at IS NULL
        LIMIT 1
    ");
    $stmt->execute([':comment_id' => $commentId]);
    $comment = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$comment) {
        srp_json(['success' => false, 'error' => 'Comment not found.'], 404);
    }
    $communityId = normalizeId($comment['community_id'] ?? '');
    $canModerate = $communityId !== ''
        ? canModerateCommunityContent($userId, $roleId, $communityId, $db)
        : isModerator($roleId);
    if (normalizeId($comment['user_id']) !== $userId && !$canModerate) {
        srp_json(['success' => false, 'error' => 'You cannot delete this comment.'], 403);
    }

    $db->beginTransaction();
    $delete = $db->prepare("
        UPDATE reel_comments
        SET deleted_at = NOW(), body = ''
        WHERE reel_comment_id = :comment_id AND deleted_at IS NULL
    ");
    $delete->execute([':comment_id' => $commentId]);
    if ($delete->rowCount() === 1) {
        $db->prepare('UPDATE reels SET comment_count = GREATEST(comment_count - 1, 0) WHERE reel_id = :reel_id')
            ->execute([':reel_id' => $comment['reel_id']]);
    }
    $db->commit();
    srp_json(['success' => true, 'deleted' => true]);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    srp_safe_error('Unable to delete the Reel comment.', $e);
}
