<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$postId = normalizeId($_GET['post_id'] ?? '');
if ($postId === '') { http_response_code(400); echo json_encode(['error' => 'post_id is required']); exit; }
try {
    $db = getDB();
    $feedback = null;
    if (isset($_SESSION['user_id'])) {
        $stmt = $db->prepare('SELECT helpful,resolved,knows_next_step,missing_reason,missing_note FROM content_resolution_feedback WHERE post_id=:post_id AND user_id=:user_id');
        $stmt->execute([':post_id'=>$postId, ':user_id'=>normalizeId($_SESSION['user_id'])]);
        $feedback = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
    echo json_encode(['success'=>true, 'feedback'=>$feedback]);
} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>'Unable to load feedback.']); }
