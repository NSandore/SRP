<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/newsroom.php';

header('Content-Type: application/json');

try {
    $db = getDB();
    if (srp_newsroom_super_admin_id($db) === '') {
        http_response_code(isset($_SESSION['user_id']) ? 403 : 401);
        echo json_encode(['success' => false, 'error' => 'Only super admins can access the Newsroom.']);
        exit;
    }
    srp_ensure_newsroom_table($db);
    $rows = $db->query("
        SELECT *
        FROM newsroom_items
        ORDER BY
            CASE status
                WHEN 'incoming' THEN 1
                WHEN 'draft' THEN 2
                WHEN 'published' THEN 3
                ELSE 4
            END,
            COALESCE(source_published_at, created_at) DESC
        LIMIT 500
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'items' => array_map('srp_newsroom_row', $rows),
        'forums' => srp_newsroom_forums($db),
        'ai_available' => srp_newsroom_ai_available(),
        'official_source_url' => SRP_NEWSROOM_ED_SOURCE_URL,
    ]);
} catch (Throwable $e) {
    error_log('[SRP] Fetch newsroom failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load the Newsroom.']);
}

