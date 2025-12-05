<?php
session_start();

require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// 1) Check session
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}

$role_id_session = (int)$_SESSION['role_id'];
$user_id_session = normalizeId($_SESSION['user_id']);

// 3) Decode JSON
$data = json_decode(file_get_contents('php://input'), true);
$forum_id = normalizeId($data['forum_id'] ?? '');
$new_name = trim($data['name'] ?? '');
$new_desc = trim($data['description'] ?? '');

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

    // Permission: super admins OR ambassadors for the community
    if ($role_id_session !== 1) {
        $ambStmt = $db->prepare("SELECT 1 FROM ambassadors WHERE user_id = :uid AND community_id = :cid");
        $ambStmt->execute([
            ':uid' => $user_id_session,
            ':cid' => $community_id,
        ]);
        if (!$ambStmt->fetchColumn()) {
            http_response_code(403);
            echo json_encode(['error' => 'No permission to edit forums.']);
            exit;
        }
    }

    // 4) Perform the update
    $stmt = $db->prepare("
        UPDATE forums
        SET name = :name, description = :desc
        WHERE forum_id = :forum_id
    ");
    $stmt->execute([
        ':name' => $new_name,
        ':desc' => $new_desc,
        ':forum_id' => $forum_id,
    ]);

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
