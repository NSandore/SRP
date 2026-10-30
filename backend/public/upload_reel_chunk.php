<?php
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/reels.php';
require_once __DIR__ . '/../includes/rate_limit.php';

[$db, $userId] = srp_bootstrap(requireAuth: true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    srp_json(['success' => false, 'error' => 'Method not allowed.'], 405);
}

$uploadId = normalizeId($_GET['upload_id'] ?? '');
$chunkIndex = filter_var($_GET['chunk_index'] ?? null, FILTER_VALIDATE_INT);
if ($uploadId === '' || $chunkIndex === false || $chunkIndex < 0) {
    srp_json(['success' => false, 'error' => 'upload_id and chunk_index are required.'], 400);
}

try {
    srp_rate_limit_enforce(
        $db,
        'reel-chunk:' . $userId . ':' . srp_client_ip(),
        500,
        3600,
        'Too many upload chunks were sent. Please wait and try again.'
    );

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
    if (($upload['status'] ?? '') !== 'uploading') {
        srp_json([
            'success' => false,
            'error' => 'This upload is no longer accepting chunks.',
            'status' => $upload['status'],
        ], 409);
    }

    $totalChunks = (int)$upload['total_chunks'];
    $chunkSize = (int)$upload['chunk_size'];
    $fileSize = (int)$upload['file_size'];
    if ($chunkIndex >= $totalChunks) {
        srp_json(['success' => false, 'error' => 'Chunk index is out of range.'], 400);
    }
    $expectedBytes = min($chunkSize, $fileSize - ($chunkIndex * $chunkSize));
    if ($expectedBytes <= 0) {
        srp_json(['success' => false, 'error' => 'Chunk index is out of range.'], 400);
    }
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : null;
    if ($contentLength !== null && $contentLength !== $expectedBytes) {
        srp_json([
            'success' => false,
            'error' => "Chunk {$chunkIndex} must contain exactly {$expectedBytes} bytes.",
        ], 400);
    }

    $runtimeDir = srp_reel_upload_runtime_dir($uploadId);
    srp_reel_ensure_directory($runtimeDir);
    $lockHandle = fopen($runtimeDir . DIRECTORY_SEPARATOR . 'upload.lock', 'c');
    if ($lockHandle === false || !flock($lockHandle, LOCK_EX)) {
        throw new RuntimeException('Unable to lock the upload session.');
    }

    $temporaryPath = $runtimeDir . DIRECTORY_SEPARATOR . sprintf('chunk-%06d.writing', $chunkIndex);
    $finalPath = srp_reel_chunk_path($uploadId, $chunkIndex);
    $input = fopen('php://input', 'rb');
    $output = fopen($temporaryPath, 'wb');
    if ($input === false || $output === false) {
        throw new RuntimeException('Unable to read the upload chunk.');
    }

    $hash = hash_init('sha256');
    $written = 0;
    while (!feof($input)) {
        $buffer = fread($input, min(65536, ($expectedBytes + 1) - $written));
        if ($buffer === false) {
            throw new RuntimeException('Unable to read the upload chunk.');
        }
        if ($buffer === '') {
            break;
        }
        $written += strlen($buffer);
        if ($written > $expectedBytes) {
            break;
        }
        hash_update($hash, $buffer);
        if (fwrite($output, $buffer) !== strlen($buffer)) {
            throw new RuntimeException('Unable to store the upload chunk.');
        }
    }
    fclose($input);
    fflush($output);
    fclose($output);

    if ($written !== $expectedBytes) {
        @unlink($temporaryPath);
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        srp_json([
            'success' => false,
            'error' => "Chunk {$chunkIndex} must contain exactly {$expectedBytes} bytes.",
        ], 400);
    }
    if (!rename($temporaryPath, $finalPath)) {
        @unlink($temporaryPath);
        throw new RuntimeException('Unable to finalize the upload chunk.');
    }
    $sha256 = hash_final($hash);

    $db->beginTransaction();
    $chunkStmt = $db->prepare("
        INSERT INTO reel_upload_chunks (upload_id, chunk_index, chunk_size, sha256)
        VALUES (:upload_id, :chunk_index, :chunk_size, :sha256)
        ON DUPLICATE KEY UPDATE
            chunk_size = VALUES(chunk_size),
            sha256 = VALUES(sha256),
            received_at = CURRENT_TIMESTAMP
    ");
    $chunkStmt->execute([
        ':upload_id' => $uploadId,
        ':chunk_index' => $chunkIndex,
        ':chunk_size' => $written,
        ':sha256' => $sha256,
    ]);
    $countStmt = $db->prepare('SELECT COUNT(*) FROM reel_upload_chunks WHERE upload_id = :upload_id');
    $countStmt->execute([':upload_id' => $uploadId]);
    $receivedChunks = (int)$countStmt->fetchColumn();
    $updateStmt = $db->prepare("
        UPDATE reel_upload_sessions
        SET received_chunks = :received_chunks
        WHERE upload_id = :upload_id AND status = 'uploading'
    ");
    $updateStmt->execute([
        ':received_chunks' => $receivedChunks,
        ':upload_id' => $uploadId,
    ]);
    $db->commit();

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);

    srp_json([
        'success' => true,
        'received_chunks' => $receivedChunks,
        'total_chunks' => $totalChunks,
    ]);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    if (isset($temporaryPath)) {
        @unlink($temporaryPath);
    }
    if (isset($lockHandle) && is_resource($lockHandle)) {
        @flock($lockHandle, LOCK_UN);
        @fclose($lockHandle);
    }
    srp_safe_error('Unable to store the video chunk.', $e);
}
