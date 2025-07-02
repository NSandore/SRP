<?php
session_start();
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
    $stmt = $db->prepare("SELECT user_id, first_name, last_name, email, avatar_path, is_public FROM users WHERE first_name LIKE :term OR last_name LIKE :term OR email LIKE :term ORDER BY first_name LIMIT 10");
    $stmt->bindValue(':term', $like, PDO::PARAM_STR);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $viewer_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

    foreach ($users as &$u) {
        if ((int)$u['is_public'] === 0 && $viewer_id !== (int)$u['user_id']) {
            $u['last_name'] = substr($u['last_name'], 0, 1) . '.';
        }
        unset($u['is_public']);
    }
    echo json_encode(['success' => true, 'users' => $users]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
