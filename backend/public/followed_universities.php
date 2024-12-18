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
    // Fetch all followed universities with full data
    $stmt = $db->prepare("
        SELECT 
            u.id AS university_id, 
            u.name, 
            u.location, 
            u.tagline, 
            u.logo_path,
            COUNT(fu.user_id) AS followers_count
        FROM followed_universities fu
        JOIN universities u ON fu.university_id = u.id
        LEFT JOIN followed_universities fu_count ON u.id = fu_count.university_id
        WHERE fu.user_id = :user_id
        GROUP BY u.id, u.name, u.location, u.tagline, u.logo_path
        ORDER BY u.name ASC
    ");
    $stmt->execute([':user_id' => $user_id]);
    $followedUniversities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($followedUniversities);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
