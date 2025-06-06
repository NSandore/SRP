<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

if (empty($inputData['user_id']) || empty($inputData['code'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and verification code are required']);
    exit;
}

$userId = (int)$inputData['user_id'];
$submittedCode = trim($inputData['code']);

try {
    $db = getDB();

    // Fetch stored code
    $stmt = $db->prepare("SELECT verification_code, is_verified FROM users WHERE user_id = :user_id");
    $stmt->execute([':user_id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    if ($user['is_verified']) {
        http_response_code(200);
        echo json_encode(['message' => 'User already verified']);
        exit;
    }

    if ($user['verification_code'] != $submittedCode) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid verification code']);
        exit;
    }

    // Update is_verified
    $updateStmt = $db->prepare("UPDATE users SET is_verified = 1 WHERE user_id = :user_id");
    $updateStmt->execute([':user_id' => $userId]);

    http_response_code(200);
    echo json_encode(['message' => 'User verified successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
