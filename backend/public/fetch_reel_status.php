<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$reelId = normalizeId($_GET['reel_id'] ?? '');
if ($reelId === '') {
    srp_json(['success' => false, 'error' => 'reel_id is required.'], 400);
}

try {
    $stmt = $db->prepare("
        SELECT
            r.reel_id,
            r.creator_user_id,
            r.status,
            r.processing_error,
            r.community_id,
            rus.status AS upload_status,
            rus.error_message AS upload_error
        FROM reels r
        LEFT JOIN reel_upload_sessions rus ON rus.reel_id = r.reel_id
        WHERE r.reel_id = :reel_id
        LIMIT 1
    ");
    $stmt->execute([':reel_id' => $reelId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        srp_json(['success' => false, 'error' => 'Reel not found.'], 404);
    }
    if (normalizeId($row['creator_user_id']) !== $userId && !isAdmin($roleId)) {
        srp_json(['success' => false, 'error' => 'You cannot view this upload status.'], 403);
    }

    $status = (string)$row['status'];
    if (($row['upload_status'] ?? '') === 'queued') {
        srp_reel_kick_worker();
    }
    $response = [
        'success' => true,
        'reel_id' => $reelId,
        'status' => $status,
    ];
    if ($status === 'failed') {
        $response['error'] = $row['processing_error']
            ?: $row['upload_error']
            ?: 'Video processing failed.';
    } elseif ($status === 'ready') {
        $response['reel'] = srp_reel_fetch_ready($db, $reelId, $userId, true);
    }
    srp_json($response);
} catch (Throwable $e) {
    srp_safe_error('Unable to fetch Reel status.', $e);
}
