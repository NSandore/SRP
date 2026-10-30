<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/tour.php';

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'GET is required.']);
    exit;
}

$userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
if ($userId === '') {
    // Signed-out visitors are simply never eligible; this is not an error.
    echo json_encode(['success' => true, 'tour' => ['eligible' => false]]);
    exit;
}

try {
    $db = getDB();
    echo json_encode(['success' => true, 'tour' => srp_tour_payload($db, $userId)]);
} catch (Throwable $error) {
    error_log('[tour] state fetch failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'The tour state is unavailable right now.']);
}
