<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/rate_limit.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    srp_json(['success' => false, 'error' => 'Invalid JSON body.'], 400);
}
$action = strtolower(trim((string)($input['action'] ?? '')));
$reelId = normalizeId($input['reel_id'] ?? '');
$communityId = normalizeId($input['community_id'] ?? '');
$allowedActions = [
    'like', 'unlike', 'save', 'unsave', 'pin', 'unpin',
    'set_intro', 'unset_intro', 'delete', 'feature', 'unfeature',
];
if ($reelId === '' || !in_array($action, $allowedActions, true)) {
    srp_json(['success' => false, 'error' => 'A valid action and reel_id are required.'], 400);
}

try {
    srp_rate_limit_enforce(
        $db,
        'reel-action:' . $userId . ':' . srp_client_ip(),
        300,
        3600,
        'Too many Reel actions. Please wait before trying again.'
    );

    $reelStmt = $db->prepare("
        SELECT reel_id, creator_user_id, community_id, status, is_hidden, deleted_at
        FROM reels
        WHERE reel_id = :reel_id
        LIMIT 1
    ");
    $reelStmt->execute([':reel_id' => $reelId]);
    $reel = $reelStmt->fetch(PDO::FETCH_ASSOC);
    if (!$reel || $reel['deleted_at'] !== null) {
        srp_json(['success' => false, 'error' => 'Reel not found.'], 404);
    }

    $isOwner = normalizeId($reel['creator_user_id']) === $userId;
    if (in_array($action, ['like', 'unlike', 'save', 'unsave'], true)) {
        if (($reel['status'] ?? '') !== 'ready' || !srp_reel_fetch_ready($db, $reelId, $userId)) {
            srp_json(['success' => false, 'error' => 'This Reel is not available.'], 404);
        }
    }

    if ($action === 'like' || $action === 'unlike') {
        $db->beginTransaction();
        if ($action === 'like') {
            $likeId = generateUniqueId($db, 'reel_likes');
            $stmt = $db->prepare("
                INSERT IGNORE INTO reel_likes (reel_like_id, reel_id, user_id)
                VALUES (:id, :reel_id, :user_id)
            ");
            $stmt->execute([':id' => $likeId, ':reel_id' => $reelId, ':user_id' => $userId]);
            if ($stmt->rowCount() === 1) {
                $db->prepare('UPDATE reels SET like_count = like_count + 1 WHERE reel_id = :id')
                    ->execute([':id' => $reelId]);
            }
        } else {
            $stmt = $db->prepare('DELETE FROM reel_likes WHERE reel_id = :reel_id AND user_id = :user_id');
            $stmt->execute([':reel_id' => $reelId, ':user_id' => $userId]);
            if ($stmt->rowCount() === 1) {
                $db->prepare('UPDATE reels SET like_count = GREATEST(like_count - 1, 0) WHERE reel_id = :id')
                    ->execute([':id' => $reelId]);
            }
        }
        $count = $db->prepare('SELECT like_count FROM reels WHERE reel_id = :id');
        $count->execute([':id' => $reelId]);
        $likeCount = (int)$count->fetchColumn();
        $db->commit();
        srp_json([
            'success' => true,
            'liked' => $action === 'like',
            'like_count' => $likeCount,
        ]);
    }

    if ($action === 'save' || $action === 'unsave') {
        $db->beginTransaction();
        if ($action === 'save') {
            $saveId = generateUniqueId($db, 'reel_saves');
            $stmt = $db->prepare("
                INSERT IGNORE INTO reel_saves (reel_save_id, reel_id, user_id)
                VALUES (:id, :reel_id, :user_id)
            ");
            $stmt->execute([':id' => $saveId, ':reel_id' => $reelId, ':user_id' => $userId]);
            if ($stmt->rowCount() === 1) {
                $db->prepare('UPDATE reels SET save_count = save_count + 1 WHERE reel_id = :id')
                    ->execute([':id' => $reelId]);
            }
        } else {
            $stmt = $db->prepare('DELETE FROM reel_saves WHERE reel_id = :reel_id AND user_id = :user_id');
            $stmt->execute([':reel_id' => $reelId, ':user_id' => $userId]);
            if ($stmt->rowCount() === 1) {
                $db->prepare('UPDATE reels SET save_count = GREATEST(save_count - 1, 0) WHERE reel_id = :id')
                    ->execute([':id' => $reelId]);
            }
        }
        $count = $db->prepare('SELECT save_count FROM reels WHERE reel_id = :id');
        $count->execute([':id' => $reelId]);
        $saveCount = (int)$count->fetchColumn();
        $db->commit();
        srp_json([
            'success' => true,
            'saved' => $action === 'save',
            'save_count' => $saveCount,
        ]);
    }

    if ($action === 'pin' || $action === 'unpin') {
        if ($communityId === '') {
            srp_json(['success' => false, 'error' => 'community_id is required for pin actions.'], 400);
        }
        $communityStmt = $db->prepare('SELECT 1 FROM communities WHERE id = :community_id LIMIT 1');
        $communityStmt->execute([':community_id' => $communityId]);
        if (!$communityStmt->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'Community not found.'], 404);
        }
        if (($reel['status'] ?? '') !== 'ready') {
            srp_json(['success' => false, 'error' => 'Only ready Reels can be pinned.'], 409);
        }
        if (!canModerateCommunityContent($userId, $roleId, $communityId, $db)) {
            srp_json(['success' => false, 'error' => 'You cannot curate Reels for this community.'], 403);
        }
        if ($action === 'pin') {
            $pinId = generateUniqueId($db, 'reel_community_pins');
            $stmt = $db->prepare("
                INSERT IGNORE INTO reel_community_pins (reel_pin_id, community_id, reel_id, pinned_by)
                VALUES (:id, :community_id, :reel_id, :pinned_by)
            ");
            $stmt->execute([
                ':id' => $pinId,
                ':community_id' => $communityId,
                ':reel_id' => $reelId,
                ':pinned_by' => $userId,
            ]);
        } else {
            $stmt = $db->prepare("
                DELETE FROM reel_community_pins
                WHERE community_id = :community_id AND reel_id = :reel_id
            ");
            $stmt->execute([':community_id' => $communityId, ':reel_id' => $reelId]);
        }
        $pins = $db->prepare("
            SELECT community_id FROM reel_community_pins
            WHERE reel_id = :reel_id ORDER BY pinned_at DESC
        ");
        $pins->execute([':reel_id' => $reelId]);
        srp_json([
            'success' => true,
            'pinned' => $action === 'pin',
            'pinned_community_ids' => $pins->fetchAll(PDO::FETCH_COLUMN) ?: [],
        ]);
    }

    if ($action === 'set_intro' || $action === 'unset_intro') {
        if (!$isOwner) {
            srp_json(['success' => false, 'error' => 'Only the Reel creator can change their intro video.'], 403);
        }
        if (($reel['status'] ?? '') !== 'ready') {
            srp_json(['success' => false, 'error' => 'Wait for this Reel to finish processing.'], 409);
        }
        $db->beginTransaction();
        if ($action === 'set_intro') {
            $clear = $db->prepare('UPDATE reels SET is_intro = 0 WHERE creator_user_id = :user_id');
            $clear->execute([':user_id' => $userId]);
            $db->prepare('UPDATE reels SET is_intro = 1 WHERE reel_id = :reel_id')
                ->execute([':reel_id' => $reelId]);
            $map = $db->prepare("
                INSERT INTO user_intro_reels (user_id, reel_id)
                VALUES (:user_id, :reel_id)
                ON DUPLICATE KEY UPDATE reel_id = VALUES(reel_id), updated_at = NOW()
            ");
            $map->execute([':user_id' => $userId, ':reel_id' => $reelId]);
        } else {
            $db->prepare('DELETE FROM user_intro_reels WHERE user_id = :user_id AND reel_id = :reel_id')
                ->execute([':user_id' => $userId, ':reel_id' => $reelId]);
            $db->prepare('UPDATE reels SET is_intro = 0 WHERE reel_id = :reel_id')
                ->execute([':reel_id' => $reelId]);
        }
        $db->commit();
        srp_json(['success' => true, 'is_intro' => $action === 'set_intro']);
    }

    if ($action === 'feature' || $action === 'unfeature') {
        if (!isAdmin($roleId)) {
            srp_json(['success' => false, 'error' => 'Only platform admins can feature Reels.'], 403);
        }
        if (($reel['status'] ?? '') !== 'ready') {
            srp_json(['success' => false, 'error' => 'Only ready Reels can be featured.'], 409);
        }
        if ($action === 'feature') {
            $stmt = $db->prepare("
                UPDATE reels
                SET is_featured = 1,
                    featured_at = NOW(),
                    featured_by = :user_id,
                    feed_sort_at = NOW()
                WHERE reel_id = :reel_id
            ");
            $stmt->execute([':user_id' => $userId, ':reel_id' => $reelId]);
        } else {
            $stmt = $db->prepare("
                UPDATE reels
                SET is_featured = 0,
                    featured_at = NULL,
                    featured_by = NULL,
                    feed_sort_at = created_at
                WHERE reel_id = :reel_id
            ");
            $stmt->execute([':reel_id' => $reelId]);
        }
        srp_json(['success' => true, 'is_featured' => $action === 'feature']);
    }

    if ($action === 'delete') {
        $reelCommunityId = normalizeId($reel['community_id'] ?? '');
        $canModerate = $reelCommunityId !== ''
            ? canModerateCommunityContent($userId, $roleId, $reelCommunityId, $db)
            : isModerator($roleId);
        if (!$isOwner && !$canModerate) {
            srp_json(['success' => false, 'error' => 'You cannot delete this Reel.'], 403);
        }
        $db->beginTransaction();
        $uploadStmt = $db->prepare("
            SELECT upload_id
            FROM reel_upload_sessions
            WHERE reel_id = :reel_id
            FOR UPDATE
        ");
        $uploadStmt->execute([':reel_id' => $reelId]);
        $uploadIds = $uploadStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $cancelUploads = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'cancelled',
                error_message = 'The Reel was deleted.',
                completed_at = NOW()
            WHERE reel_id = :reel_id
              AND status IN ('uploading', 'assembling', 'queued', 'processing')
        ");
        $cancelUploads->execute([':reel_id' => $reelId]);
        $db->prepare('DELETE FROM user_intro_reels WHERE reel_id = :reel_id')
            ->execute([':reel_id' => $reelId]);
        $delete = $db->prepare("
            UPDATE reels
            SET deleted_at = NOW(),
                is_hidden = 1,
                is_intro = 0,
                is_featured = 0,
                featured_at = NULL,
                featured_by = NULL,
                video_path = NULL,
                thumbnail_path = NULL,
                file_size = 0
            WHERE reel_id = :reel_id AND deleted_at IS NULL
        ");
        $delete->execute([':reel_id' => $reelId]);
        $db->commit();
        foreach ($uploadIds as $uploadId) {
            srp_reel_cleanup_runtime((string)$uploadId);
        }
        srp_reel_cleanup_public($reelId);
        srp_json(['success' => true, 'deleted' => true]);
    }
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    srp_safe_error('Unable to update the Reel.', $e);
}
