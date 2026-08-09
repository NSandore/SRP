<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../includes/newsroom.php';

try {
    $result = srp_newsroom_sync_official(getDB());
    fwrite(
        STDOUT,
        sprintf(
            "Education news sync complete: %d found, %d imported, %d refreshed.\n",
            $result['found'],
            $result['imported'],
            $result['updated']
        )
    );
    exit(0);
} catch (Throwable $e) {
    error_log('[SRP] Newsroom CLI import failed: ' . $e->getMessage());
    fwrite(STDERR, "Education news sync failed. Check the server log for details.\n");
    exit(1);
}

