<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

$userId = isset($inputData['user_id']) ? normalizeId($inputData['user_id']) : null;
$schoolName = isset($inputData['schoolName']) ? trim($inputData['schoolName']) : null;
$startDate = isset($inputData['startDate']) ? $inputData['startDate'] : null;
$endDate = isset($inputData['endDate']) ? $inputData['endDate'] : null;

if (!$userId || !$schoolName || !$startDate || !$endDate) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

try {
    $db = getDB();

    // Check if user exists and is verified
    $stmt = $db->prepare("SELECT is_verified FROM users WHERE user_id = :user_id");
    $stmt->execute([':user_id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    if (!$user['is_verified']) {
        http_response_code(403);
        echo json_encode(['error' => 'User not verified']);
        exit;
    }

    // Find the community by school name
    $stmt = $db->prepare("SELECT id FROM communities WHERE name = :name LIMIT 1");
    $stmt->execute([':name' => $schoolName]);
    $community = $stmt->fetch();

    if (!$community || !isset($community['id'])) {
        http_response_code(404);
        echo json_encode(['error' => 'School not found']);
        exit;
    }

    $communityId = $community['id'];

    // Update user with recent university
    $updateUserStmt = $db->prepare("
        UPDATE users SET recent_university_id = :community_id WHERE user_id = :user_id
    ");
    $updateUserStmt->execute([
        ':community_id' => $communityId,
        ':user_id' => $userId
    ]);

    // Add educational experience
    $experienceId = generateUniqueId($db, 'educational_experience');
    $eeStmt = $db->prepare("
        INSERT INTO educational_experience (id, user_id, community_id, start_date, end_date)
        VALUES (:id, :user_id, :community_id, :start_date, :end_date)
    ");
    $eeStmt->execute([
        ':id' => $experienceId,
        ':user_id' => $userId,
        ':community_id' => $communityId,
        ':start_date' => $startDate,
        ':end_date' => $endDate
    ]);

    // Follow the school
    $followId = generateUniqueId($db, 'followed_communities');
    $followStmt = $db->prepare("
        INSERT IGNORE INTO followed_communities (id, user_id, community_id)
        VALUES (:id, :user_id, :community_id)
    ");
    $followStmt->execute([
        ':id' => $followId,
        ':user_id' => $userId,
        ':community_id' => $communityId
    ]);

    http_response_code(200);
    echo json_encode(['message' => 'Registration completed successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
