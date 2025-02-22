<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true);

if (isset($inputData['action']) && $inputData['action'] === 'updateInterests') {
    // Handle adding selected schools to followed_communities for an existing user
    if (empty($inputData['user_id']) || empty($inputData['selected_schools'])) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id and selected_schools are required']);
        exit;
    }

    $user_id = (int)$inputData['user_id'];
    $selected_schools = $inputData['selected_schools'];

    try {
        $db = getDB();

        // For each selected school, find its ID and insert into followed_communities
        foreach ($selected_schools as $schoolName) {
            // Find community_id by school name
            $stmt = $db->prepare("SELECT id FROM communities WHERE name = :name LIMIT 1");
            $stmt->execute([':name' => $schoolName]);
            $univ = $stmt->fetch();
            if ($univ && isset($univ['id'])) {
                $community_id = $univ['id'];

                // Check if already followed
                $checkStmt = $db->prepare("SELECT id FROM followed_communities WHERE user_id = :user_id AND community_id = :community_id LIMIT 1");
                $checkStmt->execute([':user_id' => $user_id, ':community_id' => $community_id]);
                $existing = $checkStmt->fetch();

                if (!$existing) {
                    $insertStmt = $db->prepare("INSERT INTO followed_communities (user_id, community_id) VALUES (:user_id, :community_id)");
                    $insertStmt->execute([':user_id' => $user_id, ':community_id' => $community_id]);
                }
            }
        }

        http_response_code(200);
        echo json_encode(['message' => 'Followed communities updated successfully.']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }

    exit;
}

// Default action: Registering a new user
$requiredFields = ['firstName', 'lastName', 'email', 'password'];
foreach ($requiredFields as $field) {
    if (empty($inputData[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "$field is required"]);
        exit;
    }
}

$firstName = trim($inputData['firstName']);
$lastName = trim($inputData['lastName']);
$email = trim($inputData['email']);
$password = password_hash($inputData['password'], PASSWORD_BCRYPT);
$educationStatus = !empty($inputData['educationStatus']) ? $inputData['educationStatus'] : 'Prospective Student';
$isOver18 = !empty($inputData['isOver18']) ? (bool)$inputData['isOver18'] : false;
$phone = !empty($inputData['phone']) ? trim($inputData['phone']) : null;

$schoolName = !empty($inputData['schoolName']) ? $inputData['schoolName'] : null;
$startDate = !empty($inputData['startDate']) ? $inputData['startDate'] : null;
$endDate = !empty($inputData['endDate']) ? $inputData['endDate'] : null;

try {
    $db = getDB();

    // Insert user
    // role_id = 2 as default (e.g. prospective student)
    $stmt = $db->prepare("
        INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, education_status, is_over_18)
        VALUES (:role_id, :first_name, :last_name, :email, :phone, :password_hash, :education_status, :is_over_18)
    ");
    $stmt->execute([
        ':role_id' => 2,
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':phone' => $phone,
        ':password_hash' => $password,
        ':education_status' => $educationStatus,
        ':is_over_18' => $isOver18
    ]);

    $user_id = $db->lastInsertId();

    // If a school is selected, update recent_community_id and insert educational_experience + followed_communities
    if ($schoolName) {
        // Find community by name
        $uStmt = $db->prepare("SELECT id FROM communities WHERE name = :name LIMIT 1");
        $uStmt->execute([':name' => $schoolName]);
        $univ = $uStmt->fetch();
        if ($univ && isset($univ['id'])) {
            $community_id = $univ['id'];

            // Update user's recent_community_id
            $updateUserStmt = $db->prepare("UPDATE users SET recent_community_id = :community_id WHERE id = :user_id");
            $updateUserStmt->execute([':community_id' => $community_id, ':user_id' => $user_id]);

            // Insert into educational_experience if startDate and endDate are provided
            if ($startDate && $endDate) {
                $eeStmt = $db->prepare("
                    INSERT INTO educational_experience (user_id, community_id, start_date, end_date)
                    VALUES (:user_id, :community_id, :start_date, :end_date)
                ");
                $eeStmt->execute([
                    ':user_id' => $user_id,
                    ':community_id' => $community_id,
                    ':start_date' => $startDate,
                    ':end_date' => $endDate
                ]);
            }

            // Insert into followed_communities
            $fuStmt = $db->prepare("
                INSERT INTO followed_communities (user_id, community_id) 
                VALUES (:user_id, :community_id)
            ");
            $fuStmt->execute([
                ':user_id' => $user_id,
                ':community_id' => $community_id
            ]);
        }
    }

    http_response_code(201);
    echo json_encode(['message' => 'User registered successfully', 'user_id' => $user_id]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
