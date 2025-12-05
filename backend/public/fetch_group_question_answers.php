<?php
// fetch_group_question_answers.php
// Returns answers for a given question.

require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$question_id = isset($_GET['question_id']) ? normalizeId($_GET['question_id']) : '';

if ($question_id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing question_id']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT a.answer_id, a.question_id, a.ambassador_id, a.body, a.created_at,
               u.first_name, u.last_name
        FROM group_question_answers a
        LEFT JOIN users u ON u.user_id = a.ambassador_id
        WHERE a.question_id = :qid
        ORDER BY a.created_at ASC
    ");
    $stmt->execute([':qid' => $question_id]);
    $answers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'answers' => $answers]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
