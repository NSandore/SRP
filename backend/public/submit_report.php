<?php
session_start();
require_once __DIR__ . '/../reporting_utils.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'You must be logged in to report content.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$rawType = isset($input['item_type']) ? strtolower(trim($input['item_type'])) : '';
$itemType = $rawType === 'comment' ? 'comment' : $rawType;
$itemId = isset($input['item_id']) ? normalizeId($input['item_id']) : '';
$reasonCode = isset($input['reason_code']) ? strtolower(trim($input['reason_code'])) : '';
$reasonText = isset($input['reason_text']) ? trim($input['reason_text']) : '';
$details = sanitizeDetails($input['details'] ?? '');

$allowedTypes = ['forum', 'thread', 'post', 'comment', 'announcement', 'event', 'user'];
if (!in_array($itemType, $allowedTypes, true) || $itemId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid item type or missing item id.']);
    exit;
}

if ($reasonCode === '' && isset($input['reason'])) {
    $reasonCode = strtolower(trim($input['reason']));
}
if ($reasonText === '') {
    $reasonText = $reasonCode ?: 'Other';
}

$reporterId = normalizeId($_SESSION['user_id']);

try {
    $db = getDB();
    ensureReportsTable($db);

    $context = getReportContext($db, $itemType, $itemId);
    $reportId = generateUniqueId($db, 'reports');

    // Determine severity from reason code
    $highReasons = ['harassment', 'hate', 'self_harm', 'threats'];
    $mediumReasons = ['nsfw'];
    $severity = 'low';
    if (in_array($reasonCode, $highReasons, true)) {
        $severity = 'high';
    } elseif (in_array($reasonCode, $mediumReasons, true)) {
        $severity = 'medium';
    }

    $stmt = $db->prepare("
        INSERT INTO reports (
            report_id, item_type, item_id, forum_id, thread_id, community_id,
            reported_by, reported_user_id, reason, reason_code, reason_text, severity,
            details, item_context, status, created_at
        ) VALUES (
            :rid, :type, :item_id, :forum_id, :thread_id, :community_id,
            :reported_by, :reported_user_id, :reason, :reason_code, :reason_text, :severity,
            :details, :context, 'pending', NOW()
        )
    ");
    $stmt->execute([
        ':rid' => $reportId,
        ':type' => $itemType,
        ':item_id' => $itemId,
        ':forum_id' => $context['forum_id'] ?? null,
        ':thread_id' => $context['thread_id'] ?? null,
        ':community_id' => $context['community_id'] ?? null,
        ':reported_by' => $reporterId,
        ':reported_user_id' => $context['reported_user_id'] ?? null,
        ':reason' => $reasonText ?: ($reasonCode ?: 'Other'),
        ':reason_code' => $reasonCode ?: null,
        ':reason_text' => $reasonText ?: null,
        ':severity' => $severity,
        ':details' => $details,
        ':context' => $context['item_context'] ?? '',
    ]);

    // Auto-hide logic: high/critical or >=3 distinct reporters
    $hide = ($severity === 'high' || $severity === 'critical');
    if (!$hide) {
        $countStmt = $db->prepare("SELECT COUNT(DISTINCT reported_by) FROM reports WHERE item_type = :type AND item_id = :item_id");
        $countStmt->execute([':type' => $itemType, ':item_id' => $itemId]);
        $reporterCount = (int)$countStmt->fetchColumn();
        if ($reporterCount >= 3) {
            $hide = true;
        }
    }
    if ($hide) {
        setItemHidden($db, $itemType, $itemId, true);
    }

    // Build recipient lists
    $ambRecipients = [];
    if (!empty($context['community_id'])) {
        $ambStmt = $db->prepare("SELECT user_id FROM ambassadors WHERE community_id = :cid");
        $ambStmt->execute([':cid' => $context['community_id']]);
        $ambRecipients = $ambStmt->fetchAll(PDO::FETCH_COLUMN);
    }
    $superAdminStmt = $db->query("
        SELECT u.user_id
        FROM users u
        LEFT JOIN roles r ON r.role_id = u.role_id
        WHERE u.role_id = 1 OR r.role_name = 'super_admin'
    ");
    $superAdmins = $superAdminStmt->fetchAll(PDO::FETCH_COLUMN);

    $recipients = $ambRecipients;
    $shouldNotifySuperAdmins = ($severity === 'high' || $severity === 'critical' || $itemType === 'user');
    if (!$shouldNotifySuperAdmins && !empty($context['community_id']) && !empty($context['reported_user_id'])) {
        $ambCheck = $db->prepare("SELECT 1 FROM ambassadors WHERE user_id = :uid AND community_id = :cid");
        $ambCheck->execute([':uid' => $context['reported_user_id'], ':cid' => $context['community_id']]);
        if ($ambCheck->fetchColumn()) {
            $shouldNotifySuperAdmins = true;
        }
    }
    if ($shouldNotifySuperAdmins) {
        $recipients = array_merge($recipients, $superAdmins);
    }

    // Deduplicate + remove reporter
    $recipients = array_values(array_filter(array_unique($recipients), function ($id) use ($reporterId) {
        return $id && $id !== $reporterId;
    }));

    if (!empty($recipients)) {
        $communityName = htmlspecialchars($context['community_name'] ?? 'this community', ENT_QUOTES, 'UTF-8');
        $isComment = $rawType === 'comment';
        $itemLabel = $isComment ? 'comment' : $itemType;
        $message = "A {$itemLabel} was reported in {$communityName}. <a href=\"/reports\">Review in Reported Items</a>";
        sendReportNotifications($db, $recipients, $reporterId, $message);
    }

    echo json_encode([
        'success' => true,
        'report_id' => $reportId,
        'message' => 'Report submitted.'
    ]);
} catch (InvalidArgumentException $e) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
