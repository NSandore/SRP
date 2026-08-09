<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../db_connection.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$userId = normalizeId($_SESSION['user_id'] ?? '');
if ($userId === '') {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$documentType = trim((string)($_POST['document_type'] ?? ''));
$allowedTypes = ['selfie_with_id', 'id_front', 'supporting_doc'];
if (!in_array($documentType, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid document type']);
    exit;
}

if (!isset($_FILES['document'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Document file is required']);
    exit;
}

$file = $_FILES['document'];
if (!empty($file['error'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File upload error']);
    exit;
}

$originalName = $file['name'] ?? '';
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unsupported file type']);
    exit;
}

$maxBytes = 10 * 1024 * 1024; // 10 MB
if (($file['size'] ?? 0) > $maxBytes) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File is too large (10MB max)']);
    exit;
}

$tmpPath = $file['tmp_name'];

// Validate the actual file content, not just the client-supplied filename.
// This blocks the classic "rename an HTML/JS/SVG file to .jpg" trick, which
// would otherwise let active content be stored and later served same-origin
// to a reviewer or the account owner.
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedMime = $finfo ? finfo_file($finfo, $tmpPath) : '';
if ($finfo) {
    finfo_close($finfo);
}

$extensionMimeMap = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'pdf' => 'application/pdf',
];
if (($extensionMimeMap[$extension] ?? null) !== $detectedMime) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File content does not match its extension']);
    exit;
}

if ($extension === 'pdf') {
    $header = @file_get_contents($tmpPath, false, null, 0, 5);
    if ($header !== '%PDF-') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid PDF file']);
        exit;
    }
} else {
    // Must successfully decode as a genuine raster image; this defeats
    // polyglot files that pass a MIME sniff but aren't real images.
    $imageInfo = @getimagesize($tmpPath);
    if ($imageInfo === false || !in_array($imageInfo[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid image file']);
        exit;
    }
}

$uploadDir = __DIR__ . '/../../uploads/verification/';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Upload directory is not writable']);
    exit;
}

$filename = sprintf(
    '%s_%s_%s.%s',
    $userId,
    $documentType,
    date('YmdHis'),
    $extension
);
$destination = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to store upload']);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'path' => '/uploads/verification/' . $filename,
]);
