<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/rate_limit.php';
require_once __DIR__ . '/../includes/permissions.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    srp_json(['success' => false, 'error' => 'Invalid JSON body.'], 400);
}

$fileName = basename(trim((string)($input['file_name'] ?? 'video')));
$mimeType = strtolower(trim((string)($input['mime_type'] ?? 'application/octet-stream')));
$fileSize = filter_var($input['file_size'] ?? null, FILTER_VALIDATE_INT);
$rawCaption = srp_sanitize_plain((string)($input['caption'] ?? ''));
$caption = srp_reel_caption($rawCaption);
$communityId = normalizeId($input['community_id'] ?? '');
$isIntro = filter_var($input['is_intro'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

if ($fileName === '' || $fileSize === false || $fileSize <= 0) {
    srp_json(['success' => false, 'error' => 'A valid file name and file size are required.'], 400);
}
if ($fileSize > SRP_REEL_MAX_BYTES) {
    srp_json(['success' => false, 'error' => 'Videos must be 100 MB or smaller.'], 413);
}
if (!srp_reel_allowed_input_mime($mimeType)) {
    srp_json(['success' => false, 'error' => 'Unsupported video type. Upload MP4, MOV, or WebM video.'], 415);
}
if (mb_strlen($rawCaption, 'UTF-8') > SRP_REEL_CAPTION_MAX_LENGTH) {
    srp_json(['success' => false, 'error' => 'Captions must be 500 characters or fewer.'], 400);
}

try {
    srp_rate_limit_enforce(
        $db,
        'reel-init:' . $userId . ':' . srp_client_ip(),
        10,
        3600,
        'Too many video uploads were started. Please wait before trying again.'
    );
    srp_reel_sweep_expired($db);

    if (!hasVerifiedEmail($userId, $db)) {
        srp_json(['success' => false, 'error' => 'Verify your email before uploading a Reel.'], 403);
    }
    if (!srp_reel_has_disk_capacity((int)$fileSize)) {
        srp_json([
            'success' => false,
            'error' => 'Video uploads are temporarily unavailable because storage is low.',
        ], 507);
    }

    if ($communityId !== '') {
        $communityStmt = $db->prepare('SELECT 1 FROM communities WHERE id = :id LIMIT 1');
        $communityStmt->execute([':id' => $communityId]);
        if (!$communityStmt->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'Community not found.'], 404);
        }

        $memberStmt = $db->prepare("
            SELECT 1
            FROM users u
            WHERE u.user_id = :user_id
              AND (
                  u.recent_university_id = :recent_community_id
                  OR EXISTS (
                      SELECT 1
                      FROM followed_communities fc
                      WHERE fc.user_id = :follow_user_id
                        AND fc.community_id = :follow_community_id
                  )
              )
            LIMIT 1
        ");
        $memberStmt->execute([
            ':user_id' => $userId,
            ':recent_community_id' => $communityId,
            ':follow_user_id' => $userId,
            ':follow_community_id' => $communityId,
        ]);
        $isMember = (bool)$memberStmt->fetchColumn();
        $canManage = isAdmin($roleId)
            || canModerateCommunityContent($userId, $roleId, $communityId, $db);
        if (!$isMember && !$canManage) {
            srp_json([
                'success' => false,
                'error' => 'Follow or join this community before posting a Reel to it.',
            ], 403);
        }
    }

    // Bound incomplete uploads per account so abandoned chunks cannot consume
    // unbounded local disk between expiry sweeps.
    $activeStmt = $db->prepare("
        SELECT COUNT(*)
        FROM reel_upload_sessions
        WHERE user_id = :uid
          AND status IN ('uploading', 'assembling', 'queued', 'processing')
    ");
    $activeStmt->execute([':uid' => $userId]);
    if ((int)$activeStmt->fetchColumn() >= 3) {
        srp_json([
            'success' => false,
            'error' => 'You already have several active uploads. Finish or wait for them before starting another.',
        ], 409);
    }

    $uploadId = generateUniqueId($db, 'reel_upload_sessions');
    $chunkSize = SRP_REEL_CHUNK_BYTES;
    $totalChunks = (int)ceil($fileSize / $chunkSize);
    $runtimeDir = srp_reel_upload_runtime_dir($uploadId);
    srp_reel_ensure_directory($runtimeDir);

    $stmt = $db->prepare("
        INSERT INTO reel_upload_sessions (
            upload_id, user_id, file_name, expected_mime_type, file_size,
            chunk_size, total_chunks, caption, community_id, is_intro,
            status, expires_at
        ) VALUES (
            :upload_id, :user_id, :file_name, :mime_type, :file_size,
            :chunk_size, :total_chunks, :caption, :community_id, :is_intro,
            'uploading', DATE_ADD(NOW(), INTERVAL 24 HOUR)
        )
    ");
    $stmt->execute([
        ':upload_id' => $uploadId,
        ':user_id' => $userId,
        ':file_name' => mb_substr($fileName, 0, 255, 'UTF-8'),
        ':mime_type' => mb_substr($mimeType, 0, 100, 'UTF-8'),
        ':file_size' => $fileSize,
        ':chunk_size' => $chunkSize,
        ':total_chunks' => $totalChunks,
        ':caption' => $caption,
        ':community_id' => $communityId !== '' ? $communityId : null,
        ':is_intro' => $isIntro,
    ]);

    srp_json([
        'success' => true,
        'upload_id' => $uploadId,
        'chunk_size' => $chunkSize,
        'total_chunks' => $totalChunks,
    ]);
} catch (Throwable $e) {
    if (isset($uploadId)) {
        srp_reel_cleanup_runtime($uploadId);
    }
    srp_safe_error('Unable to start the video upload.', $e);
}
