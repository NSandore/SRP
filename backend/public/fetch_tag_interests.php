<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$user_id = normalizeId($_GET['user_id'] ?? '');
if ($user_id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'User ID is required.']);
    exit;
}

try {
    $db = getDB();
    srp_ensure_tag_tables($db);

    $stmt = $db->prepare("
        SELECT t.slug, t.name
        FROM user_interests ui
        INNER JOIN tags t ON t.tag_id = ui.tag_id
        WHERE ui.user_id = :uid
        ORDER BY t.name
    ");
    $stmt->execute([':uid' => $user_id]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $slugs = [];
    foreach ($rows as $row) {
        $slug = $row['slug'] ?? '';
        if ($slug !== '') {
            $slugs[] = $slug;
        }
    }

    echo json_encode([
        'success' => true,
        'tags' => $slugs
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
