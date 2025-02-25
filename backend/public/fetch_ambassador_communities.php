<?php
// fetch_ambassador_communities.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing user_id"]);
    exit;
}

$user_id = (int) $_GET['user_id'];

try {
    $db = getDB();

    // Fetch ambassador communities for this user by joining the ambassadors table with the communities table
    $query = "SELECT a.community_id, c.name 
              FROM ambassadors a 
              JOIN communities c ON a.community_id = c.community_id 
              WHERE a.user_id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "communities" => $communities]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database error: " . $e->getMessage()]);
    exit;
}
?>
