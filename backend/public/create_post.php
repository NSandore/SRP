<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php'; // Adjust if needed
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../includes/sanitize.php';

header('Content-Type: application/json');

// 1. Check if user is logged in (example check)
if (!isset($_SESSION['user_id'])) {
    http_response_code(403); // Forbidden
    echo json_encode(['error' => 'You must be logged in to create a post.']);
    exit;
}

// 2. Retrieve JSON input
$data = json_decode(file_get_contents('php://input'), true);

// 3. Extract and validate necessary fields
$thread_id = isset($data['thread_id']) ? normalizeId($data['thread_id']) : '';
$user_id   = isset($data['user_id']) ? normalizeId($data['user_id']) : '';
$content   = srp_sanitize_html(trim($data['content'] ?? ''));

if (empty($thread_id) || empty($user_id) || empty($content)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid data for creating a post.']);
    exit;
}

if ($user_id !== normalizeId($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'You cannot create a post as another user.']);
    exit;
}

try {
    // 4. Get the DB connection
    $db = getDB(); // Must match the same function you use in create_forum.php, etc.
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

    $post_id = generateUniqueId($db, 'posts');

    // 5. Insert a new row into `posts`
    $stmt = $db->prepare("
        INSERT INTO posts (post_id, thread_id, user_id, content)
        VALUES (:post_id, :thread_id, :user_id, :content)
    ");
    $stmt->execute([
        ':post_id' => $post_id,
        ':thread_id' => $thread_id,
        ':user_id'   => $user_id,
        ':content'   => $content
    ]);

    // 7. Return success
    echo json_encode([
        'success' => true,
        'post_id' => $post_id,
        'message' => 'Post created successfully.'
    ]);

} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ']);
}
