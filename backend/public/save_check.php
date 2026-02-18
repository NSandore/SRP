<?php
header('Content-Type: application/json');
require_once '../db_connection.php';

try {
    if (!isset($_GET['user_id']) || !isset($_GET['item_type']) || !isset($_GET['item_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing parameters']);
        exit;
    }

    $db = getDB();
    $user_id = normalizeId($_GET['user_id']);
    $item_type = strtolower(trim((string)$_GET['item_type']));
    $item_id = normalizeId($_GET['item_id']);

    $table = null;
    $column = null;

    switch ($item_type) {
        case 'post':
            $table = 'saved_posts';
            $column = 'post_id';
            break;
        case 'thread':
            $table = 'saved_threads';
            $column = 'thread_id';
            break;
        case 'forum':
            $table = 'saved_forums';
            $column = 'forum_id';
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid item_type']);
            exit;
    }

    $query = "SELECT 1 FROM {$table} WHERE user_id = :user_id AND {$column} = :item_id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->execute([
        ':user_id' => $user_id,
        ':item_id' => $item_id,
    ]);
    $saved = (bool)$stmt->fetchColumn();

    echo json_encode(['success' => true, 'saved' => $saved]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
