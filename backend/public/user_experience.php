<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

// Retrieve user ID from GET or JSON body
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';

if (strpos($contentType, 'application/json') !== false) {
    $data = json_decode(file_get_contents("php://input"), true);
    $user_id = isset($data['user_id']) ? (int)$data['user_id'] : 0;
} else {
    $user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
}

// Validate parameters
if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid user_id']);
    exit;
}

$db = getDB(); // Ensure this function exists in db_connection.php

try {
    // Check privacy setting
    $pstmt = $db->prepare("SELECT is_public FROM users WHERE user_id = :uid");
    $pstmt->execute([':uid' => $user_id]);
    $is_public = (int)($pstmt->fetchColumn());

    $viewer_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

    $query = "SELECT experience_id, title, company, start_date, end_date, industry, employment_type, location_city, location_state, location_country, description, responsibilities
              FROM user_experience
              WHERE user_id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->execute();

    $experiences = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Decode JSON responsibilities
        $row['responsibilities'] = json_decode($row['responsibilities'], true) ?? [];

        if ($is_public === 0 && $viewer_id !== $user_id) {
            $row['start_date'] = null;
            $row['end_date'] = null;
        }

        $experiences[] = $row;
    }

    echo json_encode($experiences);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
