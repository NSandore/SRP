<?php
/**
 * Record a vote on a poll option. Enforces one option per user for
 * single-choice polls, and blocks voting on closed polls. Replaces the
 * previous localStorage tally.
 */
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Log in or sign up to vote in polls.']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$pollId = normalizeId($input['poll_id'] ?? '');
$optionId = normalizeId($input['option_id'] ?? '');

if ($pollId === '' || $optionId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'poll_id and option_id are required.']);
    exit;
}

try {
    $db = getDB();

    // Load poll + confirm the option belongs to it.
    $pollStmt = $db->prepare("SELECT allow_multiple_choices, closes_at FROM polls WHERE poll_id = :pid LIMIT 1");
    $pollStmt->execute([':pid' => $pollId]);
    $poll = $pollStmt->fetch(PDO::FETCH_ASSOC);
    if (!$poll) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Poll not found.']);
        exit;
    }

    if (!empty($poll['closes_at']) && strtotime($poll['closes_at']) < time()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'This poll is closed.']);
        exit;
    }

    $optStmt = $db->prepare("SELECT option_id FROM poll_options WHERE option_id = :oid AND poll_id = :pid LIMIT 1");
    $optStmt->execute([':oid' => $optionId, ':pid' => $pollId]);
    if (!$optStmt->fetchColumn()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid option for this poll.']);
        exit;
    }

    $allowMultiple = (int)$poll['allow_multiple_choices'] === 1;

    // Existing votes by this user in this poll.
    $existingStmt = $db->prepare("SELECT COUNT(*) FROM poll_votes WHERE poll_id = :pid AND user_id = :uid");
    $existingStmt->execute([':pid' => $pollId, ':uid' => $userId]);
    $existingCount = (int)$existingStmt->fetchColumn();

    if (!$allowMultiple && $existingCount > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'You have already voted in this poll.']);
        exit;
    }

    try {
        $insert = $db->prepare("
            INSERT INTO poll_votes (vote_id, poll_id, option_id, user_id)
            VALUES (:vid, :pid, :oid, :uid)
        ");
        $insert->execute([
            ':vid' => generateUniqueId($db, 'poll_votes'),
            ':pid' => $pollId,
            ':oid' => $optionId,
            ':uid' => $userId,
        ]);
    } catch (PDOException $dup) {
        // Unique (poll_id,user_id,option_id) — duplicate of the same option.
        if ($dup->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'You already selected that option.']);
            exit;
        }
        throw $dup;
    }

    // Return refreshed tallies.
    $tallyStmt = $db->prepare("
        SELECT o.option_id, o.option_text,
               (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.option_id) AS votes
        FROM poll_options o
        WHERE o.poll_id = :pid
        ORDER BY o.position ASC
    ");
    $tallyStmt->execute([':pid' => $pollId]);
    $options = [];
    $total = 0;
    foreach ($tallyStmt->fetchAll(PDO::FETCH_ASSOC) as $o) {
        $votes = (int)$o['votes'];
        $total += $votes;
        $options[] = ['option_id' => $o['option_id'], 'text' => $o['option_text'], 'votes' => $votes];
    }

    echo json_encode(['success' => true, 'options' => $options, 'total_votes' => $total]);
} catch (PDOException $e) {
    error_log('[SRP] vote_poll error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to record your vote.']);
}
