<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/sanitize.php';

[$db, $userId] = srp_bootstrap(requireAuth: true);
srp_require_role(ROLE_ADMIN);

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
$resolutionUrl = trim((string)($data['resolution_url'] ?? ''));

if ($gapId === '' || !in_array($status, ['open', 'in_progress', 'resolved'], true)) {
    srp_json(['success' => false, 'error' => 'A valid gap and status are required.'], 400);
}
if (mb_strlen($adminNotes) > 1000 || mb_strlen($resolutionUrl) > 500) {
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
    $exists = $db->prepare('SELECT 1 FROM knowledge_gaps WHERE gap_id = :gap_id');
    $exists->execute([':gap_id' => $gapId]);
    if (!$exists->fetchColumn()) {
        srp_json(['success' => false, 'error' => 'Knowledge gap not found.'], 404);
    }

    if ($assignedTo !== '') {
        $assignee = $db->prepare('SELECT 1 FROM users WHERE user_id = :user_id AND role_id >= :role_id LIMIT 1');
        $assignee->execute([':user_id' => $assignedTo, ':role_id' => ROLE_ADMIN]);
        if (!$assignee->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'Choose an authorized assignee.'], 400);
        }
    }

    $stmt = $db->prepare(
        "UPDATE knowledge_gaps
         SET status = :status,
             assigned_to = NULLIF(:assigned_to, ''),
             admin_notes = NULLIF(:admin_notes, ''),
             resolution_url = NULLIF(:resolution_url, ''),
             updated_by = :updated_by,
             resolved_by = CASE WHEN :resolved_status = 'resolved' THEN :resolver_id ELSE NULL END,
             resolved_at = CASE WHEN :resolved_at_status = 'resolved' THEN COALESCE(resolved_at, NOW()) ELSE NULL END
         WHERE gap_id = :gap_id"
    );
    $stmt->execute([
        ':status' => $status,
        ':assigned_to' => $assignedTo,
        ':admin_notes' => $adminNotes,
        ':resolution_url' => $resolutionUrl,
        ':updated_by' => $userId,
        ':resolved_status' => $status,
        ':resolved_at_status' => $status,
        ':resolver_id' => $userId,
        ':gap_id' => $gapId,
    ]);

    srp_json(['success' => true, 'message' => 'Knowledge gap updated.']);
} catch (Throwable $error) {
    error_log('[knowledge-gaps] update failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to update this knowledge gap.'], 500);
}
