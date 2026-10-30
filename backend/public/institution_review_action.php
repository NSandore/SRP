<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/institution_data/AdminReview.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    srp_json(['success' => false, 'error' => 'POST is required.'], 405);
}

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 65_536) {
    srp_json(['success' => false, 'error' => 'Review payload is too large.'], 413);
}

[$db, $userId] = srp_bootstrap(true);
if (!SrpInstitutionAdminReview::isFreshSuperAdmin($db, $userId)) {
    srp_json(
        ['success' => false, 'error' => 'Only super admins can change institution data.'],
        403
    );
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody !== false ? $rawBody : '', true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$communityId = normalizeId($payload['community_id'] ?? '');
$action = strtolower(trim((string)($payload['action'] ?? '')));
if ($communityId === '' || $action === '') {
    srp_json(
        ['success' => false, 'error' => 'Institution and review action are required.'],
        400
    );
}

try {
    $reviewService = new SrpInstitutionAdminReview($db);
    $updatedReview = $reviewService->act($communityId, $action, $payload, $userId);

    // Existing audit infrastructure is best-effort and never changes the
    // outcome of the already committed row-level review decision.
    try {
        $auditStatement = $db->prepare(
            'INSERT INTO audit_logs (id, user_id, action, timestamp)
             VALUES (:id, :user_id, :action, NOW())'
        );
        $auditStatement->execute([
            ':id' => 'a' . bin2hex(random_bytes(15)),
            ':user_id' => $userId,
            ':action' => sprintf('institution_review:%s:%s', $action, $communityId),
        ]);
    } catch (Throwable $auditError) {
        error_log('[institution-review] audit failed: ' . $auditError->getMessage());
    }

    srp_json([
        'success' => true,
        'review' => $updatedReview,
        'message' => 'Institution review updated.',
    ]);
} catch (OutOfBoundsException $error) {
    srp_json(['success' => false, 'error' => $error->getMessage()], 404);
} catch (InvalidArgumentException | LengthException $error) {
    srp_json(['success' => false, 'error' => $error->getMessage()], 400);
} catch (PDOException $error) {
    error_log('[institution-review] database action failed: ' . $error->getMessage());
    if ((string)$error->getCode() === '23000') {
        srp_json(
            ['success' => false, 'error' => 'That value conflicts with another institution record.'],
            409
        );
    }
    srp_json(['success' => false, 'error' => 'Unable to update institution review.'], 500);
} catch (RuntimeException $error) {
    error_log('[institution-review] action unavailable: ' . $error->getMessage());
    srp_json(
        ['success' => false, 'error' => 'Institution review is currently unavailable.'],
        503
    );
} catch (Throwable $error) {
    error_log('[institution-review] action failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to update institution review.'], 500);
}
