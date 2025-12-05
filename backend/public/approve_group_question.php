<?php
// approve_group_question.php
// Ambassadors mark a group question as approved (visible to all).

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$question_id = isset($input['question_id']) ? normalizeId($input['question_id']) : '';
$user_id     = isset($input['user_id']) ? normalizeId($input['user_id']) : ''; // approver

if ($question_id === '' || $user_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing question_id or user_id']);
    exit;
}

try {
    $db = getDB();

    // Fetch question and group
    $qstmt = $db->prepare("SELECT group_id, status FROM group_questions WHERE question_id = :qid");
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
        echo json_encode(['success' => false, 'error' => 'Not authorized to approve']);
        exit;
    }

    $ustmt = $db->prepare("
        UPDATE group_questions
        SET status = 'approved', approved_by = :uid, approved_at = NOW(), updated_at = NOW()
        WHERE question_id = :qid
    ");
    $ustmt->execute([':uid' => $user_id, ':qid' => $question_id]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
