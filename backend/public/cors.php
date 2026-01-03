<?php
/**
 * Basic CORS helper for API endpoints.
 * Add frontend origins as needed.
 */
$allowed_origins = [
    'http://172.16.11.133',
    'http://172.16.11.133:3000',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!$origin && isset($_SERVER['HTTP_HOST'])) {
    // Same-host requests without an Origin header should still be allowed.
    $origin = 'http://' . $_SERVER['HTTP_HOST'];
}

if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Vary: Origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Requested-With");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}
