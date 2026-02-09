<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

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
$mime = $finfo ? finfo_file($finfo, $fullPath) : 'application/octet-stream';
if ($finfo) {
    finfo_close($finfo);
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: public, max-age=604800');
readfile($fullPath);
