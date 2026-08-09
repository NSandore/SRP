<?php
/**
 * Shared helpers for short-form Reels.
 *
 * Unvalidated upload chunks and assembled sources deliberately live under
 * backend/runtime, outside the public uploads tree. Only transcoded MP4/JPEG
 * outputs are written beneath uploads/reels.
 */

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/sanitize.php';

const SRP_REEL_MAX_BYTES = 104857600; // 100 MiB
const SRP_REEL_CHUNK_BYTES = 1048576; // 1 MiB (below PHP's current 2 MiB limit)
const SRP_REEL_MAX_DURATION_MS = 60000;
const SRP_REEL_MAX_SOURCE_DIMENSION = 8192;
const SRP_REEL_MAX_SOURCE_PIXELS = 35000000;
const SRP_REEL_CAPTION_MAX_LENGTH = 500;
const SRP_REEL_COMMENT_MAX_LENGTH = 2000;
const SRP_REEL_UPLOAD_TTL_HOURS = 24;
const SRP_REEL_DISK_RESERVE_BYTES = 536870912; // 512 MiB

function srp_reel_runtime_root(): string
{
    $configured = trim((string)(getenv('REEL_RUNTIME_DIR') ?: ''));
    return rtrim($configured !== '' ? $configured : (__DIR__ . '/../runtime/reel_uploads'), DIRECTORY_SEPARATOR);
}

function srp_reel_public_root(): string
{
    $configured = trim((string)(getenv('REEL_STORAGE_DIR') ?: ''));
    return rtrim($configured !== '' ? $configured : (__DIR__ . '/../../uploads/reels'), DIRECTORY_SEPARATOR);
}

function srp_reel_safe_runtime_id(string $uploadId): string
{
    $uploadId = normalizeId($uploadId);
    if ($uploadId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $uploadId)) {
        throw new InvalidArgumentException('Invalid upload id.');
    }
    return $uploadId;
}

function srp_reel_ensure_directory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
        throw new RuntimeException('Unable to create the reel storage directory.');
    }
    if (!is_writable($path)) {
        throw new RuntimeException('The reel storage directory is not writable.');
    }
}

function srp_reel_has_disk_capacity(int $sourceBytes): bool
{
    $sourceBytes = max(0, $sourceBytes);
    // During processing the private source, temporary encoded MP4 and final
    // MP4 can briefly coexist. Keep a fixed reserve for the rest of the app.
    $required = ($sourceBytes * 2) + SRP_REEL_DISK_RESERVE_BYTES;
    foreach ([srp_reel_runtime_root(), srp_reel_public_root()] as $root) {
        $probe = $root;
        while (!file_exists($probe) && dirname($probe) !== $probe) {
            $probe = dirname($probe);
        }
        $free = @disk_free_space($probe);
        if ($free !== false && $free < $required) {
            return false;
        }
    }
    return true;
}

function srp_reel_upload_runtime_dir(string $uploadId): string
{
    return srp_reel_runtime_root() . DIRECTORY_SEPARATOR . srp_reel_safe_runtime_id($uploadId);
}

function srp_reel_chunk_path(string $uploadId, int $chunkIndex): string
{
    if ($chunkIndex < 0 || $chunkIndex > 10000) {
        throw new InvalidArgumentException('Invalid chunk index.');
    }
    return srp_reel_upload_runtime_dir($uploadId) . DIRECTORY_SEPARATOR . sprintf('chunk-%06d.part', $chunkIndex);
}

function srp_reel_source_path(string $uploadId): string
{
    return srp_reel_upload_runtime_dir($uploadId) . DIRECTORY_SEPARATOR . 'source.upload';
}

function srp_reel_remove_tree(string $path): void
{
    $runtimeRoot = rtrim(srp_reel_runtime_root(), DIRECTORY_SEPARATOR);
    if ($path === '' || $path === $runtimeRoot || !str_starts_with($path, $runtimeRoot . DIRECTORY_SEPARATOR)) {
        return;
    }
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    if (!is_dir($path)) {
        return;
    }
    $items = scandir($path);
    if ($items === false) {
        return;
    }
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        srp_reel_remove_tree($path . DIRECTORY_SEPARATOR . $item);
    }
    @rmdir($path);
}

function srp_reel_cleanup_runtime(string $uploadId): void
{
    try {
        srp_reel_remove_tree(srp_reel_upload_runtime_dir($uploadId));
    } catch (Throwable $e) {
        error_log('[SRP reels] runtime cleanup failed: ' . $e->getMessage());
    }
}

function srp_reel_cleanup_public(string $reelId): void
{
    $reelId = normalizeId($reelId);
    if ($reelId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $reelId)) {
        return;
    }
    $root = rtrim(srp_reel_public_root(), DIRECTORY_SEPARATOR);
    $dir = $root . DIRECTORY_SEPARATOR . $reelId;
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

/**
 * Mark abandoned upload sessions expired and remove their private chunks.
 * A small bounded sweep keeps request latency predictable.
 */
function srp_reel_sweep_expired(PDO $db, int $limit = 20): int
{
    $limit = max(1, min(100, $limit));
    $stmt = $db->prepare("
        SELECT upload_id
        FROM reel_upload_sessions
        WHERE status IN ('uploading', 'assembling')
          AND expires_at < NOW()
        ORDER BY expires_at ASC
        LIMIT :lim
    ");
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    if (!$ids) {
        return 0;
    }

    $mark = $db->prepare("
        UPDATE reel_upload_sessions
        SET status = 'expired', error_message = 'Upload expired before it was finalized.'
        WHERE upload_id = :upload_id
          AND status IN ('uploading', 'assembling')
    ");
    foreach ($ids as $uploadId) {
        $mark->execute([':upload_id' => $uploadId]);
        if ($mark->rowCount() > 0) {
            srp_reel_cleanup_runtime((string)$uploadId);
        }
    }
    return count($ids);
}

function srp_reel_caption($value): string
{
    $caption = srp_sanitize_plain((string)$value, SRP_REEL_CAPTION_MAX_LENGTH);
    if (mb_strlen($caption, 'UTF-8') > SRP_REEL_CAPTION_MAX_LENGTH) {
        $caption = mb_substr($caption, 0, SRP_REEL_CAPTION_MAX_LENGTH, 'UTF-8');
    }
    return $caption;
}

function srp_reel_comment_body($value): string
{
    $body = srp_sanitize_plain((string)$value, SRP_REEL_COMMENT_MAX_LENGTH);
    if (mb_strlen($body, 'UTF-8') > SRP_REEL_COMMENT_MAX_LENGTH) {
        $body = mb_substr($body, 0, SRP_REEL_COMMENT_MAX_LENGTH, 'UTF-8');
    }
    return trim($body);
}

function srp_reel_allowed_input_mime(string $mime): bool
{
    return in_array(strtolower(trim($mime)), [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/mpeg',
        'video/3gpp',
        'application/octet-stream',
    ], true);
}

function srp_reel_encode_cursor(array $payload): string
{
    return rtrim(strtr(base64_encode(json_encode($payload, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
}

function srp_reel_decode_cursor(?string $cursor): ?array
{
    $cursor = trim((string)$cursor);
    if ($cursor === '') {
        return null;
    }
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $cursor)) {
        throw new InvalidArgumentException('Invalid cursor.');
    }
    $padding = strlen($cursor) % 4;
    if ($padding !== 0) {
        $cursor .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
    $value = $decoded === false ? null : json_decode($decoded, true);
    if (!is_array($value)) {
        throw new InvalidArgumentException('Invalid cursor.');
    }
    return $value;
}

function srp_reel_visibility_sql(string $viewerId, array &$params): string
{
    if ($viewerId !== '') {
        $params[':visibility_owner_viewer'] = $viewerId;
        $params[':visibility_follow_viewer'] = $viewerId;
        return "(
            r.creator_user_id = :visibility_owner_viewer
            OR (
                COALESCE(u.is_public, 1) = 1
                AND COALESCE(ast.profile_visibility, 'network') = 'network'
            )
            OR (
                COALESCE(ast.profile_visibility, 'network') = 'followers'
                AND EXISTS (
                    SELECT 1
                    FROM user_follows uf
                    WHERE uf.follower_id = :visibility_follow_viewer
                      AND uf.followed_user_id = r.creator_user_id
                )
            )
        )";
    }

    return "(
        COALESCE(u.is_public, 1) = 1
        AND COALESCE(ast.profile_visibility, 'network') = 'network'
    )";
}

function srp_reel_normalize_row(array $row): array
{
    foreach ([
        'duration_ms', 'width', 'height', 'file_size', 'like_count',
        'comment_count', 'save_count',
    ] as $field) {
        $row[$field] = isset($row[$field]) ? (int)$row[$field] : 0;
    }
    foreach (['liked', 'saved', 'is_intro', 'is_featured'] as $field) {
        $row[$field] = !empty($row[$field]);
    }
    $row['avatar_path'] = appendAvatarPath($row['avatar_path'] ?? null);

    $pins = $row['pinned_community_ids'] ?? [];
    if (is_string($pins)) {
        $decoded = json_decode($pins, true);
        $pins = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($pins)) {
        $pins = [];
    }
    $row['pinned_community_ids'] = array_values(array_map('strval', $pins));
    unset($row['feed_sort_at'], $row['cursor_time'], $row['scope_pinned']);
    return $row;
}

/**
 * Fetch one ready/visible reel in the same response shape as fetch_reels.php.
 */
function srp_reel_fetch_ready(PDO $db, string $reelId, string $viewerId = '', bool $allowOwnerHidden = false): ?array
{
    $params = [':reel_id' => $reelId];
    $visibility = srp_reel_visibility_sql($viewerId, $params);
    $ownerOverride = '';
    if ($allowOwnerHidden && $viewerId !== '') {
        $ownerOverride = ' OR r.creator_user_id = :hidden_owner_viewer';
        $params[':hidden_owner_viewer'] = $viewerId;
    }

    $sql = "
        SELECT
            r.reel_id,
            r.creator_user_id,
            u.first_name,
            u.last_name,
            u.avatar_path,
            r.caption,
            r.video_path,
            r.thumbnail_path,
            r.duration_ms,
            r.width,
            r.height,
            r.file_size,
            r.community_id,
            c.name AS community_name,
            c.community_type,
            r.created_at,
            r.like_count,
            r.comment_count,
            r.save_count,
            EXISTS(
                SELECT 1 FROM reel_likes rl
                WHERE rl.reel_id = r.reel_id AND rl.user_id = :liked_viewer
            ) AS liked,
            EXISTS(
                SELECT 1 FROM reel_saves rs
                WHERE rs.reel_id = r.reel_id AND rs.user_id = :saved_viewer
            ) AS saved,
            r.is_intro,
            r.is_featured,
            COALESCE((
                SELECT JSON_ARRAYAGG(rcp.community_id)
                FROM reel_community_pins rcp
                WHERE rcp.reel_id = r.reel_id
            ), JSON_ARRAY()) AS pinned_community_ids
        FROM reels r
        JOIN users u ON u.user_id = r.creator_user_id
        LEFT JOIN account_settings ast ON ast.user_id = u.user_id
        LEFT JOIN communities c ON c.id = r.community_id
        WHERE r.reel_id = :reel_id
          AND r.status = 'ready'
          AND r.deleted_at IS NULL
          AND (r.is_hidden = 0 {$ownerOverride})
          AND ({$visibility})
        LIMIT 1
    ";
    $params[':liked_viewer'] = $viewerId !== '' ? $viewerId : '__guest__';
    $params[':saved_viewer'] = $viewerId !== '' ? $viewerId : '__guest__';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? srp_reel_normalize_row($row) : null;
}

function srp_reel_find_binary(string $kind): ?string
{
    $isFfmpeg = $kind === 'ffmpeg';
    $envName = $isFfmpeg ? 'FFMPEG_PATH' : 'FFPROBE_PATH';
    $configured = trim((string)(getenv($envName) ?: ''));
    if ($configured !== '' && is_file($configured) && is_executable($configured)) {
        return $configured;
    }

    $repoRoot = dirname(__DIR__, 2);
    $candidates = $isFfmpeg
        ? [
            $repoRoot . '/node_modules/ffmpeg-static/ffmpeg',
            $repoRoot . '/node_modules/@ffmpeg-installer/ffmpeg/ffmpeg',
        ]
        : [
            $repoRoot . '/node_modules/@ffprobe-installer/ffprobe/ffprobe',
        ];

    $platformGlobs = $isFfmpeg
        ? [
            $repoRoot . '/node_modules/@ffmpeg-installer/*/ffmpeg',
            $repoRoot . '/node_modules/ffmpeg-static-electron/bin/*/*/ffmpeg',
        ]
        : [
            $repoRoot . '/node_modules/@ffprobe-installer/*/ffprobe',
        ];
    foreach ($platformGlobs as $pattern) {
        foreach (glob($pattern) ?: [] as $candidate) {
            $candidates[] = $candidate;
        }
    }
    foreach ($candidates as $candidate) {
        if (is_file($candidate) && is_executable($candidate)) {
            return $candidate;
        }
    }

    $found = [];
    $exitCode = 1;
    @exec('command -v ' . escapeshellarg($kind) . ' 2>/dev/null', $found, $exitCode);
    if ($exitCode === 0 && !empty($found[0])) {
        $path = trim((string)$found[0]);
        if (is_file($path) && is_executable($path)) {
            return $path;
        }
    }
    return null;
}

/**
 * Best-effort one-shot worker kick. A global flock in process_reels.php keeps
 * concurrent finalizations from running multiple transcodes at once.
 */
function srp_reel_kick_worker(): void
{
    $disabled = filter_var(getenv('REEL_DISABLE_WORKER_KICK') ?: false, FILTER_VALIDATE_BOOLEAN);
    if ($disabled) {
        return;
    }
    $runtimeRoot = srp_reel_runtime_root();
    try {
        srp_reel_ensure_directory($runtimeRoot);
    } catch (Throwable $e) {
        error_log('[SRP reels] unable to prepare worker runtime: ' . $e->getMessage());
        return;
    }
    $script = __DIR__ . '/../scripts/process_reels.php';
    if (!is_file($script)) {
        return;
    }
    $logPath = $runtimeRoot . DIRECTORY_SEPARATOR . 'worker.log';
    $command = 'nohup '
        . escapeshellarg(PHP_BINARY) . ' '
        . escapeshellarg($script) . ' --once >> '
        . escapeshellarg($logPath) . ' 2>&1 < /dev/null &';
    @exec($command);
}

/**
 * Execute a process without a shell. Returns exit code/stdout/stderr.
 *
 * @return array{exit_code:int,stdout:string,stderr:string,timed_out:bool}
 */
function srp_reel_run_process(array $command, int $timeoutSeconds = 900, bool $lowPriority = false): array
{
    if ($lowPriority) {
        $nice = trim((string)@shell_exec('command -v nice 2>/dev/null'));
        if ($nice !== '' && is_executable($nice)) {
            $command = array_merge([$nice, '-n', '10'], $command);
        }
    }

    $pipes = [];
    $process = proc_open(
        $command,
        [
            0 => ['file', '/dev/null', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ],
        $pipes,
        null,
        null,
        ['bypass_shell' => true]
    );
    if (!is_resource($process)) {
        return [
            'exit_code' => 1,
            'stdout' => '',
            'stderr' => 'Unable to start media process.',
            'timed_out' => false,
        ];
    }

    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $stdout = '';
    $stderr = '';
    $deadline = microtime(true) + max(1, $timeoutSeconds);
    $timedOut = false;
    $lastExitCode = -1;

    while (true) {
        $stdout .= (string)stream_get_contents($pipes[1]);
        $stderr .= (string)stream_get_contents($pipes[2]);
        $status = proc_get_status($process);
        if (!$status['running']) {
            $lastExitCode = (int)($status['exitcode'] ?? -1);
            break;
        }
        if (microtime(true) >= $deadline) {
            $timedOut = true;
            proc_terminate($process, 15);
            usleep(250000);
            $status = proc_get_status($process);
            if ($status['running']) {
                proc_terminate($process, 9);
            }
            break;
        }
        usleep(100000);
    }

    $stdout .= (string)stream_get_contents($pipes[1]);
    $stderr .= (string)stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $closeCode = proc_close($process);
    $exitCode = $lastExitCode >= 0 ? $lastExitCode : $closeCode;
    if ($timedOut) {
        $exitCode = 124;
    }

    return [
        'exit_code' => (int)$exitCode,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'timed_out' => $timedOut,
    ];
}

function srp_reel_probe(string $ffprobe, string $path): array
{
    $result = srp_reel_run_process([
        $ffprobe,
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        $path,
    ], 60);
    if ($result['exit_code'] !== 0) {
        throw new RuntimeException('Unable to read video metadata.');
    }
    $metadata = json_decode($result['stdout'], true);
    if (!is_array($metadata)) {
        throw new RuntimeException('Unable to read video metadata.');
    }
    return $metadata;
}

/**
 * @return array{duration_ms:int,width:int,height:int}
 */
function srp_reel_probe_summary(array $metadata): array
{
    $video = null;
    foreach (($metadata['streams'] ?? []) as $stream) {
        if (($stream['codec_type'] ?? '') === 'video') {
            $video = $stream;
            break;
        }
    }
    if (!is_array($video)) {
        throw new RuntimeException('The upload does not contain a video stream.');
    }

    $duration = (float)($video['duration'] ?? ($metadata['format']['duration'] ?? 0));
    $durationMs = (int)round($duration * 1000);
    $width = (int)($video['width'] ?? 0);
    $height = (int)($video['height'] ?? 0);

    $rotation = 0;
    if (isset($video['tags']['rotate'])) {
        $rotation = (int)$video['tags']['rotate'];
    }
    foreach (($video['side_data_list'] ?? []) as $sideData) {
        if (isset($sideData['rotation'])) {
            $rotation = (int)$sideData['rotation'];
        }
    }
    if (abs($rotation) % 180 === 90) {
        [$width, $height] = [$height, $width];
    }

    if ($durationMs <= 0 || $width <= 0 || $height <= 0) {
        throw new RuntimeException('The upload has invalid video metadata.');
    }
    return [
        'duration_ms' => $durationMs,
        'width' => $width,
        'height' => $height,
    ];
}
