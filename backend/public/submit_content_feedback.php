<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['error' => 'Log in to share feedback.']); exit; }
$data = json_decode(file_get_contents('php://input'), true) ?: [];
$postId = normalizeId($data['post_id'] ?? '');
$userId = normalizeId($_SESSION['user_id']);
$allowed = [
    'helpful' => ['yes','no'],
    'resolved' => ['yes','partly','no'],
    'knows_next_step' => ['yes','unsure','no'],
    'missing_reason' => ['more_detail','clearer_steps','institution_specific','source_or_contact','personal_help','other'],
];
$values = [];
foreach ($allowed as $field => $options) {
    $value = strtolower(trim((string)($data[$field] ?? '')));
    $values[$field] = in_array($value, $options, true) ? $value : null;
}
$note = trim((string)($data['missing_note'] ?? ''));
if ($postId === '' || $values['helpful'] === null || $values['resolved'] === null || $values['knows_next_step'] === null || mb_strlen($note) > 500) { http_response_code(400); echo json_encode(['error' => 'Complete the three feedback questions.']); exit; }

try {
    $db = getDB();
    $exists = $db->prepare('SELECT 1 FROM posts WHERE post_id = :post_id AND is_hidden = 0');
    $exists->execute([':post_id' => $postId]);
    if (!$exists->fetchColumn()) { http_response_code(404); echo json_encode(['error' => 'Answer not found.']); exit; }
    $alreadySubmitted = $db->prepare('SELECT 1 FROM content_resolution_feedback WHERE post_id = :post_id AND user_id = :user_id');
    $alreadySubmitted->execute([':post_id' => $postId, ':user_id' => $userId]);
    if ($alreadySubmitted->fetchColumn()) { http_response_code(409); echo json_encode(['error' => 'You already shared feedback for this answer.']); exit; }
    $db->beginTransaction();
    $stmt = $db->prepare("INSERT INTO content_resolution_feedback
        (post_id,user_id,helpful,resolved,knows_next_step,missing_reason,missing_note)
        VALUES (:post_id,:user_id,:helpful,:resolved,:next_step,:missing_reason,NULLIF(:missing_note,''))");
    $stmt->execute([':post_id'=>$postId, ':user_id'=>$userId, ':helpful'=>$values['helpful'], ':resolved'=>$values['resolved'], ':next_step'=>$values['knows_next_step'], ':missing_reason'=>$values['missing_reason'], ':missing_note'=>$note]);

    $needsReview = $values['helpful'] === 'no'
        || in_array($values['resolved'], ['partly', 'no'], true)
        || in_array($values['knows_next_step'], ['unsure', 'no'], true);
    if ($needsReview) {
        $gapId = generateUniqueId($db, 'knowledge_gaps');
        $gap = $db->prepare("INSERT INTO knowledge_gaps
            (gap_id,source_post_id,source_user_id,helpful,resolved_signal,next_step_signal,missing_reason,missing_note)
            VALUES (:gap_id,:post_id,:user_id,:helpful,:resolved,:next_step,:missing_reason,NULLIF(:missing_note,''))");
        $gap->execute([
            ':gap_id' => $gapId,
            ':post_id' => $postId,
            ':user_id' => $userId,
            ':helpful' => $values['helpful'],
            ':resolved' => $values['resolved'],
            ':next_step' => $values['knows_next_step'],
            ':missing_reason' => $values['missing_reason'],
            ':missing_note' => $note,
        ]);
    }
    $db->commit();
    echo json_encode(['success' => true, 'message' => 'Thanks—your feedback will help improve this guidance.']);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) { $db->rollBack(); }
    if ((string)($e->errorInfo[1] ?? '') === '1062') { http_response_code(409); echo json_encode(['error' => 'You already shared feedback for this answer.']); exit; }
    error_log('Feedback submit error: '.$e->getMessage()); http_response_code(500); echo json_encode(['error' => 'Unable to save feedback.']);
} catch (Throwable $e) { if (isset($db) && $db->inTransaction()) { $db->rollBack(); } error_log('Feedback submit error: '.$e->getMessage()); http_response_code(500); echo json_encode(['error' => 'Unable to save feedback.']); }
