<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    $db = getDB();

    if (!isset($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing user_id']);
        exit;
    }

    $user_id = normalizeId($_GET['user_id']);

    $query = "SELECT st.thread_id, t.title, st.saved_at
              FROM saved_threads st
              JOIN threads t ON st.thread_id = t.thread_id
              WHERE st.user_id = :user_id
              ORDER BY st.saved_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $savedThreads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'saved_threads' => $savedThreads]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
