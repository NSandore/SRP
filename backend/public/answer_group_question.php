<?php
// answer_group_question.php
// Ambassadors post an answer to a group question and notify ambassadors + asker.

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$question_id   = isset($input['question_id']) ? normalizeId($input['question_id']) : '';
$ambassador_id = isset($input['ambassador_id']) ? normalizeId($input['ambassador_id']) : '';
$body          = isset($input['body']) ? trim($input['body']) : '';

if ($question_id === '' || $ambassador_id === '' || $body === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing question_id, ambassador_id, or body']);
    exit;
}

try {
    $db = getDB();

    // Fetch question info
    $qstmt = $db->prepare("SELECT group_id, user_id, title FROM group_questions WHERE question_id = :qid");
    $qstmt->execute([':qid' => $question_id]);
    $question = $qstmt->fetch(PDO::FETCH_ASSOC);
    if (!$question) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Question not found']);
        exit;
    }

    // Validate ambassador
    $astmt = $db->prepare("SELECT COUNT(*) FROM ambassadors WHERE user_id = :uid AND community_id = :gid");
    $astmt->execute([':uid' => $ambassador_id, ':gid' => $question['group_id']]);
    if ((int)$astmt->fetchColumn() === 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authorized to answer']);
        exit;
    }

    // Fetch answerer name for notification
    $ustmt = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = :uid");
    $ustmt->execute([':uid' => $ambassador_id]);
    $answerer = $ustmt->fetch(PDO::FETCH_ASSOC);
    $answererName = $answerer ? ($answerer['first_name'] . ' ' . $answerer['last_name']) : 'Someone';

    // Insert answer
    $answer_id = generateUniqueId($db, 'group_question_answers');
    $stmt = $db->prepare("
        INSERT INTO group_question_answers (answer_id, question_id, ambassador_id, body, created_at)
        VALUES (:aid_id, :qid, :aid, :body, NOW())
    ");
    $stmt->execute([
        ':aid_id' => $answer_id,
        ':qid' => $question_id,
        ':aid' => $ambassador_id,
        ':body' => $body,
    ]);

    // Fetch group name and type
    $gstmt = $db->prepare("SELECT name, community_type FROM communities WHERE id = :gid");
    $gstmt->execute([':gid' => $question['group_id']]);
    $group = $gstmt->fetch(PDO::FETCH_ASSOC);
    $groupName = $group ? $group['name'] : 'Group';
    $path = ($group && $group['community_type'] === 'university') ? "/university/{$question['group_id']}" : "/group/{$question['group_id']}";

    // Notify ambassadors + asker
    $ambStmt = $db->prepare("SELECT user_id FROM ambassadors WHERE community_id = :gid");
    $ambStmt->execute([':gid' => $question['group_id']]);
    $ambassadors = $ambStmt->fetchAll(PDO::FETCH_COLUMN);

    $notifMsg = sprintf(
        "%s answered your question: <a href=\"%s#qa\">%s</a>",
        $answererName,
        $path,
        htmlspecialchars($question['title'], ENT_QUOTES, 'UTF-8')
    );
    $nstmt = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
        VALUES (:nid, :recipient, :actor, 'announcement', :ref, :msg, NOW())
    ");

    if ($ambassadors) {
        foreach ($ambassadors as $ambId) {
            $notificationId = generateUniqueId($db, 'notifications');
            $nstmt->execute([
                ':nid' => $notificationId,
                ':recipient' => $ambId,
                ':actor' => $ambassador_id,
                ':ref' => $question_id,
                ':msg' => $notifMsg,
            ]);
        }
    }

    // Notify asker
    if (!empty($question['user_id'])) {
        $notificationId = generateUniqueId($db, 'notifications');
        $nstmt->execute([
            ':nid' => $notificationId,
            ':recipient' => $question['user_id'],
            ':actor' => $ambassador_id,
            ':ref' => $question_id,
            ':msg' => $notifMsg,
        ]);
    }

    echo json_encode(['success' => true, 'answer_id' => $answer_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
