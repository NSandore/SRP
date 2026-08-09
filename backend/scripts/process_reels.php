<?php
/**
 * Asynchronous Reel transcoder.
 *
 * Usage:
 *   php backend/scripts/process_reels.php --once
 *   php backend/scripts/process_reels.php --loop
 *
 * Finalize requests also start a best-effort --once process. The global flock
 * below ensures only one transcoder can consume CPU on this host at a time.
 */

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/reels.php';

$loop = in_array('--loop', $argv, true);

function reel_worker_log(string $message): void
{
    fwrite(STDOUT, '[' . date('c') . '] ' . $message . PHP_EOL);
}

function reel_worker_remove_public_output(string $reelId): void
{
    if (!preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $reelId)) {
        return;
    }
    $dir = srp_reel_public_root() . DIRECTORY_SEPARATOR . $reelId;
    $root = rtrim(srp_reel_public_root(), DIRECTORY_SEPARATOR);
    if (!str_starts_with($dir, $root . DIRECTORY_SEPARATOR) || !is_dir($dir)) {
        return;
    }
    foreach (scandir($dir) ?: [] as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_file($path) || is_link($path)) {
            @unlink($path);
        }
    }
    @rmdir($dir);
}

function reel_worker_fail(PDO $db, array $job, string $publicError, ?Throwable $error = null): void
{
    $reelId = normalizeId($job['reel_id'] ?? '');
    $uploadId = normalizeId($job['upload_id'] ?? '');
    if ($error) {
        error_log('[SRP reels] ' . $reelId . ': ' . $error->getMessage());
    }
    try {
        $db->beginTransaction();
        $reelStmt = $db->prepare("
            UPDATE reels
            SET status = 'failed',
                processing_error = :error,
                video_path = NULL,
                thumbnail_path = NULL
            WHERE reel_id = :reel_id
        ");
        $reelStmt->execute([
            ':error' => mb_substr($publicError, 0, 500, 'UTF-8'),
            ':reel_id' => $reelId,
        ]);
        $uploadStmt = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'failed',
                error_message = :error,
                completed_at = NOW()
            WHERE upload_id = :upload_id
        ");
        $uploadStmt->execute([
            ':error' => mb_substr($publicError, 0, 500, 'UTF-8'),
            ':upload_id' => $uploadId,
        ]);
        $db->commit();
    } catch (Throwable $updateError) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[SRP reels] unable to record processing failure: ' . $updateError->getMessage());
    }
    reel_worker_remove_public_output($reelId);
    if ($uploadId !== '') {
        srp_reel_cleanup_runtime($uploadId);
    }
}

function reel_worker_claim(PDO $db): ?array
{
    $db->beginTransaction();
    try {
        $stmt = $db->query("
            SELECT
                rus.upload_id,
                rus.user_id,
                rus.reel_id,
                rus.file_size AS source_file_size,
                rus.is_intro AS requested_intro,
                r.creator_user_id
            FROM reel_upload_sessions rus
            JOIN reels r ON r.reel_id = rus.reel_id
            WHERE rus.status = 'queued'
              AND r.status = 'processing'
              AND r.deleted_at IS NULL
            ORDER BY rus.created_at ASC, rus.upload_id ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        ");
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$job) {
            $db->commit();
            return null;
        }
        $claim = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'processing', error_message = NULL
            WHERE upload_id = :upload_id AND status = 'queued'
        ");
        $claim->execute([':upload_id' => $job['upload_id']]);
        if ($claim->rowCount() !== 1) {
            $db->rollBack();
            return null;
        }
        $db->commit();
        return $job;
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

function reel_worker_process(PDO $db, array $job, string $ffmpeg, string $ffprobe): void
{
    $uploadId = normalizeId($job['upload_id']);
    $reelId = normalizeId($job['reel_id']);
    $creatorId = normalizeId($job['creator_user_id']);
    $sourcePath = srp_reel_source_path($uploadId);

    if (!is_file($sourcePath) || !is_readable($sourcePath)) {
        reel_worker_fail($db, $job, 'The uploaded video source could not be found.');
        return;
    }
    $sourceBytes = filesize($sourcePath);
    if ($sourceBytes === false || $sourceBytes <= 0 || $sourceBytes > SRP_REEL_MAX_BYTES) {
        reel_worker_fail($db, $job, 'Videos must be 100 MB or smaller.');
        return;
    }
    if (!srp_reel_has_disk_capacity((int)$sourceBytes)) {
        // Low storage is transient: put the job back so it can be retried after
        // an operator frees space, without discarding the valid private source.
        $retry = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'queued',
                error_message = 'Waiting for sufficient storage.'
            WHERE upload_id = :upload_id AND status = 'processing'
        ");
        $retry->execute([':upload_id' => $uploadId]);
        reel_worker_log("Deferred {$reelId}: insufficient storage.");
        return;
    }

    try {
        $sourceMetadata = srp_reel_probe($ffprobe, $sourcePath);
        $sourceSummary = srp_reel_probe_summary($sourceMetadata);
        if ($sourceSummary['duration_ms'] > SRP_REEL_MAX_DURATION_MS) {
            reel_worker_fail($db, $job, 'Videos must be 60 seconds or less.');
            return;
        }
        $sourcePixels = $sourceSummary['width'] * $sourceSummary['height'];
        if (
            $sourceSummary['width'] > SRP_REEL_MAX_SOURCE_DIMENSION
            || $sourceSummary['height'] > SRP_REEL_MAX_SOURCE_DIMENSION
            || $sourcePixels > SRP_REEL_MAX_SOURCE_PIXELS
        ) {
            reel_worker_fail($db, $job, 'The video resolution is too large to process safely.');
            return;
        }
    } catch (Throwable $e) {
        reel_worker_fail($db, $job, 'The upload is not a valid video file.', $e);
        return;
    }

    $publicRoot = srp_reel_public_root();
    $outputDir = $publicRoot . DIRECTORY_SEPARATOR . $reelId;
    try {
        srp_reel_ensure_directory($publicRoot);
        srp_reel_ensure_directory($outputDir);
    } catch (Throwable $e) {
        reel_worker_fail($db, $job, 'Video storage is unavailable.', $e);
        return;
    }

    $videoTemp = $outputDir . DIRECTORY_SEPARATOR . 'video.processing.mp4';
    $videoFinal = $outputDir . DIRECTORY_SEPARATOR . 'video.mp4';
    $thumbTemp = $outputDir . DIRECTORY_SEPARATOR . 'thumbnail.processing.jpg';
    $thumbFinal = $outputDir . DIRECTORY_SEPARATOR . 'thumbnail.jpg';
    @unlink($videoTemp);
    @unlink($thumbTemp);

    $crf = (int)(getenv('REEL_FFMPEG_CRF') ?: 23);
    $crf = max(18, min(28, $crf));
    $scaleFilter = "scale='if(gt(a,1),min(1920,iw),min(1080,iw))':'if(gt(a,1),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2";
    $encode = srp_reel_run_process([
        $ffmpeg,
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', $sourcePath,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-vf', $scaleFilter,
        '-fpsmax', '60',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', (string)$crf,
        '-maxrate', '8M',
        '-bufsize', '16M',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-movflags', '+faststart',
        '-map_metadata', '-1',
        '-f', 'mp4',
        $videoTemp,
    ], 900, true);

    if ($encode['exit_code'] !== 0 || !is_file($videoTemp) || filesize($videoTemp) <= 0) {
        $detail = trim($encode['stderr']);
        reel_worker_fail(
            $db,
            $job,
            $encode['timed_out'] ? 'Video processing timed out.' : 'Video processing failed.',
            new RuntimeException($detail !== '' ? $detail : 'ffmpeg exited with ' . $encode['exit_code'])
        );
        return;
    }

    $seekSeconds = min(1.0, max(0.0, ($sourceSummary['duration_ms'] / 1000) / 2));
    $thumbnail = srp_reel_run_process([
        $ffmpeg,
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-ss', number_format($seekSeconds, 3, '.', ''),
        '-i', $videoTemp,
        '-frames:v', '1',
        '-vf', "scale='min(720,iw)':-2",
        '-q:v', '3',
        $thumbTemp,
    ], 120, true);
    if ($thumbnail['exit_code'] !== 0 || !is_file($thumbTemp) || filesize($thumbTemp) <= 0) {
        reel_worker_fail(
            $db,
            $job,
            'Video thumbnail generation failed.',
            new RuntimeException(trim($thumbnail['stderr']) ?: 'thumbnail process failed')
        );
        return;
    }

    try {
        $outputMetadata = srp_reel_probe($ffprobe, $videoTemp);
        $outputSummary = srp_reel_probe_summary($outputMetadata);
    } catch (Throwable $e) {
        reel_worker_fail($db, $job, 'The processed video could not be validated.', $e);
        return;
    }
    if ($outputSummary['duration_ms'] > SRP_REEL_MAX_DURATION_MS + 250) {
        reel_worker_fail($db, $job, 'The processed video exceeds 60 seconds.');
        return;
    }

    $cancelCheck = $db->prepare("
        SELECT r.deleted_at, rus.status AS upload_status
        FROM reels r
        JOIN reel_upload_sessions rus ON rus.reel_id = r.reel_id
        WHERE r.reel_id = :reel_id
        LIMIT 1
    ");
    $cancelCheck->execute([':reel_id' => $reelId]);
    $currentState = $cancelCheck->fetch(PDO::FETCH_ASSOC);
    if (
        !$currentState
        || $currentState['deleted_at'] !== null
        || ($currentState['upload_status'] ?? '') === 'cancelled'
    ) {
        reel_worker_remove_public_output($reelId);
        srp_reel_cleanup_runtime($uploadId);
        reel_worker_log("Discarded {$reelId}: upload was cancelled or deleted.");
        return;
    }

    if (!rename($videoTemp, $videoFinal) || !rename($thumbTemp, $thumbFinal)) {
        reel_worker_fail($db, $job, 'Unable to publish the processed video.');
        return;
    }
    @chmod($videoFinal, 0644);
    @chmod($thumbFinal, 0644);
    $outputBytes = filesize($videoFinal);
    if ($outputBytes === false || $outputBytes <= 0) {
        reel_worker_fail($db, $job, 'Unable to publish the processed video.');
        return;
    }

    $videoPath = '/uploads/reels/' . $reelId . '/video.mp4';
    $thumbnailPath = '/uploads/reels/' . $reelId . '/thumbnail.jpg';

    try {
        $db->beginTransaction();
        $ready = $db->prepare("
            UPDATE reels
            SET video_path = :video_path,
                thumbnail_path = :thumbnail_path,
                duration_ms = :duration_ms,
                width = :width,
                height = :height,
                file_size = :file_size,
                status = 'ready',
                processing_error = NULL
            WHERE reel_id = :reel_id
              AND creator_user_id = :creator_user_id
              AND deleted_at IS NULL
        ");
        $ready->execute([
            ':video_path' => $videoPath,
            ':thumbnail_path' => $thumbnailPath,
            ':duration_ms' => min($outputSummary['duration_ms'], SRP_REEL_MAX_DURATION_MS),
            ':width' => $outputSummary['width'],
            ':height' => $outputSummary['height'],
            ':file_size' => $outputBytes,
            ':reel_id' => $reelId,
            ':creator_user_id' => $creatorId,
        ]);
        if ($ready->rowCount() !== 1) {
            throw new RuntimeException('The Reel was removed before processing completed.');
        }

        if ((int)($job['requested_intro'] ?? 0) === 1) {
            $clearPrevious = $db->prepare("
                UPDATE reels
                SET is_intro = 0
                WHERE creator_user_id = :user_id
                  AND reel_id <> :reel_id
            ");
            $clearPrevious->execute([
                ':user_id' => $creatorId,
                ':reel_id' => $reelId,
            ]);
            $intro = $db->prepare("
                INSERT INTO user_intro_reels (user_id, reel_id)
                VALUES (:user_id, :reel_id)
                ON DUPLICATE KEY UPDATE reel_id = VALUES(reel_id), updated_at = NOW()
            ");
            $intro->execute([
                ':user_id' => $creatorId,
                ':reel_id' => $reelId,
            ]);
        }

        $complete = $db->prepare("
            UPDATE reel_upload_sessions
            SET status = 'complete',
                error_message = NULL,
                completed_at = NOW()
            WHERE upload_id = :upload_id
        ");
        $complete->execute([':upload_id' => $uploadId]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        reel_worker_fail($db, $job, 'Unable to publish the processed video.', $e);
        return;
    }

    srp_reel_cleanup_runtime($uploadId);
    reel_worker_log("Published {$reelId} ({$outputSummary['width']}x{$outputSummary['height']}, {$outputBytes} bytes).");
}

try {
    $db = getDB();
    srp_reel_ensure_directory(srp_reel_runtime_root());
    $workerLock = fopen(srp_reel_runtime_root() . DIRECTORY_SEPARATOR . 'worker.lock', 'c');
    if ($workerLock === false || !flock($workerLock, LOCK_EX | LOCK_NB)) {
        reel_worker_log('Another Reel worker is already running.');
        exit(0);
    }

    $ffmpeg = srp_reel_find_binary('ffmpeg');
    $ffprobe = srp_reel_find_binary('ffprobe');
    if ($ffmpeg === null || $ffprobe === null) {
        reel_worker_log('ffmpeg and ffprobe are required. Configure FFMPEG_PATH/FFPROBE_PATH or install the binaries.');
        exit(1);
    }
    reel_worker_log("Using ffmpeg={$ffmpeg}; ffprobe={$ffprobe}");

    // A killed worker may leave one claim behind. After 30 minutes it is safe
    // to return that job to the serialized queue.
    $db->exec("
        UPDATE reel_upload_sessions
        SET status = 'queued',
            error_message = 'Retrying interrupted processing.'
        WHERE status = 'processing'
          AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    ");

    while (true) {
        srp_reel_sweep_expired($db, 50);
        $job = reel_worker_claim($db);
        if ($job) {
            reel_worker_process($db, $job, $ffmpeg, $ffprobe);
            $postJob = $db->prepare('SELECT status FROM reel_upload_sessions WHERE upload_id = :upload_id');
            $postJob->execute([':upload_id' => $job['upload_id']]);
            if ($postJob->fetchColumn() === 'queued') {
                // A transient capacity condition deliberately requeued this
                // exact job. Stop this pass to avoid a tight claim/requeue loop.
                break;
            }
            continue;
        }
        if ($loop) {
            sleep(2);
            continue;
        }
        break;
    }

    flock($workerLock, LOCK_UN);
    fclose($workerLock);
    exit(0);
} catch (Throwable $e) {
    error_log('[SRP reels worker] ' . $e->getMessage());
    fwrite(STDERR, 'Reel worker error: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
