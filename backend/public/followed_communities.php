<?php
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

// Check if user_id is provided
if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit;
}

$user_id = (int)$_GET['user_id'];
$db = getDB();

try {
    // Fetch all followed communities with full data
    $stmt = $db->prepare("
        SELECT 
            c.id AS community_id, 
            c.name, 
            c.location, 
            c.tagline, 
            c.logo_path,
            COUNT(fc_count.user_id) AS followers_count
        FROM followed_communities fc
        JOIN communities c ON fc.community_id = c.id
        LEFT JOIN followed_communities fc_count ON c.id = fc_count.community_id
        WHERE fc.user_id = :user_id
        GROUP BY c.id, c.name, c.location, c.tagline, c.logo_path
        ORDER BY c.name ASC
    ");

    $stmt->execute([':user_id' => $user_id]);
    $followedCommunities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($followedCommunities);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
