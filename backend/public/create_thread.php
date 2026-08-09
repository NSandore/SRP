<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/onboarding.php';
require_once __DIR__ . '/../includes/sanitize.php';
require_once __DIR__ . '/../includes/content_limits.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

$db = null;

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
$title           = isset($data['title']) ? srp_sanitize_plain($data['title']) : '';
$firstPostContent = isset($data['firstPostContent']) ? trim($data['firstPostContent']) : '';
$tagsRaw         = $data['tags'] ?? [];
if (is_string($tagsRaw)) {
    $decodedTags = json_decode($tagsRaw, true);
    $tags = is_array($decodedTags) ? $decodedTags : [];
} elseif (is_array($tagsRaw)) {
    $tags = $tagsRaw;
} else {
    $tags = [];
}
$imageLayoutRaw  = strtolower(trim((string)($data['image_layout'] ?? '')));
if ($imageLayoutRaw === 'left') {
    $imageLayoutRaw = 'right';
}
$imageLayout     = in_array($imageLayoutRaw, ['right', 'banner', 'full'], true) ? $imageLayoutRaw : 'banner';

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

// Sanitize the first post's rich text through the shared HTMLPurifier helper.
$sanitized_content = srp_sanitize_html($firstPostContent);
if (srp_content_text_length($title) > SRP_THREAD_TITLE_MAX_LENGTH) {
    http_response_code(400);
    echo json_encode(['error' => 'Thread titles must be 160 characters or fewer.']);
    exit;
}
if (srp_post_exceeds_limit($sanitized_content)) {
    http_response_code(400);
    echo json_encode(['error' => 'Posts must be 10,000 characters or fewer.']);
    exit;
}

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
    
    // Optional thread image (multipart uploads only)
    $imagePath = null;
    $imageUploadDir = __DIR__ . '/../../uploads/banners/';
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png'];
        $imageMimeType = mime_content_type($_FILES['image']['tmp_name']);
        if (!in_array($imageMimeType, $allowedTypes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid image file type. Only JPEG and PNG allowed.']);
            exit;
        }
        if (!is_dir($imageUploadDir) || !is_writable($imageUploadDir)) {
            http_response_code(500);
            echo json_encode(['error' => 'Image upload directory is not writable.']);
            exit;
        }
        $imageExtension = $imageMimeType === 'image/png' ? 'png' : 'jpg';
    } elseif (isset($_FILES['image'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Image upload error.']);
        exit;
    }

    // Table creation is DDL and implicitly commits in MySQL, so initialize the
    // tag schema before opening the thread/post transaction.
    srp_ensure_tag_tables($db);

    // Start a transaction to ensure both inserts succeed or fail together
    $db->beginTransaction();

    // 1) Insert Thread
    $thread_id = generateUniqueId($db, 'threads');

    if (isset($imageExtension)) {
        $imageFilename = 'thread_' . $thread_id . '_' . time() . '.' . $imageExtension;
        if (!move_uploaded_file($_FILES['image']['tmp_name'], $imageUploadDir . $imageFilename)) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Image upload failed.']);
            exit;
        }
        $imagePath = '/uploads/banners/' . $imageFilename;
    }

    $stmt = $db->prepare("INSERT INTO threads (thread_id, forum_id, user_id, title, image_path, image_layout, created_at) VALUES (:thread_id, :forum_id, :user_id, :title, :image_path, :image_layout, NOW())");
    $stmt->execute([
        ':thread_id' => $thread_id,
        ':forum_id' => $forum_id,
        ':user_id'  => $user_id,
        ':title'    => $title,
        ':image_path' => $imagePath,
        ':image_layout' => $imageLayout
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
} catch (Throwable $e) {
    // Rollback the transaction in case of error
    if ($db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Create thread error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to create thread. Please try again.']);
}
?>
