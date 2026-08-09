<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/institution_data/AdminReview.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    srp_json(['success' => false, 'error' => 'GET is required.'], 405);
}

[$db, $userId] = srp_bootstrap(true);
if (!SrpInstitutionAdminReview::isFreshSuperAdmin($db, $userId)) {
    srp_json(
        ['success' => false, 'error' => 'Only super admins can review institution data.'],
        403
    );
}

try {
    $review = new SrpInstitutionAdminReview($db);
    $result = $review->list([
        'status' => $_GET['status'] ?? 'needs_review',
        'q' => $_GET['q'] ?? '',
        'page' => $_GET['page'] ?? 1,
        'limit' => $_GET['limit'] ?? 30,
    ]);
    srp_json([
        'success' => true,
        'reviews' => $result['reviews'],
        'pagination' => $result['pagination'],
    ]);
} catch (InvalidArgumentException $error) {
    srp_json(['success' => false, 'error' => $error->getMessage()], 400);
} catch (RuntimeException $error) {
    error_log('[institution-review] ' . $error->getMessage());
    srp_json(
        ['success' => false, 'error' => 'Institution review is unavailable until its database migration is applied.'],
        503
    );
} catch (Throwable $error) {
    error_log('[institution-review] fetch failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to load institution reviews.'], 500);
}
