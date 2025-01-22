<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

$community_id = intval($_GET['community_id'] ?? 0);

if ($community_id <= 0) {
    http_response_code(400); // Bad Request
    echo json_encode(["error" => "Invalid community_id"]);
    exit;
}

try {
    $db = getDB(); // Ensure getDB() exists and works correctly
    $stmt = $db->prepare("SELECT forum_id, name, description FROM forums WHERE community_id = :community_id");
    $stmt->bindParam(':community_id', $community_id, PDO::PARAM_INT);
    $stmt->execute();

    $forums = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$forums) {
        echo json_encode(["message" => "No forums found."]);
    } else {
        echo json_encode($forums);
    }
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
