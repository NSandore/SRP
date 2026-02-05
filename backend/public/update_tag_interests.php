<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);
if (!is_array($inputData)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload.']);
    exit;
}

$user_id = normalizeId($inputData['user_id'] ?? '');
$tags = $inputData['tags'] ?? [];

if ($user_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

try {
    $db = getDB();
    $tagIds = srp_resolve_tag_ids($db, is_array($tags) ? $tags : []);
    srp_sync_tag_mappings($db, 'user_interests', 'user_id', $user_id, $tagIds);

    echo json_encode(['success' => true, 'message' => 'Tag interests updated successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
