<?php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$term = isset($_GET['term']) ? trim($_GET['term']) : '';
if ($term === '') {
    echo json_encode(['success' => true, 'users' => []]);
    exit;
}

try {
    $db = getDB();
    $like = '%' . $term . '%';
    $stmt = $db->prepare("SELECT user_id, first_name, last_name, avatar_path FROM users WHERE first_name LIKE :term OR last_name LIKE :term ORDER BY first_name LIMIT 10");
    $stmt->bindValue(':term', $like, PDO::PARAM_STR);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'users' => $users]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
