<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../includes/changelog.php';

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'GET is required.']);
    exit;
}

try {
    $db = getDB();
    srp_ensure_changelog_table($db);

    $mode = strtolower(trim((string)($_GET['mode'] ?? 'list')));
    $userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';

    if ($mode === 'pending') {
        // The login prompt. Signed-out visitors simply have nothing pending.
        if ($userId === '') {
            echo json_encode(['success' => true, 'entry' => null]);
            exit;
        }
        echo json_encode([
            'success' => true,
            'entry' => srp_changelog_pending_for_user($db, $userId),
        ]);
        exit;
    }

    if ($mode === 'admin') {
        // Drafts are visible only to super admins.
        if (srp_changelog_super_admin_id($db) === '') {
            http_response_code($userId === '' ? 401 : 403);
            echo json_encode(['success' => false, 'error' => 'Only super admins can view changelog drafts.']);
            exit;
        }
        $stmt = $db->query(
            'SELECT * FROM changelog_entries
             ORDER BY COALESCE(published_at, created_at) DESC, changelog_entry_id DESC
             LIMIT 200'
        );
        echo json_encode([
            'success' => true,
            'entries' => array_map(
                static fn(array $row): array => srp_changelog_present($row, true),
                $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
            ),
        ]);
        exit;
    }

    $limit = (int)($_GET['limit'] ?? 50);
    $offset = (int)($_GET['offset'] ?? 0);
    echo json_encode([
        'success' => true,
        'entries' => srp_changelog_published($db, $limit, $offset),
    ]);
} catch (Throwable $error) {
    error_log('[changelog] fetch failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'The changelog is unavailable right now.']);
}
