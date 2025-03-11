<?php
// pin_to_community.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

// Read and decode the JSON input
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['community_id'], $data['item_id'], $data['item_type'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

$community_id = (int) $data['community_id'];
$item_id = (int) $data['item_id'];
$item_type = $data['item_type'];

// Validate the item type
$allowedTypes = ['forum', 'thread', 'post'];
if (!in_array($item_type, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid item type"]);
    exit;
}

try {
    $db = getDB();

    // Insert the pin record into a table (community_pins)
    // Ensure you have created the table 'community_pins' with columns such as:
    // id (auto_increment), community_id, item_id, item_type, pinned_at (timestamp)
    $query = "INSERT INTO community_pins (community_id, item_id, item_type, pinned_at) 
              VALUES (:community_id, :item_id, :item_type, NOW())";
    $stmt = $db->prepare($query);
    $stmt->execute([
        ':community_id' => $community_id,
        ':item_id' => $item_id,
        ':item_type' => $item_type
    ]);

    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    exit;
}
?>
