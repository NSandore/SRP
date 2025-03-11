<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$post_id  = (int)($data['post_id'] ?? 0);
$user_id  = (int)($data['user_id'] ?? 0);
$vote_type = $data['vote_type'] ?? '';

if (!$post_id || !$user_id || !in_array($vote_type, ['up','down'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid vote data']);
    exit;
}

$db = getDB();

try {
    $db->beginTransaction();

    // Check if there's already a vote by this user on this post
    $stmt = $db->prepare("SELECT vote_type FROM post_votes WHERE post_id = :post_id AND user_id = :user_id");
    $stmt->execute([':post_id' => $post_id, ':user_id' => $user_id]);
    $existingVote = $stmt->fetchColumn(); // returns 'up', 'down', or false/null if none

    if ($existingVote) {
        if ($existingVote === $vote_type) {
            // User re-clicked the same vote => remove row (toggle off)
            $deleteStmt = $db->prepare("DELETE FROM post_votes WHERE post_id = :post_id AND user_id = :user_id");
            $deleteStmt->execute([':post_id' => $post_id, ':user_id' => $user_id]);

            // Decrement upvotes or downvotes by 1
            if ($vote_type === 'up') {
                $db->exec("UPDATE posts SET upvotes = upvotes - 1 WHERE post_id = $post_id");
            } else {
                $db->exec("UPDATE posts SET downvotes = downvotes - 1 WHERE post_id = $post_id");
            }
        } else {
            // Switch from 'up' to 'down' or 'down' to 'up'
            $updateStmt = $db->prepare("UPDATE post_votes SET vote_type = :vote_type WHERE post_id = :post_id AND user_id = :user_id");
            $updateStmt->execute([':vote_type' => $vote_type, ':post_id' => $post_id, ':user_id' => $user_id]);

            // Adjust upvotes/downvotes in posts
            if ($existingVote === 'up' && $vote_type === 'down') {
                // up--, down++
                $db->exec("UPDATE posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE post_id = $post_id");
            } else if ($existingVote === 'down' && $vote_type === 'up') {
                // down--, up++
                $db->exec("UPDATE posts SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE post_id = $post_id");
            }
        }
    } else {
        // No existing vote => insert a new row
        $insertStmt = $db->prepare("INSERT INTO post_votes (post_id, user_id, vote_type) VALUES (:post_id, :user_id, :vote_type)");
        $insertStmt->execute([':post_id' => $post_id, ':user_id' => $user_id, ':vote_type' => $vote_type]);

        // increment upvote/downvote on the posts table
        if ($vote_type === 'up') {
            $db->exec("UPDATE posts SET upvotes = upvotes + 1 WHERE post_id = $post_id");
        } else {
            $db->exec("UPDATE posts SET downvotes = downvotes + 1 WHERE post_id = $post_id");
        }
    }

    $db->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
