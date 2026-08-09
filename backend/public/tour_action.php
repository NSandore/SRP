<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/tour.php';

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'POST is required.']);
    exit;
}

$userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
if ($userId === '') {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be signed in.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = $_POST;
}
$action = strtolower(trim((string)($data['action'] ?? '')));

try {
    $db = getDB();
    $state = srp_get_tour_state($db, $userId);

    switch ($action) {
        case 'start':
            $state['status'] = 'in_progress';
            $state['current_step'] = 0;
            $state['started_at'] = gmdate('c');
            break;

        case 'advance':
            // Progress is stored so a refresh mid-tour resumes rather than
            // restarting, and never moves backwards on a stale request.
            $step = max(0, (int)($data['current_step'] ?? 0));
            $state['status'] = 'in_progress';
            $state['current_step'] = max((int)$state['current_step'], $step);
            break;

        case 'complete':
            $state['status'] = 'completed';
            $state['version'] = SRP_TOUR_VERSION;
            $state['completed_at'] = gmdate('c');
            break;

        case 'skip':
            $state['status'] = 'skipped';
            $state['version'] = SRP_TOUR_VERSION;
            $state['completed_at'] = gmdate('c');
            break;

        case 'restart':
            // Powers a "replay the tour" control in settings.
            $state = srp_default_tour_state();
            $state['status'] = 'in_progress';
            $state['started_at'] = gmdate('c');
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Unknown tour action.']);
            exit;
    }

    srp_save_tour_state($db, $userId, $state);
    echo json_encode(['success' => true, 'tour' => srp_tour_payload($db, $userId)]);
} catch (Throwable $error) {
    error_log('[tour] action failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'The tour action could not be completed.']);
}
