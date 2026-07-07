<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    $tagMap = srp_seed_tags($db);
    $options = srp_tag_options_normalized();

    $ordered = [];
    foreach ($options as $opt) {
        $slug = $opt['slug'];
        if (isset($tagMap[$slug])) {
            $ordered[] = [
                'tag_id' => $tagMap[$slug]['tag_id'],
                'name' => $tagMap[$slug]['name'],
                'slug' => $tagMap[$slug]['slug'],
            ];
        }
    }

    echo json_encode(['success' => true, 'tags' => $ordered]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
