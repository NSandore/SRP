<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$thread_id  = (int)($data['thread_id'] ?? 0);
$user_id  = (int)($data['user_id'] ?? 0);
$vote_type = $data['vote_type'] ?? '';

if (!$thread_id || !$user_id || !in_array($vote_type, ['up','down'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid vote data']);
    exit;
}

$db = getDB();

try {
    $db->beginTransaction();

    // Check if there's already a vote
    $stmt = $db->prepare("SELECT vote_type FROM thread_votes WHERE thread_id = :thread_id AND user_id = :user_id");
    $stmt->execute([':thread_id' => $thread_id, ':user_id' => $user_id]);
    $existingVote = $stmt->fetchColumn();

    if ($existingVote) {
        if ($existingVote === $vote_type) {
            $db->exec("DELETE FROM thread_votes WHERE thread_id = $thread_id AND user_id = $user_id");
            $db->exec("UPDATE threads SET " . ($vote_type === 'up' ? "upvotes = upvotes - 1" : "downvotes = downvotes - 1") . " WHERE thread_id = $thread_id");
        } else {
            $db->exec("UPDATE thread_votes SET vote_type = '$vote_type' WHERE thread_id = $thread_id AND user_id = $user_id");
            $db->exec("UPDATE threads SET upvotes = upvotes " . ($vote_type === 'up' ? "+ 1, downvotes = downvotes - 1" : "- 1, downvotes = downvotes + 1") . " WHERE thread_id = $thread_id");
        }
    } else {
        $db->exec("INSERT INTO thread_votes (thread_id, user_id, vote_type) VALUES ($thread_id, $user_id, '$vote_type')");
        $db->exec("UPDATE threads SET " . ($vote_type === 'up' ? "upvotes = upvotes + 1" : "downvotes = downvotes + 1") . " WHERE thread_id = $thread_id");
    }

    $db->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
