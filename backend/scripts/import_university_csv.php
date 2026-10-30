#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Backward-compatible entry point for the retired name-based CSV importer.
 *
 * The previous implementation could update a same-named group, overwrite
 * platform data, and manufacture generic branding. All invocations are now
 * routed through the locked, UNITID-aware IPEDS pipeline. A supplied file must
 * therefore be an official HDYYYY.csv/ZIP (or a structurally equivalent test
 * fixture with UNITID, INSTNM, CITY, and STABBR columns).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

fwrite(
    STDERR,
    "Deprecated: use `php backend/scripts/institution_data.php refresh --source ipeds`.\n"
);

$legacyArguments = array_slice($argv, 1);
$forwarded = in_array('--help', $legacyArguments, true)
    || in_array('-h', $legacyArguments, true)
    ? [__DIR__ . '/institution_data.php', '--help']
    : [
        __DIR__ . '/institution_data.php',
        'refresh',
        '--source',
        'ipeds',
    ];
if (count($forwarded) > 2) {
    foreach ($legacyArguments as $argument) {
        $forwarded[] = $argument;
    }
}

$argv = $forwarded;
$argc = count($argv);
require __DIR__ . '/institution_data.php';
