<?php
// fetch_group_questions.php
// Returns group questions filtered by viewer role (public, asker, or ambassador).

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$group_id = isset($_GET['group_id']) ? normalizeId($_GET['group_id']) : '';
$viewer_id = isset($_GET['viewer_id']) ? normalizeId($_GET['viewer_id']) : '';

if ($group_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing group_id']);
    exit;
}

try {
    $db = getDB();

    // Validate group
    $gstmt = $db->prepare("SELECT id, community_type FROM communities WHERE id = :gid");
    $gstmt->execute([':gid' => $group_id]);
    $group = $gstmt->fetch(PDO::FETCH_ASSOC);
    if (!$group || !in_array($group['community_type'], ['group', 'university'], true)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Group not found']);
        exit;
    }

    // Is viewer ambassador?
    $isAmbassador = false;
    if ($viewer_id) {
        $astmt = $db->prepare("SELECT COUNT(*) FROM ambassadors WHERE user_id = :uid AND community_id = :gid");
        $astmt->execute([':uid' => $viewer_id, ':gid' => $group_id]);
        $isAmbassador = ((int)$astmt->fetchColumn() > 0);
    }

    $params = [':gid' => $group_id];
    $where = "q.group_id = :gid";
    if ($isAmbassador) {
        // ambassadors see all
    } elseif ($viewer_id) {
        // asker can see their own pending, others see approved
        $where .= " AND (q.status = 'approved' OR q.user_id = :viewer)";
        $params[':viewer'] = $viewer_id;
    } else {
        $where .= " AND q.status = 'approved'";
    }

    $qsql = "
        SELECT q.question_id, q.group_id, q.user_id, q.title, q.body, q.status, q.approved_by, q.approved_at, q.created_at, q.updated_at,
               u.first_name AS asker_first_name, u.last_name AS asker_last_name
        FROM group_questions q
        LEFT JOIN users u ON u.user_id = q.user_id
        WHERE $where
        ORDER BY q.created_at DESC
    ";
    $qstmt = $db->prepare($qsql);
    $qstmt->execute($params);
    $questions = $qstmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$questions) {
        echo json_encode(['success' => true, 'questions' => []]);
        exit;
    }

    // Collect question IDs for answers
    $ids = array_column($questions, 'question_id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $ansStmt = $db->prepare("
        SELECT a.answer_id, a.question_id, a.ambassador_id, a.body, a.created_at,
               u.first_name, u.last_name
        FROM group_question_answers a
        LEFT JOIN users u ON u.user_id = a.ambassador_id
        WHERE a.question_id IN ($placeholders)
        ORDER BY a.created_at ASC
    ");
    $ansStmt->execute($ids);
    $answers = $ansStmt->fetchAll(PDO::FETCH_ASSOC);

    $answerMap = [];
    foreach ($answers as $ans) {
        $qid = $ans['question_id'];
        if (!isset($answerMap[$qid])) {
            $answerMap[$qid] = [];
        }
        $answerMap[$qid][] = $ans;
    }

    foreach ($questions as &$q) {
        $qid = $q['question_id'];
        $q['answers'] = $answerMap[$qid] ?? [];
    }

    echo json_encode(['success' => true, 'questions' => $questions]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
