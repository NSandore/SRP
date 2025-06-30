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
    $stmt = $db->prepare('SELECT community_id FROM community_admins WHERE user_email = :email');
    $stmt->execute([':email' => $_SESSION['email']]);
    $communities = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode(['success' => true, 'communities' => $communities]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
