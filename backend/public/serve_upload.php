<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

$requestMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($requestMethod, ['GET', 'HEAD'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD');
    echo 'Method not allowed';
    exit;
}

$rawPath = isset($_GET['path']) ? (string)$_GET['path'] : '';
$rawPath = trim($rawPath);

if ($rawPath === '') {
    http_response_code(400);
    echo 'Missing path';
    exit;
}

// Allow paths like "/uploads/verification/..." or "verification/..."
$rawPath = str_replace(["\0", '..'], '', $rawPath);
$relative = $rawPath;
if (str_starts_with($relative, '/uploads/')) {
    $relative = substr($relative, strlen('/uploads/'));
}
if (str_starts_with($relative, '/')) {
    $relative = ltrim($relative, '/');
}

// Verification documents are sensitive PII (government IDs, selfies, tuition
// statements). Only the owning user or a super admin may retrieve them.
// Public assets (avatars, banners, logos) remain openly viewable.
$isVerification = str_starts_with($relative, 'verification/');
if ($isVerification) {
    $sessionUserId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    if ($sessionUserId === '') {
        http_response_code(403);
        echo 'Forbidden';
        exit;
    }
    $roleId = (int)($_SESSION['role_id'] ?? 0);
    $fileName = basename($relative);
    // Verification files are named "<userId>_<kind>_<timestamp>.<ext>".
    $ownerId = '';
    if (preg_match('/^(u[0-9a-fA-F]+)_/', $fileName, $m)) {
        $ownerId = $m[1];
    }
    if (!isSuperAdmin($roleId) && $ownerId !== $sessionUserId) {
        http_response_code(403);
        echo 'Forbidden';
        exit;
    }
}

// Reel media inherits the creator's profile visibility. Do not let a copied
// /uploads/reels path bypass the visibility predicate enforced by the feed.
$isReelMedia = false;
if (preg_match('#^reels/(rl[a-zA-Z0-9_-]+)/(?:video\.mp4|thumbnail\.jpg)$#', $relative, $reelMatch)) {
    $isReelMedia = true;
    require_once __DIR__ . '/../includes/reels.php';
    $viewerId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    try {
        $reelDb = getDB();
        if (!srp_reel_fetch_ready($reelDb, $reelMatch[1], $viewerId)) {
            http_response_code(404);
            echo 'File not found';
            exit;
        }
    } catch (Throwable $e) {
        error_log('[SRP reels] media authorization failed: ' . $e->getMessage());
        http_response_code(404);
        echo 'File not found';
        exit;
    }
}

$baseDir = realpath(__DIR__ . '/../../uploads');
if ($baseDir === false) {
    http_response_code(500);
    echo 'Uploads directory not found';
    exit;
}

$fullPath = realpath($baseDir . DIRECTORY_SEPARATOR . $relative);
if ($fullPath === false || !str_starts_with($fullPath, $baseDir . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

if (!is_file($fullPath) || !is_readable($fullPath)) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedMime = $finfo ? finfo_file($finfo, $fullPath) : 'application/octet-stream';
if ($finfo) {
    finfo_close($finfo);
}

// Only ever serve a small allow-list of MIME types under their real type.
// Anything else (e.g. an active-content file smuggled past upload
// validation under an image/PDF extension) is downgraded to
// application/octet-stream and forced to download, so it can never be
// rendered/executed inline on this origin.
$safeInlineMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'video/mp4',
];
$isSafeMime = in_array($detectedMime, $safeInlineMimes, true);
$outputMime = $isSafeMime ? $detectedMime : 'application/octet-stream';
$fileSize = filesize($fullPath);
if ($fileSize === false) {
    http_response_code(500);
    echo 'Unable to read file';
    exit;
}

header('X-Content-Type-Options: nosniff');
header('Content-Type: ' . $outputMime);
header('Accept-Ranges: bytes');

if ($isVerification || $isReelMedia || !$isSafeMime) {
    // Sensitive PII, and anything that didn't match the safe allow-list,
    // is never cached. Reel media is visibility-gated on every request, so it
    // must not enter a shared or post-logout browser cache.
    header('Cache-Control: private, no-store, max-age=0');
    if (!$isReelMedia) {
        header('Content-Disposition: attachment; filename="' . basename($fullPath) . '"');
    }
} else {
    header('Cache-Control: public, max-age=604800');
}

// Release PHP's per-session lock before a potentially long video stream so
// likes/comments/status requests from this user are not blocked by playback.
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

$start = 0;
$end = max(0, $fileSize - 1);
$rangeHeader = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
if ($rangeHeader !== '') {
    if (
        str_contains($rangeHeader, ',')
        || !preg_match('/^bytes=(\d*)-(\d*)$/', $rangeHeader, $matches)
        || ($matches[1] === '' && $matches[2] === '')
    ) {
        http_response_code(416);
        header("Content-Range: bytes */{$fileSize}");
        header('Content-Length: 0');
        exit;
    }

    if ($matches[1] === '') {
        $suffixLength = (int)$matches[2];
        if ($suffixLength <= 0) {
            http_response_code(416);
            header("Content-Range: bytes */{$fileSize}");
            header('Content-Length: 0');
            exit;
        }
        $start = max(0, $fileSize - $suffixLength);
    } else {
        $start = (int)$matches[1];
    }
    if ($matches[2] !== '' && $matches[1] !== '') {
        $end = min($end, (int)$matches[2]);
    }
    if ($start >= $fileSize || $start > $end) {
        http_response_code(416);
        header("Content-Range: bytes */{$fileSize}");
        header('Content-Length: 0');
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes {$start}-{$end}/{$fileSize}");
}

$length = $fileSize === 0 ? 0 : ($end - $start + 1);
header('Content-Length: ' . $length);
if ($requestMethod === 'HEAD' || $length === 0) {
    exit;
}

$handle = fopen($fullPath, 'rb');
if ($handle === false || fseek($handle, $start) !== 0) {
    if (is_resource($handle)) {
        fclose($handle);
    }
    http_response_code(500);
    exit;
}

$remaining = $length;
while ($remaining > 0 && !feof($handle)) {
    if (connection_aborted()) {
        break;
    }
    $chunk = fread($handle, min(1024 * 1024, $remaining));
    if ($chunk === false || $chunk === '') {
        break;
    }
    echo $chunk;
    $remaining -= strlen($chunk);
    @ob_flush();
    flush();
}
fclose($handle);
