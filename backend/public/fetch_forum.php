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
    $stmt = $db->prepare("SELECT forum_id, name, description FROM forums WHERE forum_id = :forum_id");
    $stmt->execute([':forum_id' => $forum_id]);
    $forum = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($forum) {
        echo json_encode($forum);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Forum not found']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
