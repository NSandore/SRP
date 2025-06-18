<?php
require_once __DIR__ . '/../db_connection.php';
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$db = getDB();
$stmt = $db->prepare("SELECT email FROM users WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user || $user['email'] !== 'n.sandore5140@gmail.com') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$requests = $db->query("SELECT r.request_id, r.name, r.type, r.description, r.user_id, u.email, u.first_name, u.last_name FROM community_creation_requests r JOIN users u ON r.user_id = u.user_id WHERE r.status = 'pending' ORDER BY r.created_at DESC")->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'requests' => $requests]);
?>
