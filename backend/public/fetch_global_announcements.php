<?php
// fetch_global_announcements.php
// Return active global announcements that should show in the banner.

header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT announcement_id, title, body, announcement_type, starts_at, ends_at, created_at
        FROM announcements
        WHERE is_active = 1
          AND is_hidden = 0
          AND show_banner = 1
          AND (community_id IS NULL OR community_id = '')
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())
        ORDER BY starts_at IS NULL DESC, starts_at ASC, created_at DESC
        LIMIT 5
    ");
    $stmt->execute();
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    echo json_encode(['success' => true, 'announcements' => $announcements]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
