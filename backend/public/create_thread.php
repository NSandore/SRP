<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

if (!isset($_SESSION['role_id']) || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}

// Retrieve and decode the JSON input (fallback to $_POST)
$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !is_array($data)) {
    $data = $_POST;
}

// Extract and sanitize input data
$forum_id         = isset($data['forum_id']) ? normalizeId($data['forum_id']) : '';
$user_id          = isset($data['user_id']) ? normalizeId($data['user_id']) : '';
$title           = isset($data['title']) ? trim($data['title']) : '';
$firstPostContent = isset($data['firstPostContent']) ? trim($data['firstPostContent']) : '';
$tags            = isset($data['tags']) && is_array($data['tags']) ? $data['tags'] : [];

// Validate required fields
if (empty($forum_id) || empty($user_id) || empty($title) || empty($firstPostContent)) {
    echo json_encode(['error' => 'Missing required fields.']);
    exit;
}

if ($user_id !== normalizeId($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot create a thread as another user.']);
    exit;
}

// Sanitize the firstPostContent to allow only specific HTML tags
// You can adjust the allowed tags based on your requirements
$allowed_tags = '<p><a><b><strong><i><em><u><ul><ol><li><br><img><h1><h2><h3><h4><h5><h6>';
$sanitized_content = strip_tags($firstPostContent, $allowed_tags);

// Optionally, you can further sanitize attributes (e.g., href in <a>, src in <img>)
// For more robust sanitization, consider using libraries like HTMLPurifier

try {
    $db = getDB();

    $forumStmt = $db->prepare("SELECT community_id FROM forums WHERE forum_id = :fid LIMIT 1");
    $forumStmt->execute([':fid' => $forum_id]);
    $forum = $forumStmt->fetch(PDO::FETCH_ASSOC);
    if (!$forum) {
        http_response_code(404);
        echo json_encode(['error' => 'Forum not found.']);
        exit;
    }
    $communityId = normalizeId($forum['community_id'] ?? '');

    if (!canManageForums($user_id, (int)$_SESSION['role_id'], $communityId, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to create threads in this forum.']);
        exit;
    }

    $postingWindow = srp_get_posting_window($db, $user_id);
    if (!$postingWindow['can_post']) {
        http_response_code(403);
        echo json_encode([
            'error' => 'Unverified users can create up to 1 post per day. Verify your email to remove this limit.',
            'requires_verification_prompt' => true,
            'posting' => $postingWindow,
        ]);
        exit;
    }
    
    // Start a transaction to ensure both inserts succeed or fail together
    $db->beginTransaction();
    
    // 1) Insert Thread
    $thread_id = generateUniqueId($db, 'threads');
    $stmt = $db->prepare("INSERT INTO threads (thread_id, forum_id, user_id, title, created_at) VALUES (:thread_id, :forum_id, :user_id, :title, NOW())");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':forum_id' => $forum_id,
        ':user_id'  => $user_id,
        ':title'    => $title
    ]);

    // 2) Insert First Post
    $post_id = generateUniqueId($db, 'posts');
    $stmt2 = $db->prepare("INSERT INTO posts (post_id, thread_id, user_id, content, created_at) VALUES (:post_id, :thread_id, :user_id, :content, NOW())");
    $stmt2->execute([
        ':post_id' => $post_id,
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $sanitized_content
    ]);

    // 3) Tag mappings (optional)
    $tagIds = srp_resolve_tag_ids($db, $tags);
    srp_sync_tag_mappings($db, 'thread_tags', 'thread_id', $thread_id, $tagIds);

    // Commit the transaction
    $db->commit();

    echo json_encode([
        'success'     => true,
        'thread_id'   => $thread_id,
        'post_id'     => $post_id,
        'message'     => 'Thread created successfully (with first post).'
    ]);
} catch (PDOException $e) {
    // Rollback the transaction in case of error
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    // Log the error for debugging purposes (optional)
    error_log('Database Error: ' . $e->getMessage());

    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
