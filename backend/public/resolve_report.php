<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../reporting_utils.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/reels.php';

header('Content-Type: application/json');

function deletePostTree(PDO $db, string $postId): void
{
    $childStmt = $db->prepare("SELECT post_id FROM posts WHERE reply_to = :pid");
    $childStmt->execute([':pid' => $postId]);
    $children = $childStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($children as $childId) {
        deletePostTree($db, $childId);
    }

    $del = $db->prepare("DELETE FROM posts WHERE post_id = :pid");
    $del->execute([':pid' => $postId]);
}

function deleteThreadCascade(PDO $db, string $threadId): void
{
    // Remove posts first to satisfy FK constraints, then the thread
    $delPosts = $db->prepare("DELETE FROM posts WHERE thread_id = :tid");
    $delPosts->execute([':tid' => $threadId]);

    $delThread = $db->prepare("DELETE FROM threads WHERE thread_id = :tid");
    $delThread->execute([':tid' => $threadId]);
}

function deleteForumCascade(PDO $db, string $forumId): void
{
    $threadStmt = $db->prepare("SELECT thread_id FROM threads WHERE forum_id = :fid");
    $threadStmt->execute([':fid' => $forumId]);
    $threadIds = $threadStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($threadIds as $tid) {
        deleteThreadCascade($db, $tid);
    }

    $delForum = $db->prepare("DELETE FROM forums WHERE forum_id = :fid");
    $delForum->execute([':fid' => $forumId]);
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$reportId = isset($input['report_id']) ? normalizeId($input['report_id']) : '';
$action = isset($input['action']) ? strtolower(trim($input['action'])) : '';
$notes = sanitizeDetails($input['notes'] ?? '', 1000);

$allowedActions = ['retain', 'remove', 'dismiss', 'under_review', 'hide', 'restore'];
if ($reportId === '' || !in_array($action, $allowedActions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid report request.']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$roleId = isset($_SESSION['role_id']) ? (int) $_SESSION['role_id'] : 0;
$isSuperAdmin = false;

try {
    $db = getDB();
    ensureReportsTable($db);

    // Determine if super admin
    $isSuperAdmin = isSuperAdmin($roleId);

    $stmt = $db->prepare("SELECT * FROM reports WHERE report_id = :rid");
    $stmt->execute([':rid' => $reportId]);
    $report = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$report) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Report not found.']);
        exit;
    }

    // Permission: super admins or community moderators/admins for this community.
    if (!$isSuperAdmin && !canModerateCommunityContent($userId, $roleId, normalizeId($report['community_id'] ?? ''), $db)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not allowed to resolve this report.']);
        exit;
    }

    $notifyReporter = function(string $status) use ($db, $report, $userId) {
        if (empty($report['reported_by'])) {
            return;
        }
        $message = "Your report was marked as {$status}.";
        sendReportNotifications($db, [$report['reported_by']], $userId, $message);
    };

    $notifyReportee = function(string $message) use ($db, $report, $userId) {
        if (empty($report['reported_user_id'])) {
            return;
        }
        sendReportNotifications($db, [$report['reported_user_id']], $userId, $message);
    };

    if ($action === 'under_review') {
        $update = $db->prepare("
            UPDATE reports
            SET status = 'under_review',
                resolved_by = :uid,
                resolved_at = NOW(),
                resolution_notes = :notes
            WHERE report_id = :rid
        ");
        $update->execute([':uid' => $userId, ':notes' => $notes, ':rid' => $reportId]);
        echo json_encode(['success' => true, 'status' => 'under_review']);
        exit;
    }

    if ($action === 'hide') {
        setItemHidden($db, $report['item_type'], $report['item_id'], true);
        $update = $db->prepare("
            UPDATE reports
            SET status = 'under_review',
                resolved_by = :uid,
                resolved_at = NOW(),
                resolution_notes = :notes
            WHERE report_id = :rid
        ");
        $update->execute([':uid' => $userId, ':notes' => $notes, ':rid' => $reportId]);
        echo json_encode(['success' => true, 'status' => 'under_review']);
        exit;
    }

    if ($action === 'restore') {
        setItemHidden($db, $report['item_type'], $report['item_id'], false);
        $update = $db->prepare("
            UPDATE reports
            SET status = 'pending',
                resolution_notes = :notes
            WHERE report_id = :rid
        ");
        $update->execute([':notes' => $notes, ':rid' => $reportId]);
        echo json_encode(['success' => true, 'status' => 'pending']);
        exit;
    }

    if ($action === 'retain') {
        setItemHidden($db, $report['item_type'], $report['item_id'], false);
        $update = $db->prepare("
            UPDATE reports
            SET status = 'retained',
                resolved_by = :uid,
                resolved_at = NOW(),
                resolution_notes = :notes
            WHERE report_id = :rid
        ");
        $update->execute([
            ':uid' => $userId,
            ':notes' => $notes,
            ':rid' => $reportId,
        ]);
        $notifyReporter('resolved');
        $notifyReportee('Your content was edited/retained after moderation review. Please ensure it follows our guidelines.');
        echo json_encode(['success' => true, 'status' => 'retained']);
        exit;
    }

    if ($action === 'dismiss') {
        setItemHidden($db, $report['item_type'], $report['item_id'], false);
        $update = $db->prepare("
            UPDATE reports
            SET status = 'dismissed',
                resolved_by = :uid,
                resolved_at = NOW(),
                resolution_notes = :notes
            WHERE report_id = :rid
        ");
        $update->execute([':uid' => $userId, ':notes' => $notes, ':rid' => $reportId]);
        $notifyReporter('dismissed');
        echo json_encode(['success' => true, 'status' => 'dismissed']);
        exit;
    }

    // Removal flow
    $db->beginTransaction();

    $removedReelId = null;
    switch ($report['item_type']) {
        case 'post':
        case 'comment':
            deletePostTree($db, $report['item_id']);
            break;
        case 'thread':
            deleteThreadCascade($db, $report['item_id']);
            break;
        case 'forum':
            deleteForumCascade($db, $report['item_id']);
            break;
        case 'announcement':
            setItemHidden($db, 'announcement', $report['item_id'], true);
            break;
        case 'event':
            setItemHidden($db, 'event', $report['item_id'], true);
            break;
        case 'reel':
            $removeReel = $db->prepare("
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
                WHERE reel_id = :reel_id
            ");
            $removeReel->execute([':reel_id' => $report['item_id']]);
            $db->prepare('DELETE FROM user_intro_reels WHERE reel_id = :reel_id')
                ->execute([':reel_id' => $report['item_id']]);
            $db->prepare("
                UPDATE reel_upload_sessions
                SET status = 'cancelled',
                    error_message = 'The Reel was removed by moderation.',
                    completed_at = NOW()
                WHERE reel_id = :reel_id
                  AND status IN ('uploading', 'assembling', 'queued', 'processing')
            ")->execute([':reel_id' => $report['item_id']]);
            $removedReelId = $report['item_id'];
            break;
        case 'reel_comment':
            $commentReelStmt = $db->prepare("
                SELECT reel_id
                FROM reel_comments
                WHERE reel_comment_id = :comment_id
                LIMIT 1
            ");
            $commentReelStmt->execute([':comment_id' => $report['item_id']]);
            $commentReelId = $commentReelStmt->fetchColumn();
            $removeComment = $db->prepare("
                UPDATE reel_comments
                SET deleted_at = NOW(), is_hidden = 1, body = ''
                WHERE reel_comment_id = :comment_id
                  AND deleted_at IS NULL
            ");
            $removeComment->execute([':comment_id' => $report['item_id']]);
            if ($commentReelId && $removeComment->rowCount() === 1) {
                $db->prepare("
                    UPDATE reels
                    SET comment_count = GREATEST(comment_count - 1, 0)
                    WHERE reel_id = :reel_id
                ")->execute([':reel_id' => $commentReelId]);
            }
            break;
        case 'user':
            // No destructive action for user profiles yet
            break;
        default:
            throw new InvalidArgumentException('Unsupported item type for removal.');
    }

    $update = $db->prepare("
        UPDATE reports
        SET status = 'removed',
            resolved_by = :uid,
            resolved_at = NOW(),
            resolution_notes = :notes
        WHERE report_id = :rid
    ");
    $update->execute([
        ':uid' => $userId,
        ':notes' => $notes,
        ':rid' => $reportId,
    ]);

    $db->commit();
    if ($removedReelId !== null) {
        srp_reel_cleanup_public($removedReelId);
        $runtimeStmt = $db->prepare("
            SELECT upload_id FROM reel_upload_sessions WHERE reel_id = :reel_id
        ");
        $runtimeStmt->execute([':reel_id' => $removedReelId]);
        foreach ($runtimeStmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $uploadId) {
            srp_reel_cleanup_runtime((string)$uploadId);
        }
    }
    $notifyReporter('resolved');
    $notifyReportee('Your content was removed for violating our community guidelines.');
    echo json_encode(['success' => true, 'status' => 'removed']);
} catch (InvalidArgumentException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
