<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';

[$db, $userId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$uploadId = normalizeId(is_array($input) ? ($input['upload_id'] ?? '') : '');
if ($uploadId === '') {
    srp_json(['success' => false, 'error' => 'upload_id is required.'], 400);
}

$runtimeDir = '';
$lockHandle = null;
try {
    $sessionStmt = $db->prepare("
        SELECT *
        FROM reel_upload_sessions
        WHERE upload_id = :upload_id
        LIMIT 1
    ");
    $sessionStmt->execute([':upload_id' => $uploadId]);
    $upload = $sessionStmt->fetch(PDO::FETCH_ASSOC);
    if (!$upload) {
        srp_json(['success' => false, 'error' => 'Upload session not found.'], 404);
    }
    if (normalizeId($upload['user_id']) !== $userId) {
        srp_json(['success' => false, 'error' => 'You do not own this upload.'], 403);
    }
    if (!empty($upload['reel_id'])) {
        srp_json([
            'success' => true,
            'reel_id' => normalizeId($upload['reel_id']),
            'status' => in_array($upload['status'], ['complete'], true) ? 'ready' : 'processing',
        ]);
    }
    if (($upload['status'] ?? '') !== 'uploading') {
        srp_json([
            'success' => false,
            'error' => $upload['error_message'] ?: 'This upload cannot be finalized.',
            'status' => $upload['status'],
        ], 409);
    }
    if (strtotime((string)$upload['expires_at']) < time()) {
        $expire = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'expired', error_message = 'Upload expired before it was finalized.'
            WHERE upload_id = :upload_id
        ");
        $expire->execute([':upload_id' => $uploadId]);
        srp_reel_cleanup_runtime($uploadId);
        srp_json(['success' => false, 'error' => 'This upload session expired.'], 410);
    }

    $totalChunks = (int)$upload['total_chunks'];
    $fileSize = (int)$upload['file_size'];
    if (!srp_reel_has_disk_capacity($fileSize)) {
        srp_json([
            'success' => false,
            'error' => 'Video processing is temporarily unavailable because storage is low.',
        ], 507);
    }
    $chunkRowsStmt = $db->prepare("
        SELECT chunk_index, chunk_size, sha256
        FROM reel_upload_chunks
        WHERE upload_id = :upload_id
        ORDER BY chunk_index ASC
    ");
    $chunkRowsStmt->execute([':upload_id' => $uploadId]);
    $chunks = $chunkRowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (count($chunks) !== $totalChunks) {
        srp_json([
            'success' => false,
            'error' => 'Not all video chunks have been uploaded.',
            'received_chunks' => count($chunks),
            'total_chunks' => $totalChunks,
        ], 409);
    }

    $runtimeDir = srp_reel_upload_runtime_dir($uploadId);
    srp_reel_ensure_directory($runtimeDir);
    $lockHandle = fopen($runtimeDir . DIRECTORY_SEPARATOR . 'upload.lock', 'c');
    if ($lockHandle === false || !flock($lockHandle, LOCK_EX)) {
        throw new RuntimeException('Unable to lock the upload session.');
    }

    $assemblePath = $runtimeDir . DIRECTORY_SEPARATOR . 'source.assembling';
    $sourcePath = srp_reel_source_path($uploadId);
    $output = fopen($assemblePath, 'wb');
    if ($output === false) {
        throw new RuntimeException('Unable to assemble the uploaded video.');
    }
    $assembledBytes = 0;
    foreach ($chunks as $expectedIndex => $chunk) {
        if ((int)$chunk['chunk_index'] !== $expectedIndex) {
            fclose($output);
            @unlink($assemblePath);
            srp_json(['success' => false, 'error' => 'The uploaded chunks are incomplete.'], 409);
        }
        $chunkPath = srp_reel_chunk_path($uploadId, $expectedIndex);
        if (!is_file($chunkPath) || filesize($chunkPath) !== (int)$chunk['chunk_size']) {
            fclose($output);
            @unlink($assemblePath);
            srp_json(['success' => false, 'error' => 'An uploaded chunk is missing or invalid.'], 409);
        }
        if (!hash_equals((string)$chunk['sha256'], hash_file('sha256', $chunkPath))) {
            fclose($output);
            @unlink($assemblePath);
            srp_json(['success' => false, 'error' => 'An uploaded chunk failed integrity validation.'], 409);
        }
        $inputHandle = fopen($chunkPath, 'rb');
        if ($inputHandle === false) {
            throw new RuntimeException('Unable to read an uploaded chunk.');
        }
        $copied = stream_copy_to_stream($inputHandle, $output);
        fclose($inputHandle);
        if ($copied === false) {
            throw new RuntimeException('Unable to assemble the uploaded video.');
        }
        $assembledBytes += $copied;
    }
    fflush($output);
    fclose($output);

    if ($assembledBytes !== $fileSize || $assembledBytes > SRP_REEL_MAX_BYTES) {
        @unlink($assemblePath);
        srp_json(['success' => false, 'error' => 'The assembled video size did not match the upload.'], 400);
    }
    if (!rename($assemblePath, $sourcePath)) {
        @unlink($assemblePath);
        throw new RuntimeException('Unable to finalize the assembled video.');
    }

    $detectedMime = mime_content_type($sourcePath) ?: 'application/octet-stream';
    if (!srp_reel_allowed_input_mime($detectedMime)) {
        $failedStmt = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'failed', error_message = 'The upload is not a supported video file.'
            WHERE upload_id = :upload_id
        ");
        $failedStmt->execute([':upload_id' => $uploadId]);
        srp_reel_cleanup_runtime($uploadId);
        srp_json(['success' => false, 'error' => 'The upload is not a supported video file.'], 415);
    }

    $db->beginTransaction();
    $lockStmt = $db->prepare("
        SELECT status, reel_id
        FROM reel_upload_sessions
        WHERE upload_id = :upload_id
        FOR UPDATE
    ");
    $lockStmt->execute([':upload_id' => $uploadId]);
    $locked = $lockStmt->fetch(PDO::FETCH_ASSOC);
    if (!empty($locked['reel_id'])) {
        $db->commit();
        srp_json([
            'success' => true,
            'reel_id' => normalizeId($locked['reel_id']),
            'status' => 'processing',
        ]);
    }
    if (($locked['status'] ?? '') !== 'uploading') {
        $db->rollBack();
        srp_json(['success' => false, 'error' => 'This upload cannot be finalized.'], 409);
    }

    $reelId = generateUniqueId($db, 'reels');
    $reelStmt = $db->prepare("
        INSERT INTO reels (
            reel_id, creator_user_id, community_id, caption, is_intro,
            status, feed_sort_at
        ) VALUES (
            :reel_id, :creator_user_id, :community_id, :caption, :is_intro,
            'processing', NOW()
        )
    ");
    $reelStmt->execute([
        ':reel_id' => $reelId,
        ':creator_user_id' => $userId,
        ':community_id' => $upload['community_id'] ?: null,
        ':caption' => $upload['caption'] ?? '',
        ':is_intro' => (int)($upload['is_intro'] ?? 0),
    ]);
    $queueStmt = $db->prepare("
        UPDATE reel_upload_sessions
        SET reel_id = :reel_id,
            status = 'queued',
            error_message = NULL,
            completed_at = NULL
        WHERE upload_id = :upload_id
    ");
    $queueStmt->execute([
        ':reel_id' => $reelId,
        ':upload_id' => $uploadId,
    ]);
    $db->commit();

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
    srp_reel_kick_worker();
    srp_json([
        'success' => true,
        'reel_id' => $reelId,
        'status' => 'processing',
    ], 202);
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    if (isset($assemblePath)) {
        @unlink($assemblePath);
    }
    if (is_resource($lockHandle)) {
        @flock($lockHandle, LOCK_UN);
        @fclose($lockHandle);
    }
    srp_safe_error('Unable to finalize the video upload.', $e);
}
