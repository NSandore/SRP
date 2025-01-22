<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if (!isset($_GET['forum_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'forum_id is required']);
    exit;
}

$forum_id = (int)$_GET['forum_id'];
$db = getDB();

try {
    $stmt = $db->prepare("
        SELECT thread_id, forum_id, user_id, title, created_at 
        FROM threads 
        WHERE forum_id = :forum_id 
        ORDER BY created_at ASC
    ");
    $stmt->execute([':forum_id' => $forum_id]);
    $threads = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($threads);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
