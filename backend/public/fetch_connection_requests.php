<?php
// fetch_connection_requests.php
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

$user_id = normalizeId($_GET['user_id']);

try {
    $db = getDB();
    $incomingStmt = $db->prepare("SELECT connection_id, user_id1 FROM connections WHERE user_id2 = :uid AND status = 'pending'");
    $incomingStmt->execute([':uid' => $user_id]);
    $incoming = [];
    while ($row = $incomingStmt->fetch(PDO::FETCH_ASSOC)) {
        $incoming[] = ['connection_id' => $row['connection_id'], 'user_id' => $row['user_id1']];
    }

    $outgoingStmt = $db->prepare("SELECT connection_id, user_id2 FROM connections WHERE user_id1 = :uid AND status = 'pending'");
    $outgoingStmt->execute([':uid' => $user_id]);
    $outgoing = [];
    while ($row = $outgoingStmt->fetch(PDO::FETCH_ASSOC)) {
        $outgoing[] = ['connection_id' => $row['connection_id'], 'user_id' => $row['user_id2']];
    }

    echo json_encode(['success' => true, 'incoming' => $incoming, 'outgoing' => $outgoing]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
