<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$thread_id  = isset($data['thread_id']) ? normalizeId($data['thread_id']) : '';
$user_id  = isset($data['user_id']) ? normalizeId($data['user_id']) : '';
$vote_type = $data['vote_type'] ?? '';

if ($thread_id === '' || $user_id === '' || !in_array($vote_type, ['up','down'], true)) {
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
            $del = $db->prepare("DELETE FROM thread_votes WHERE thread_id = :thread_id AND user_id = :user_id");
            $del->execute([':thread_id' => $thread_id, ':user_id' => $user_id]);
            $update = $db->prepare($vote_type === 'up'
                ? "UPDATE threads SET upvotes = upvotes - 1 WHERE thread_id = :thread_id"
                : "UPDATE threads SET downvotes = downvotes - 1 WHERE thread_id = :thread_id");
            $update->execute([':thread_id' => $thread_id]);
        } else {
            $updVote = $db->prepare("UPDATE thread_votes SET vote_type = :vote_type WHERE thread_id = :thread_id AND user_id = :user_id");
            $updVote->execute([':vote_type' => $vote_type, ':thread_id' => $thread_id, ':user_id' => $user_id]);

            $update = $db->prepare(
                $vote_type === 'up'
                    ? "UPDATE threads SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE thread_id = :thread_id"
                    : "UPDATE threads SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE thread_id = :thread_id"
            );
            $update->execute([':thread_id' => $thread_id]);
        }
    } else {
        $voteId = generateUniqueId($db, 'thread_votes');
        $insert = $db->prepare("INSERT INTO thread_votes (id, thread_id, user_id, vote_type) VALUES (:id, :thread_id, :user_id, :vote_type)");
        $insert->execute([':id' => $voteId, ':thread_id' => $thread_id, ':user_id' => $user_id, ':vote_type' => $vote_type]);
        $update = $db->prepare($vote_type === 'up'
            ? "UPDATE threads SET upvotes = upvotes + 1 WHERE thread_id = :thread_id"
            : "UPDATE threads SET downvotes = downvotes + 1 WHERE thread_id = :thread_id");
        $update->execute([':thread_id' => $thread_id]);
    }

    $db->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
