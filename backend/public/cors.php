<?php
/**
 * Basic CORS helper for API endpoints.
 * Add frontend origins as needed.
 */
$allowed_origins = [
    'http://172.16.11.133',
    'http://172.16.11.133:3000',
    'http://localhost:3000',
    'http://localhost:8081',
    'http://10.0.0.251:8081',
    'http://10.0.0.251:8082',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:5173',
];

// Additional origins can be supplied via the CORS_ALLOWED_ORIGINS env var
// (comma-separated) so deployments can change hosts without editing code.
$envOrigins = getenv('CORS_ALLOWED_ORIGINS');
if ($envOrigins !== false && trim($envOrigins) !== '') {
    foreach (explode(',', $envOrigins) as $envOrigin) {
        $envOrigin = trim($envOrigin);
        if ($envOrigin !== '') {
            $allowed_origins[] = $envOrigin;
        }
    }
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!$origin && isset($_SERVER['HTTP_HOST'])) {
    // Same-host requests without an Origin header should still be allowed.
    $origin = 'http://' . $_SERVER['HTTP_HOST'];
}

$origin_parts = parse_url($origin);
$host_parts = parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''));
$is_same_host_dev_origin =
    isset($origin_parts['host'], $host_parts['host'])
    && $origin_parts['host'] === $host_parts['host']
    && (($origin_parts['port'] ?? null) === 8081);

if (in_array($origin, $allowed_origins, true) || $is_same_host_dev_origin) {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Vary: Origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Session-Id");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}
