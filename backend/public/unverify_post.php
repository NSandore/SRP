<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
$post_id = '';
if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents("php://input"), true);
    $post_id = isset($data['post_id']) ? normalizeId($data['post_id']) : '';
} else {
    $post_id = isset($_POST['post_id']) ? normalizeId($_POST['post_id']) : '';
}

$user_id = normalizeId($_SESSION['user_id']);
$role_id = (int)($_SESSION['role_id'] ?? 0);

if ($post_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'post_id is required']);
    exit;
}

try {
    $db = getDB();

    $checkStmt = $db->prepare("
        SELECT verified, verified_by
        FROM posts
        WHERE post_id = :post_id
        LIMIT 1
    ");
    $checkStmt->execute([':post_id' => $post_id]);
    $row = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found']);
        exit;
    }

    // Ensure user still has moderation rights in this community.
    $communityStmt = $db->prepare("
        SELECT f.community_id
        FROM posts p
        JOIN threads t ON p.thread_id = t.thread_id
        JOIN forums f ON t.forum_id = f.forum_id
        WHERE p.post_id = :post_id
        LIMIT 1
    ");
    $communityStmt->execute([':post_id' => $post_id]);
    $community_id = normalizeId($communityStmt->fetchColumn());
    if ($community_id === '' || !canModerateCommunityContent($user_id, $role_id, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'Not authorized to unverify this post']);
        exit;
    }

    if ((int)($row['verified'] ?? 0) !== 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Post is not verified']);
        exit;
    }

    if (normalizeId($row['verified_by'] ?? '') !== $user_id) {
        http_response_code(403);
        echo json_encode(['error' => 'Only the verifier can unverify this post']);
        exit;
    }

    $updateStmt = $db->prepare("
        UPDATE posts
        SET verified = 0, verified_by = NULL, verified_at = NULL
        WHERE post_id = :post_id
          AND verified = 1
          AND verified_by = :user_id
    ");
    $updateStmt->execute([
        ':post_id' => $post_id,
        ':user_id' => $user_id
    ]);

    if ($updateStmt->rowCount() === 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Unable to unverify post']);
        exit;
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
