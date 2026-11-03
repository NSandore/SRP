<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/sanitize.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);
$isGlobalAdmin = isAdmin($roleId);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    srp_json(['success' => false, 'error' => 'POST is required.'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    srp_json(['success' => false, 'error' => 'Invalid request body.'], 400);
}

$gapId = normalizeId($data['gap_id'] ?? '');
$status = strtolower(trim((string)($data['status'] ?? '')));
$assignedTo = normalizeId($data['assigned_to'] ?? '');
$adminNotes = srp_sanitize_plain((string)($data['admin_notes'] ?? ''));
$contributorNotes = srp_sanitize_plain((string)($data['contributor_notes'] ?? ''));
$resolutionUrl = trim((string)($data['resolution_url'] ?? ''));
$priorityLevel = strtolower(trim((string)($data['priority_level'] ?? 'needs_triage')));
$affectedAudience = srp_sanitize_plain((string)($data['affected_audience'] ?? ''));
$audienceScope = strtolower(trim((string)($data['audience_scope'] ?? 'unknown')));
$urgencyReason = srp_sanitize_plain((string)($data['urgency_reason'] ?? ''));

$allowedStatuses = $isGlobalAdmin
    ? ['open', 'in_progress', 'ready_for_review', 'resolved']
    : ['open', 'in_progress', 'ready_for_review'];
if ($gapId === '' || !in_array($status, $allowedStatuses, true)) {
    srp_json(['success' => false, 'error' => 'A valid gap and status are required.'], 400);
}
if (!in_array($priorityLevel, ['needs_triage', 'critical', 'high', 'normal', 'low'], true)) {
    srp_json(['success' => false, 'error' => 'Choose a valid priority.'], 400);
}
if (!in_array($audienceScope, ['unknown', 'individual', 'group', 'broad'], true)) {
    srp_json(['success' => false, 'error' => 'Choose a valid audience scope.'], 400);
}
if (mb_strlen($adminNotes) > 1000 || mb_strlen($contributorNotes) > 1000 || mb_strlen($resolutionUrl) > 500
    || mb_strlen($affectedAudience) > 255 || mb_strlen($urgencyReason) > 500) {
    srp_json(['success' => false, 'error' => 'Notes or resolution link are too long.'], 400);
}
if ($resolutionUrl !== '') {
    $isInternalPath = str_starts_with($resolutionUrl, '/') && !str_starts_with($resolutionUrl, '//');
    $scheme = strtolower((string)parse_url($resolutionUrl, PHP_URL_SCHEME));
    $isWebUrl = filter_var($resolutionUrl, FILTER_VALIDATE_URL) !== false && in_array($scheme, ['http', 'https'], true);
    if (!$isInternalPath && !$isWebUrl) {
        srp_json(['success' => false, 'error' => 'Use a valid web address or StudentSphere path.'], 400);
    }
}

try {
    $exists = $db->prepare(
        'SELECT g.gap_id, g.source_type, g.assigned_to, g.status, f.community_id
         FROM knowledge_gaps g
         LEFT JOIN posts p ON p.post_id = g.source_post_id
         LEFT JOIN threads t ON t.thread_id = p.thread_id
         LEFT JOIN forums f ON f.forum_id = t.forum_id
         WHERE g.gap_id = :gap_id'
    );
    $exists->execute([':gap_id' => $gapId]);
    $gap = $exists->fetch(PDO::FETCH_ASSOC);
    if (!$gap) {
        srp_json(['success' => false, 'error' => 'Knowledge gap not found.'], 404);
    }

    if (!$isGlobalAdmin) {
        if (($gap['source_type'] ?? 'feedback') === 'search' || empty($gap['community_id'])) {
            srp_json(['success' => false, 'error' => 'Only global administrators can update unsuccessful-search gaps.'], 403);
        }
        $scope = $db->prepare('SELECT 1 FROM ambassadors WHERE user_id = :user_id AND community_id = :community_id LIMIT 1');
        $scope->execute([':user_id' => $userId, ':community_id' => $gap['community_id']]);
        if (!$scope->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'You do not have permission to update this knowledge gap.'], 403);
        }
        if ($gap['assigned_to'] !== null && $gap['assigned_to'] !== '' && $gap['assigned_to'] !== $userId) {
            srp_json(['success' => false, 'error' => 'This knowledge gap is assigned to another reviewer.'], 409);
        }
        if ($assignedTo !== '' && $assignedTo !== $userId) {
            srp_json(['success' => false, 'error' => 'Ambassadors can claim a gap for themselves only.'], 403);
        }
        if (($gap['assigned_to'] === null || $gap['assigned_to'] === '') && $assignedTo !== $userId) {
            srp_json(['success' => false, 'error' => 'Claim this gap before contributing a resolution.'], 409);
        }
        $assignedTo = $assignedTo === '' ? '' : $userId;
        $adminNotes = '';
    }

    if ($assignedTo !== '') {
        $assignee = $db->prepare(
            'SELECT 1
             FROM users u
             LEFT JOIN ambassadors a ON a.user_id = u.user_id AND a.community_id = :community_id
             WHERE u.user_id = :user_id
               AND (u.role_id >= :role_id OR a.user_id IS NOT NULL)
             LIMIT 1'
        );
        $assignee->execute([
            ':user_id' => $assignedTo,
            ':role_id' => ROLE_ADMIN,
            ':community_id' => $gap['community_id'],
        ]);
        if (!$assignee->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'Choose an authorized assignee.'], 400);
        }
    }

    $db->beginTransaction();
    $stmt = $db->prepare(
        "UPDATE knowledge_gaps
         SET status = :status,
             assigned_to = NULLIF(:assigned_to, ''),
             contributor_notes = NULLIF(:contributor_notes, ''),
             admin_notes = CASE WHEN :can_update_admin_notes = 1 THEN NULLIF(:admin_notes, '') ELSE admin_notes END,
             resolution_url = NULLIF(:resolution_url, ''),
             priority_level = CASE WHEN :can_triage = 1 THEN :priority_level ELSE priority_level END,
             affected_audience = CASE WHEN :can_triage_audience = 1 THEN NULLIF(:affected_audience, '') ELSE affected_audience END,
             audience_scope = CASE WHEN :can_triage_scope = 1 THEN :audience_scope ELSE audience_scope END,
             urgency_reason = CASE WHEN :can_triage_reason = 1 THEN NULLIF(:urgency_reason, '') ELSE urgency_reason END,
             triaged_by = CASE
                WHEN :can_triage_by = 0 THEN triaged_by
                WHEN :priority_for_triage = 'needs_triage' THEN NULL
                ELSE :triaged_by END,
             triaged_at = CASE
                WHEN :can_triage_at = 0 THEN triaged_at
                WHEN :priority_for_time = 'needs_triage' THEN NULL
                ELSE NOW() END,
             updated_by = :updated_by,
             resolved_by = CASE WHEN :resolved_status = 'resolved' THEN :resolver_id ELSE NULL END,
             resolved_at = CASE WHEN :resolved_at_status = 'resolved' THEN COALESCE(resolved_at, NOW()) ELSE NULL END
         WHERE gap_id = :gap_id"
    );
    $stmt->execute([
        ':status' => $status,
        ':assigned_to' => $assignedTo,
        ':contributor_notes' => $contributorNotes,
        ':admin_notes' => $adminNotes,
        ':can_update_admin_notes' => $isGlobalAdmin ? 1 : 0,
        ':resolution_url' => $resolutionUrl,
        ':can_triage' => $isGlobalAdmin ? 1 : 0,
        ':can_triage_audience' => $isGlobalAdmin ? 1 : 0,
        ':can_triage_reason' => $isGlobalAdmin ? 1 : 0,
        ':can_triage_scope' => $isGlobalAdmin ? 1 : 0,
        ':can_triage_by' => $isGlobalAdmin ? 1 : 0,
        ':can_triage_at' => $isGlobalAdmin ? 1 : 0,
        ':priority_level' => $priorityLevel,
        ':priority_for_triage' => $priorityLevel,
        ':priority_for_time' => $priorityLevel,
        ':affected_audience' => $affectedAudience,
        ':audience_scope' => $audienceScope,
        ':urgency_reason' => $urgencyReason,
        ':triaged_by' => $userId,
        ':updated_by' => $userId,
        ':resolved_status' => $status,
        ':resolved_at_status' => $status,
        ':resolver_id' => $userId,
        ':gap_id' => $gapId,
    ]);

    $notify = static function (PDO $database, string $recipientId, string $actorId, string $gapId, string $message): void {
        if ($recipientId === '' || $recipientId === $actorId) return;
        $notificationId = generateUniqueId($database, 'notifications');
        $notification = $database->prepare(
            "INSERT INTO notifications
                (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
             VALUES
                (:notification_id, :recipient_id, :actor_id, 'knowledge_gap', :reference_id, :message)"
        );
        $notification->execute([
            ':notification_id' => $notificationId,
            ':recipient_id' => $recipientId,
            ':actor_id' => $actorId,
            ':reference_id' => $gapId,
            ':message' => $message,
        ]);
    };

    $previousAssignee = normalizeId($gap['assigned_to'] ?? '');
    $previousStatus = (string)($gap['status'] ?? 'open');
    if ($assignedTo !== '' && $assignedTo !== $previousAssignee) {
        $notify(
            $db,
            $assignedTo,
            $userId,
            $gapId,
            'A knowledge gap was <a href="/admin/knowledge-gaps">assigned to you</a>.'
        );
    }

    if ($status === 'ready_for_review' && $previousStatus !== 'ready_for_review') {
        $admins = $db->prepare(
            "SELECT user_id FROM users
             WHERE role_id >= :role_id
               AND user_id <> :actor_id
               AND (deletion_status IS NULL OR deletion_status = 'active')"
        );
        $admins->execute([':role_id' => ROLE_ADMIN, ':actor_id' => $userId]);
        foreach ($admins->fetchAll(PDO::FETCH_COLUMN) as $adminId) {
            $notify(
                $db,
                normalizeId($adminId),
                $userId,
                $gapId,
                'A community knowledge gap is <a href="/admin/knowledge-gaps">ready for review</a>.'
            );
        }
    }

    if ($previousStatus === 'ready_for_review' && $status === 'in_progress' && $assignedTo !== '') {
        $notify(
            $db,
            $assignedTo,
            $userId,
            $gapId,
            'A knowledge gap was <a href="/admin/knowledge-gaps">returned for another update</a>.'
        );
    }

    if ($status === 'resolved' && $previousStatus !== 'resolved' && $assignedTo !== '') {
        $notify(
            $db,
            $assignedTo,
            $userId,
            $gapId,
            'Your contribution to a knowledge gap was <a href="/admin/knowledge-gaps">marked resolved</a>.'
        );
    }

    $db->commit();

    srp_json(['success' => true, 'message' => 'Knowledge gap updated.']);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('[knowledge-gaps] update failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to update this knowledge gap.'], 500);
}
