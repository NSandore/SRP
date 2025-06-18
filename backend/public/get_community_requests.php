<?php
session_start();
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['email'] !== 'n.sandore5140@gmail.com') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->query("SELECT r.id, r.name, r.community_type, r.description, r.status, r.created_at, u.email AS requester_email FROM community_creation_requests r JOIN users u ON r.user_email = u.email WHERE r.status = 'pending' ORDER BY r.created_at DESC");
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'requests' => $requests]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
