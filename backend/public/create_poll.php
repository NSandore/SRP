<?php
/**
 * Create a poll (global or community-scoped) with its options.
 *
 * Global polls require a super admin. Community polls require an ambassador
 * admin of that community (or a global admin). Replaces the previous
 * localStorage-only poll model.
 */
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/sanitize.php';

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

$question = srp_sanitize_plain($input['question'] ?? ($input['title'] ?? ''), 255);
$description = srp_sanitize_plain($input['description'] ?? '', 2000);
$scope = ($input['scope'] ?? 'community') === 'global' ? 'global' : 'community';
$communityId = $scope === 'community' ? normalizeId($input['community_id'] ?? '') : null;
$allowMultiple = !empty($input['allow_multiple_choices']) ? 1 : 0;
$isAnonymous = !empty($input['is_anonymous']) ? 1 : 0;
$closesAt = trim((string)($input['closes_at'] ?? ''));

$rawOptions = $input['options'] ?? ($input['pollOptions'] ?? []);
if (is_string($rawOptions)) {
    $rawOptions = preg_split('/\r?\n/', $rawOptions);
}
$options = [];
if (is_array($rawOptions)) {
    foreach ($rawOptions as $opt) {
        $text = srp_sanitize_plain(is_array($opt) ? ($opt['text'] ?? '') : $opt, 255);
        if ($text !== '') {
            $options[] = $text;
        }
    }
}
$options = array_values(array_unique($options));

if ($question === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A poll question is required.']);
    exit;
}
if (count($options) < 2) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Polls need at least two answer options.']);
    exit;
}
if ($scope === 'community' && $communityId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A community is required for a community poll.']);
    exit;
}

try {
    $db = getDB();

    // Permission check by scope.
    if ($scope === 'global') {
        if (!isSuperAdmin($roleId)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Only super admins can create global polls.']);
            exit;
        }
    } else {
        if (!canManageForums($userId, $roleId, $communityId, $db)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You do not have permission to create polls in this community.']);
            exit;
        }
    }

    $closesAtValue = null;
    if ($closesAt !== '') {
        $ts = strtotime($closesAt);
        if ($ts !== false) {
            $closesAtValue = date('Y-m-d H:i:s', $ts);
        }
    }

    $db->beginTransaction();

    $pollId = generateUniqueId($db, 'polls');
    $stmt = $db->prepare("
        INSERT INTO polls (poll_id, community_id, created_by, question, description, is_anonymous, allow_multiple_choices, opens_at, closes_at)
        VALUES (:pid, :cid, :uid, :q, :desc, :anon, :multi, NOW(), :closes)
    ");
    $stmt->execute([
        ':pid' => $pollId,
        ':cid' => $communityId ?: null,
        ':uid' => $userId,
        ':q' => $question,
        ':desc' => $description !== '' ? $description : null,
        ':anon' => $isAnonymous,
        ':multi' => $allowMultiple,
        ':closes' => $closesAtValue,
    ]);

    $optStmt = $db->prepare("
        INSERT INTO poll_options (option_id, poll_id, option_text, position)
        VALUES (:oid, :pid, :text, :pos)
    ");
    foreach ($options as $pos => $text) {
        $optStmt->execute([
            ':oid' => generateUniqueId($db, 'poll_options'),
            ':pid' => $pollId,
            ':text' => $text,
            ':pos' => $pos,
        ]);
    }

    $db->commit();

    echo json_encode(['success' => true, 'poll_id' => $pollId]);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('[SRP] create_poll error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to create poll.']);
}
