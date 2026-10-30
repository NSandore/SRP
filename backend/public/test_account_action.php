<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../includes/tour.php';
require_once __DIR__ . '/../includes/test_accounts.php';

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
    if (!srp_user_has_test_controls($db, $userId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Test controls are not enabled for this account.']);
        exit;
    }

    if ($action === 'replay_guide') {
        // This legacy test account stopped on the final onboarding step. Mark
        // only its onboarding flow complete so the normal tour eligibility
        // rules can be exercised without granting the account a broader role.
        $extras = srp_get_account_settings_extras($db, $userId);
        $onboarding = srp_get_onboarding_state($db, $userId);
        $onboarding['status'] = 'completed';
        $onboarding['current_step'] = 9;
        $onboarding['completed_at'] = gmdate('c');
        $onboarding['last_updated_at'] = gmdate('c');
        srp_mark_step_complete($onboarding, 7);
        srp_mark_step_complete($onboarding, 9);
        $extras['onboarding'] = $onboarding;
        srp_save_account_settings_extras($db, $userId, $extras);

        $tour = srp_default_tour_state();
        $tour['status'] = 'in_progress';
        $tour['started_at'] = gmdate('c');
        srp_save_tour_state($db, $userId, $tour);

        echo json_encode([
            'success' => true,
            'message' => 'Guide ready.',
            'tour' => srp_tour_payload($db, $userId),
        ]);
        exit;
    }

    if ($action === 'create_notification') {
        $message = 'Test notification received. The notification badge, tray, toast, and sound are ready to review.';

        // Reuse the existing QA row so repeated clicks do not grow the table
        // forever. Match on the private diagnostic copy instead of a string
        // reference_id so this remains compatible with older schemas where
        // that column is numeric. If it was dismissed, create a fresh ID.
        $existing = $db->prepare(
            "SELECT notification_id
             FROM notifications
             WHERE recipient_user_id = :uid
               AND notification_type = 'announcement'
               AND actor_user_id IS NULL
               AND message = :message
             LIMIT 1"
        );
        $existing->execute([
            ':uid' => $userId,
            ':message' => $message,
        ]);
        $notificationId = normalizeId((string)($existing->fetchColumn() ?: ''));
        if ($notificationId === '') {
            $notificationId = generateUniqueId($db, 'notifications');
        }
        $stmt = $db->prepare(
            "INSERT INTO notifications
                (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, is_read, created_at)
             VALUES
                (:id, :uid, NULL, 'announcement', NULL, :message, 0, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE
                message = VALUES(message),
                actor_user_id = NULL,
                reference_id = NULL,
                is_read = 0,
                created_at = UTC_TIMESTAMP()"
        );
        $stmt->execute([
            ':id' => $notificationId,
            ':uid' => $userId,
            ':message' => $message,
        ]);

        $fetch = $db->prepare(
            'SELECT notification_id, notification_type, message, is_read, created_at,
                    actor_user_id, reference_id,
                    NULL AS avatar_path, NULL AS first_name, NULL AS last_name
             FROM notifications
             WHERE notification_id = :id AND recipient_user_id = :uid
             LIMIT 1'
        );
        $fetch->execute([':id' => $notificationId, ':uid' => $userId]);

        echo json_encode([
            'success' => true,
            'message' => 'Test notification created.',
            'notification' => $fetch->fetch(PDO::FETCH_ASSOC),
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown test action.']);
} catch (Throwable $error) {
    error_log('[test-controls] action failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'The test action could not be completed.']);
}
