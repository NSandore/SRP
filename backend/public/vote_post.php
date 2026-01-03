<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$post_id  = isset($data['post_id']) ? normalizeId($data['post_id']) : '';
$user_id  = isset($data['user_id']) ? normalizeId($data['user_id']) : '';
$vote_type = $data['vote_type'] ?? '';

if ($post_id === '' || $user_id === '' || !in_array($vote_type, ['up','down'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid vote data']);
    exit;
}

$db = getDB();

try {
    $db->beginTransaction();

    // Load post owner for notifications
    $ownerStmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = :pid");
    $ownerStmt->execute([':pid' => $post_id]);
    $postOwnerId = $ownerStmt->fetchColumn();
    if (!$postOwnerId) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found']);
        exit;
    }

    // Check if there's already a vote by this user on this post
    $stmt = $db->prepare("SELECT vote_type FROM post_votes WHERE post_id = :post_id AND user_id = :user_id");
    $stmt->execute([':post_id' => $post_id, ':user_id' => $user_id]);
    $existingVote = $stmt->fetchColumn(); // returns 'up', 'down', or false/null if none

    $shouldNotify = false;
    $notifyType = null;

    if ($existingVote) {
        if ($existingVote === $vote_type) {
            // User re-clicked the same vote => remove row (toggle off)
            $deleteStmt = $db->prepare("DELETE FROM post_votes WHERE post_id = :post_id AND user_id = :user_id");
            $deleteStmt->execute([':post_id' => $post_id, ':user_id' => $user_id]);

            // Decrement upvotes or downvotes by 1
            if ($vote_type === 'up') {
                $dec = $db->prepare("UPDATE posts SET upvotes = upvotes - 1 WHERE post_id = :post_id");
                $dec->execute([':post_id' => $post_id]);
            } else {
                $dec = $db->prepare("UPDATE posts SET downvotes = downvotes - 1 WHERE post_id = :post_id");
                $dec->execute([':post_id' => $post_id]);
            }
        } else {
            // Switch from 'up' to 'down' or 'down' to 'up'
            $updateStmt = $db->prepare("UPDATE post_votes SET vote_type = :vote_type WHERE post_id = :post_id AND user_id = :user_id");
            $updateStmt->execute([':vote_type' => $vote_type, ':post_id' => $post_id, ':user_id' => $user_id]);

            // Adjust upvotes/downvotes in posts
            if ($existingVote === 'up' && $vote_type === 'down') {
                // up--, down++
                $adj = $db->prepare("UPDATE posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE post_id = :post_id");
                $adj->execute([':post_id' => $post_id]);
            } else if ($existingVote === 'down' && $vote_type === 'up') {
                // down--, up++
                $adj = $db->prepare("UPDATE posts SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE post_id = :post_id");
                $adj->execute([':post_id' => $post_id]);
            }
            $shouldNotify = true;
            $notifyType = $vote_type === 'up' ? 'upvote' : 'downvote';
        }
    } else {
        // No existing vote => insert a new row
        $voteId = generateUniqueId($db, 'post_votes');
        $insertStmt = $db->prepare("INSERT INTO post_votes (id, post_id, user_id, vote_type) VALUES (:id, :post_id, :user_id, :vote_type)");
        $insertStmt->execute([':id' => $voteId, ':post_id' => $post_id, ':user_id' => $user_id, ':vote_type' => $vote_type]);

        // increment upvote/downvote on the posts table
        if ($vote_type === 'up') {
            $inc = $db->prepare("UPDATE posts SET upvotes = upvotes + 1 WHERE post_id = :post_id");
            $inc->execute([':post_id' => $post_id]);
        } else {
            $inc = $db->prepare("UPDATE posts SET downvotes = downvotes + 1 WHERE post_id = :post_id");
            $inc->execute([':post_id' => $post_id]);
        }
        $shouldNotify = true;
        $notifyType = $vote_type === 'up' ? 'upvote' : 'downvote';
    }

    $db->commit();
    // Notify the post owner (unless self-vote) only when a new vote or type change happens
    if ($shouldNotify && $postOwnerId && $postOwnerId !== $user_id) {
        // Check recipient preference for vote notifications
        $prefStmt = $db->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(extras, '$.notify_votes')) AS notify_votes FROM account_settings WHERE user_id = :rid");
        $prefStmt->execute([':rid' => $postOwnerId]);
        $prefRow = $prefStmt->fetch(PDO::FETCH_ASSOC);
        $notifyPref = isset($prefRow['notify_votes']) ? (int)$prefRow['notify_votes'] : 1;
        if ($notifyPref !== 1) {
            echo json_encode(['success' => true]);
            exit;
        }
        $notifId = generateUniqueId($db, 'notifications');
        // Build actor display
        $actorStmt = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = :uid");
        $actorStmt->execute([':uid' => $user_id]);
        $actor = $actorStmt->fetch(PDO::FETCH_ASSOC);
        $actorName = $actor ? ($actor['first_name'] . ' ' . substr($actor['last_name'], 0, 1) . '.') : 'Someone';
        $message = $notifyType === 'upvote'
            ? "$actorName upvoted your post."
            : "$actorName downvoted your post.";
        $notifStmt = $db->prepare("
            INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
            VALUES (:nid, :rid, :aid, :ntype, NULL, :msg)
        ");
        $notifStmt->execute([
            ':nid' => $notifId,
            ':rid' => $postOwnerId,
            ':aid' => $user_id,
            ':ntype' => $notifyType,
            ':msg' => $message,
        ]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
