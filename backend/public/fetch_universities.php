<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    $stmt = $db->query("SELECT name, tagline, logo_path FROM universities ORDER BY name ASC");
    $universities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($universities);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
