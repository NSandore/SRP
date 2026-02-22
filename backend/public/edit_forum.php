<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

// 1) Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}

$role_id_session = (int)$_SESSION['role_id'];
$user_id_session = normalizeId($_SESSION['user_id']);

// 3) Decode JSON or accept multipart form data
$data = json_decode(file_get_contents('php://input'), true);
$usingForm = !empty($_POST) || !empty($_FILES);
$forum_id = normalizeId($usingForm ? ($_POST['forum_id'] ?? '') : ($data['forum_id'] ?? ''));
$new_name = trim($usingForm ? ($_POST['name'] ?? '') : ($data['name'] ?? ''));
$new_desc = trim($usingForm ? ($_POST['description'] ?? '') : ($data['description'] ?? ''));
$tagsRaw = $usingForm ? ($_POST['tags'] ?? null) : ($data['tags'] ?? null);
$tagsProvided = $tagsRaw !== null;
if (is_string($tagsRaw)) {
    $decodedTags = json_decode($tagsRaw, true);
    $tags = is_array($decodedTags) ? $decodedTags : [];
} elseif (is_array($tagsRaw)) {
    $tags = $tagsRaw;
} else {
    $tags = [];
}

if ($forum_id === '' || $new_name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid forum_id or missing name.']);
    exit;
}

try {
    $db = getDB();

    // Fetch forum to get community scope
    $forumStmt = $db->prepare("SELECT community_id FROM forums WHERE forum_id = :fid LIMIT 1");
    $forumStmt->execute([':fid' => $forum_id]);
    $forum = $forumStmt->fetch(PDO::FETCH_ASSOC);
    if (!$forum) {
        http_response_code(404);
        echo json_encode(['error' => 'Forum not found.']);
        exit;
    }

    $community_id = $forum['community_id'];

    if (!canManageForums($user_id_session, $role_id_session, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(['error' => 'Verify your email and use an admin account to edit forums.']);
        exit;
    }

    $bannerPath = null;
    $bannerUploadDir = __DIR__ . '/../../uploads/banners/';
    if (isset($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png'];
        $bannerMimeType = mime_content_type($_FILES['banner']['tmp_name']);
        if (!in_array($bannerMimeType, $allowedTypes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid banner file type. Only JPEG and PNG allowed.']);
            exit;
        }
        if (!is_dir($bannerUploadDir) || !is_writable($bannerUploadDir)) {
            http_response_code(500);
            echo json_encode(['error' => 'Banner upload directory is not writable.']);
            exit;
        }
        $bannerExtension = pathinfo($_FILES['banner']['name'], PATHINFO_EXTENSION);
        $bannerFilename = 'forum_' . $forum_id . '_' . time() . '.' . $bannerExtension;
        $bannerDestination = $bannerUploadDir . $bannerFilename;
        if (move_uploaded_file($_FILES['banner']['tmp_name'], $bannerDestination)) {
            $bannerPath = '/uploads/banners/' . $bannerFilename;
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Banner upload failed.']);
            exit;
        }
    } elseif (isset($_FILES['banner'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Banner upload error.']);
        exit;
    }

    // 4) Perform the update
    $query = "UPDATE forums SET name = :name, description = :desc";
    if ($bannerPath !== null) {
        $query .= ", banner_path = :banner_path";
    }
    $query .= " WHERE forum_id = :forum_id";
    $stmt = $db->prepare($query);
    $stmt->bindValue(':name', $new_name);
    $stmt->bindValue(':desc', $new_desc);
    $stmt->bindValue(':forum_id', $forum_id);
    if ($bannerPath !== null) {
        $stmt->bindValue(':banner_path', $bannerPath);
    }
    $stmt->execute();

    if ($tagsProvided) {
        $tagIds = srp_resolve_tag_ids($db, $tags);
        srp_sync_tag_mappings($db, 'forum_tags', 'forum_id', $forum_id, $tagIds);
    }

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Forum updated successfully.']);
    } else {
        // Possibly no changes or forum doesn't exist
        echo json_encode([
            'success' => false,
            'message' => 'No changes made or forum not found.'
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
