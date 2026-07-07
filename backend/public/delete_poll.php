<?php
/**
 * Delete a poll (and its options/votes). Allowed for the poll creator or a
 * super admin.
 */
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be logged in.']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$roleId = (int)($_SESSION['role_id'] ?? 0);
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$pollId = normalizeId($input['poll_id'] ?? '');

if ($pollId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'poll_id is required.']);
    exit;
}

try {
    $db = getDB();

    $stmt = $db->prepare("SELECT created_by FROM polls WHERE poll_id = :pid LIMIT 1");
    $stmt->execute([':pid' => $pollId]);
    $poll = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$poll) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Poll not found.']);
        exit;
    }

    if ((string)$poll['created_by'] !== $userId && !isSuperAdmin($roleId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You cannot delete this poll.']);
        exit;
    }

    $db->beginTransaction();
    $db->prepare("DELETE FROM poll_votes WHERE poll_id = :pid")->execute([':pid' => $pollId]);
    $db->prepare("DELETE FROM poll_options WHERE poll_id = :pid")->execute([':pid' => $pollId]);
    $db->prepare("DELETE FROM polls WHERE poll_id = :pid")->execute([':pid' => $pollId]);
    $db->commit();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('[SRP] delete_poll error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to delete poll.']);
}
