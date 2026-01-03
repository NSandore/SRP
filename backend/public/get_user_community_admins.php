<?php
session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

if (!isset($_SESSION['user_id']) || !isset($_SESSION['email'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT c.id AS community_id, c.name, c.community_type, c.parent_community_id
        FROM ambassadors a
        JOIN communities c ON c.id = a.community_id
        WHERE a.user_id = :uid AND a.role = 'admin'
        ORDER BY c.name ASC
    ");
    $stmt->execute([':uid' => $_SESSION['user_id']]);
    $communities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'communities' => $communities]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
