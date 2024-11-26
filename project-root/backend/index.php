<?php
$uri = trim($_SERVER['REQUEST_URI'], '/');

// Route to test API
if ($uri === 'api/test') {
    include 'api/test.php';
    exit;
}

// Fallback for unknown routes
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
