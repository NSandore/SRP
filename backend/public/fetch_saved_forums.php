<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    $db = getDB();

    // Expect a GET parameter "user_id"
    if (!isset($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing user_id']);
        exit;
    }

    $user_id = normalizeId($_GET['user_id']);

    $query = "SELECT sf.forum_id, f.name, f.description, sf.saved_at
              FROM saved_forums sf
              JOIN forums f ON sf.forum_id = f.forum_id
              WHERE sf.user_id = :user_id
              ORDER BY sf.saved_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $savedForums = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'saved_forums' => $savedForums]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
