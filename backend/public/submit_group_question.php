<?php
// submit_group_question.php
// Allows a user to submit a question to a group. Creates a pending question and notifies group ambassadors.

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$group_id = isset($input['group_id']) ? normalizeId($input['group_id']) : '';
$user_id  = isset($input['user_id']) ? normalizeId($input['user_id']) : '';
$title    = isset($input['title']) ? trim($input['title']) : '';
$body     = isset($input['body']) ? trim($input['body']) : '';

if ($group_id === '' || $user_id === '' || $title === '' || $body === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing group_id, user_id, title, or body']);
    exit;
}

try {
    $db = getDB();

    // Validate group exists and is a group
    $gstmt = $db->prepare("SELECT id, name, community_type FROM communities WHERE id = :gid");
    $gstmt->execute([':gid' => $group_id]);
    $group = $gstmt->fetch(PDO::FETCH_ASSOC);
    if (!$group || !in_array($group['community_type'], ['group', 'university'], true)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Group not found']);
        exit;
    }

    // Fetch asker name for message
    $ustmt = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = :uid");
    $ustmt->execute([':uid' => $user_id]);
    $asker = $ustmt->fetch(PDO::FETCH_ASSOC);
    $askerName = $asker ? ($asker['first_name'] . ' ' . $asker['last_name']) : 'Someone';

    // Insert question
    $question_id = generateUniqueId($db, 'group_questions');
    $qstmt = $db->prepare("
        INSERT INTO group_questions (question_id, group_id, user_id, title, body, status, created_at, updated_at)
        VALUES (:qid, :gid, :uid, :title, :body, 'pending', NOW(), NOW())
    ");
    $qstmt->execute([
        ':qid' => $question_id,
        ':gid' => $group_id,
        ':uid' => $user_id,
        ':title' => $title,
        ':body' => $body,
    ]);

    // Notify ambassadors of the group
    $ambStmt = $db->prepare("SELECT user_id FROM ambassadors WHERE community_id = :gid");
    $ambStmt->execute([':gid' => $group_id]);
    $ambassadors = $ambStmt->fetchAll(PDO::FETCH_COLUMN);

    if ($ambassadors) {
        $nstmt = $db->prepare("
            INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message, created_at)
            VALUES (:nid, :recipient, :actor, 'announcement', :ref, :msg, NOW())
        ");
        $path = ($group['community_type'] === 'university') ? "/university/{$group_id}" : "/group/{$group_id}";
        $msg = sprintf(
            "%s submitted a question to %s: <a href=\"%s#qa\">%s</a>",
            $askerName,
            $group['name'],
            $path,
            htmlspecialchars($title, ENT_QUOTES, 'UTF-8')
        );
        foreach ($ambassadors as $ambId) {
            $notificationId = generateUniqueId($db, 'notifications');
            $nstmt->execute([
                ':nid' => $notificationId,
                ':recipient' => $ambId,
                ':actor' => $user_id,
                ':ref' => $question_id,
                ':msg' => $msg,
            ]);
        }
    }

    echo json_encode(['success' => true, 'question_id' => $question_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
