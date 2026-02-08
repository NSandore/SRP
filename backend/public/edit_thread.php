<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

// 1. Check if the user is logged in (has session data)
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['error' => 'You must be logged in to edit a thread.']);
    exit;
}

$user_id_session = normalizeId($_SESSION['user_id']);
$role_id_session = (int) $_SESSION['role_id'];

// 2. Parse the JSON input
$data = json_decode(file_get_contents('php://input'), true);

$thread_id = isset($data['thread_id']) ? normalizeId($data['thread_id']) : '';
$new_title = trim($data['new_title'] ?? '');
$tagsProvided = is_array($data) && array_key_exists('tags', $data);
$tags = $tagsProvided && is_array($data['tags']) ? $data['tags'] : [];

// Basic validation
if ($thread_id === '' || $new_title === '') {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid thread_id or title.']);
    exit;
}

try {
    $db = getDB();

    // 3. Fetch thread owner and community context
    $stmt = $db->prepare("
        SELECT t.user_id, f.community_id
        FROM threads t
        JOIN forums f ON f.forum_id = t.forum_id
        WHERE t.thread_id = :thread_id
        LIMIT 1
    ");
    $stmt->execute([':thread_id' => $thread_id]);
    $threadRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$threadRow) {
        http_response_code(404); // Thread not found
        echo json_encode(['error' => 'Thread not found.']);
        exit;
    }

    $thread_owner_id = normalizeId($threadRow['user_id']);
    $community_id = normalizeId($threadRow['community_id'] ?? '');

    // 4. Check permission: thread owner OR super admin OR ambassador admin of thread community
    $canCommunityAdminEdit = ($community_id !== '')
        ? canManageAmbassadors($user_id_session, $role_id_session, $community_id, $db)
        : false;
    if (!isSuperAdmin($role_id_session) && !$canCommunityAdminEdit && $thread_owner_id !== $user_id_session) {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'No permission to edit this thread.']);
        exit;
    }

    // 5. Update the thread title and edit metadata
    $updateStmt = $db->prepare("
        UPDATE threads
        SET title = :title,
            updated_at = NOW(),
            updated_by = :updated_by
        WHERE thread_id = :thread_id
    ");
    $updateStmt->execute([
        ':title' => $new_title,
        ':updated_by' => $user_id_session,
        ':thread_id' => $thread_id
    ]);

    if ($tagsProvided) {
        $tagIds = srp_resolve_tag_ids($db, $tags);
        srp_sync_tag_mappings($db, 'thread_tags', 'thread_id', $thread_id, $tagIds);
    }

    // 6. Check how many rows were updated
    if ($updateStmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Thread updated successfully.']);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'No changes were made to the thread title.'
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500); // Server error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
