<?php
// reject_group_question.php
// Ambassadors decline a group/university question with a justification.

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$question_id = isset($input['question_id']) ? normalizeId($input['question_id']) : '';
$user_id     = isset($input['user_id']) ? normalizeId($input['user_id']) : ''; // approver/decliner
$reason      = isset($input['reason']) ? trim($input['reason']) : '';

if ($question_id === '' || $user_id === '' || $reason === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing question_id, user_id, or reason']);
    exit;
}

try {
    $db = getDB();

    // Fetch question and group
    $qstmt = $db->prepare("SELECT group_id, status, user_id FROM group_questions WHERE question_id = :qid");
    $qstmt->execute([':qid' => $question_id]);
    $question = $qstmt->fetch(PDO::FETCH_ASSOC);
    if (!$question) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Question not found']);
        exit;
    }

    // Validate ambassador
    $astmt = $db->prepare("SELECT COUNT(*) FROM ambassadors WHERE user_id = :uid AND community_id = :gid");
    $astmt->execute([':uid' => $user_id, ':gid' => $question['group_id']]);
    if ((int)$astmt->fetchColumn() === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authorized to decline']);
        exit;
    }

    $ustmt = $db->prepare("
        UPDATE group_questions
        SET status = 'rejected', approved_by = :uid, approved_at = NOW(), rejection_reason = :reason, updated_at = NOW()
        WHERE question_id = :qid
    ");
    $ustmt->execute([':uid' => $user_id, ':reason' => $reason, ':qid' => $question_id]);

    // Optionally notify asker
    if (!empty($question['user_id'])) {
        $ustmt = $db->prepare("SELECT name FROM communities WHERE id = :gid");
        $ustmt->execute([':gid' => $question['group_id']]);
        $group = $ustmt->fetch(PDO::FETCH_ASSOC);

        $msg = sprintf(
            "Your question was declined in %s: %s",
            $group ? $group['name'] : 'the community',
            htmlspecialchars($reason, ENT_QUOTES, 'UTF-8')
        );
        $nstmt = $db->prepare("
            INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
            VALUES (:nid, :recipient, :actor, 'announcement', :ref, :msg, NOW())
        ");
        $nstmt->execute([
            ':nid' => generateUniqueId($db, 'notifications'),
            ':recipient' => $question['user_id'],
            ':actor' => $user_id,
            ':ref' => $question_id,
            ':msg' => $msg,
        ]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
