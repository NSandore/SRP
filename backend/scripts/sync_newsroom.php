#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../includes/newsroom.php';

try {
    $result = srp_newsroom_sync_official_if_due(getDB());
    fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
} catch (Throwable $e) {
    error_log('[SRP] Scheduled newsroom sync failed: ' . $e->getMessage());
    fwrite(STDERR, "Newsroom sync failed: {$e->getMessage()}\n");
    exit(1);
}
