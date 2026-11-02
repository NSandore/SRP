<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/content_provenance.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

// Determine the content type and retrieve parameters accordingly
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
$post_id = '';
$data = [];
if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents("php://input"), true);
    $post_id = isset($data['post_id']) ? normalizeId($data['post_id']) : '';
} else {
    $data = $_POST;
    $post_id = isset($_POST['post_id']) ? normalizeId($_POST['post_id']) : '';
}

$perspectiveType = srp_normalize_perspective_type($data['perspective_type'] ?? null);
$sourceName = trim((string)($data['source_name'] ?? ''));
$sourceUrl = trim((string)($data['source_url'] ?? ''));
$reviewNote = trim((string)($data['review_note'] ?? ''));
$reviewIntervalDays = (int)($data['review_interval_days'] ?? 180);
$reviewIntervalDays = in_array($reviewIntervalDays, [90, 180, 365], true) ? $reviewIntervalDays : 180;
if ($sourceUrl !== '' && filter_var($sourceUrl, FILTER_VALIDATE_URL) === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Source URL must be a valid web address.']);
    exit;
}
if (mb_strlen($sourceName) > 255 || mb_strlen($reviewNote) > 500) {
    http_response_code(400);
    echo json_encode(['error' => 'Trust details are too long.']);
    exit;
}

$user_id = normalizeId($_SESSION['user_id']);
$role_id = (int)($_SESSION['role_id'] ?? 0);

// Validate parameters
if ($post_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'post_id is required']);
    exit;
}

$db = getDB();

try {
    // Ensure the post belongs to a community where the user is an ambassador.
    $cstmt = $db->prepare("
        SELECT f.community_id
        FROM posts p
        JOIN threads t ON p.thread_id = t.thread_id
        JOIN forums f ON t.forum_id = f.forum_id
        WHERE p.post_id = :post_id
        LIMIT 1
    ");
    $cstmt->execute([':post_id' => $post_id]);
    $community_id = $cstmt->fetchColumn();
    if (!$community_id) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found']);
        exit;
    }

    if (!canModerateCommunityContent($user_id, $role_id, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'Not authorized to verify this post']);
        exit;
    }

    $query = "UPDATE posts
              SET verified = 1,
                  verified_by = :user_id,
                  verified_at = NOW(),
                  perspective_type = COALESCE(:perspective_type, perspective_type),
                  source_name = NULLIF(:source_name, ''),
                  source_url = NULLIF(:source_url, ''),
                  applicable_community_id = :community_id,
                  reviewed_at = NOW(),
                  review_due_at = DATE_ADD(NOW(), INTERVAL {$reviewIntervalDays} DAY),
                  review_note = NULLIF(:review_note, '')
              WHERE post_id = :post_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_STR);
    $stmt->bindParam(':post_id', $post_id, PDO::PARAM_STR);
    $stmt->bindValue(':perspective_type', $perspectiveType, $perspectiveType === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->bindValue(':source_name', $sourceName, PDO::PARAM_STR);
    $stmt->bindValue(':source_url', $sourceUrl, PDO::PARAM_STR);
    $stmt->bindValue(':community_id', $community_id, PDO::PARAM_STR);
    $stmt->bindValue(':review_note', $reviewNote, PDO::PARAM_STR);
    $stmt->execute();

    // Send notification to post owner
    // Get the post owner's user_id
    $postOwnerStmt = $db->prepare("SELECT user_id FROM posts WHERE post_id = :post_id");
    $postOwnerStmt->execute([':post_id' => $post_id]);
    $post_owner_id = $postOwnerStmt->fetchColumn();

    // Only send notification if verifier is not the post owner
    if ($post_owner_id && $post_owner_id !== $user_id) {
        // Get verifier's name and privacy settings
        $verifierStmt = $db->prepare("SELECT first_name, last_name, is_public FROM users WHERE user_id = :user_id");
        $verifierStmt->execute([':user_id' => $user_id]);
        $verifier = $verifierStmt->fetch(PDO::FETCH_ASSOC);

        if ($verifier) {
            // Format verifier's name based on privacy settings
            if ((int)$verifier['is_public'] === 1) {
                // Public profile - show full name
                $verifier_name = $verifier['first_name'] . ' ' . $verifier['last_name'];
            } else {
                // Private profile - show first name and last initial
                $verifier_name = $verifier['first_name'] . ' ' . substr($verifier['last_name'], 0, 1) . '.';
            }

            $linkStmt = $db->prepare("
                SELECT t.thread_id, t.forum_id
                FROM posts p
                JOIN threads t ON t.thread_id = p.thread_id
                WHERE p.post_id = :post_id
                LIMIT 1
            ");
            $linkStmt->execute([':post_id' => $post_id]);
            $target = $linkStmt->fetch(PDO::FETCH_ASSOC);
            $postPath = $target
                ? "/info/forum/{$target['forum_id']}/thread/{$target['thread_id']}#post-{$post_id}"
                : null;
            $message = $postPath
                ? "$verifier_name verified your <a href=\"{$postPath}\">post</a> as correct."
                : "$verifier_name verified your post as correct.";

            // Insert the notification
            $notificationId = generateUniqueId($db, 'notifications');
            $notifStmt = $db->prepare("
                INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
                VALUES (:notification_id, :recipient_user_id, :actor_user_id, 'verify', NULL, :message)
            ");
            $notifStmt->execute([
                ':notification_id' => $notificationId,
                ':recipient_user_id' => $post_owner_id,
                ':actor_user_id' => $user_id,
                ':message' => $message
            ]);
        }
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ']);
}
?>
