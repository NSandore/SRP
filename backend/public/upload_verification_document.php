<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
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
