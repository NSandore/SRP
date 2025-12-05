<?php
// add_vote_notification.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_POST['post_id']) || !isset($_POST['voter_id']) || !isset($_POST['vote_type'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing post_id, voter_id, or vote_type']);
    exit;
}

$post_id = normalizeId($_POST['post_id']);
$voter_id = normalizeId($_POST['voter_id']);
$vote_type_input = $_POST['vote_type']; // Expect 'up' or 'down'

if ($vote_type_input === 'up') {
    $vote_type = 'upvote';
} elseif ($vote_type_input === 'down') {
    $vote_type = 'downvote';
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid vote_type']);
    exit;
}

try {
    $db = getDB();

    // Retrieve the post to get the owner's id.
    $stmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = ?");
    $stmt->execute([$post_id]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$post) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Post not found']);
        exit;
    }
    $post_owner_id = $post['user_id'];

    // Do not notify if the voter is the post owner.
    if ($voter_id === $post_owner_id) {
        echo json_encode(['success' => true, 'message' => 'No notification for self vote']);
        exit;
    }

    // Fetch voter details.
    $stmt2 = $db->prepare("SELECT first_name, last_name FROM users WHERE user_id = ?");
    $stmt2->execute([$voter_id]);
    $voter = $stmt2->fetch(PDO::FETCH_ASSOC);
    if (!$voter) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Voter not found']);
        exit;
    }
    $voter_name = $voter['first_name'] . ' ' . substr($voter['last_name'], 0, 1) . '.';
    $message = "$voter_name " . ($vote_type === 'upvote' ? "upvoted" : "downvoted") . " your post.";

    // Insert the notification.
    $notificationId = generateUniqueId($db, 'notifications');
    $insertStmt = $db->prepare("INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message) VALUES (?, ?, ?, ?, ?, ?)");
    $result = $insertStmt->execute([$notificationId, $post_owner_id, $voter_id, $vote_type, $post_id, $message]);

    if ($result) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to insert notification']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
