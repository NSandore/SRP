<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    $stmt = $db->query("SELECT id, name, tagline, logo_path, parent_community_id FROM communities ORDER BY name ASC");
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($communities);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
