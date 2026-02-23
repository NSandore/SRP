<?php
// pin_to_community.php

require_once __DIR__ . '/cors.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_bootstrap.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

startSession();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Not logged in"]);
    exit;
}

// Read and decode the JSON input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['community_id'], $data['item_id'], $data['item_type'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

$community_id = normalizeId($data['community_id']);
$item_id = normalizeId($data['item_id']);
$item_type = strtolower(trim((string)($data['item_type'] ?? '')));
$sessionUserId = normalizeId($_SESSION['user_id']);
$sessionRoleId = (int)($_SESSION['role_id'] ?? 0);

// Validate the item type
$allowedTypes = ['forum', 'thread'];
if (!in_array($item_type, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid item type"]);
    exit;
}

if ($community_id === '' || $item_id === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

try {
    $db = getDB();

    // Permission: super admin or ambassador of the target community.
    if (!isSuperAdmin($sessionRoleId) && !isAmbassador($sessionUserId, $community_id, $db)) {
        http_response_code(403);
        echo json_encode(["success" => false, "error" => "Not authorized to pin to this community"]);
        exit;
    }

    // Validate item exists.
    if ($item_type === 'forum') {
        $existsStmt = $db->prepare("SELECT 1 FROM forums WHERE forum_id = :item_id LIMIT 1");
    } else {
        $existsStmt = $db->prepare("SELECT 1 FROM threads WHERE thread_id = :item_id LIMIT 1");
    }
    $existsStmt->execute([':item_id' => $item_id]);
    if (!$existsStmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Item not found"]);
        exit;
    }

    // Prevent duplicates.
    $existingStmt = $db->prepare("
        SELECT id
        FROM pinned_items
        WHERE community_id = :community_id
          AND item_id = :item_id
          AND item_type = :item_type
        LIMIT 1
    ");
    $existingStmt->execute([
        ':community_id' => $community_id,
        ':item_id' => $item_id,
        ':item_type' => $item_type
    ]);
    $existingId = $existingStmt->fetchColumn();
    if ($existingId) {
        echo json_encode(["success" => true, "already_pinned" => true, "pin_id" => $existingId]);
        exit;
    }

    $pinId = generateUniqueId($db, 'pinned_items');
    $query = "INSERT INTO pinned_items (id, community_id, item_id, item_type, pinned_at) 
              VALUES (:id, :community_id, :item_id, :item_type, NOW())";
    $stmt = $db->prepare($query);
    $stmt->execute([
        ':id' => $pinId,
        ':community_id' => $community_id,
        ':item_id' => $item_id,
        ':item_type' => $item_type
    ]);

    echo json_encode(["success" => true, "already_pinned" => false, "pin_id" => $pinId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    exit;
}
?>
