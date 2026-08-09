<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Json.php';
require_once __DIR__ . '/Normalizer.php';
require_once __DIR__ . '/Color.php';
require_once __DIR__ . '/License.php';
require_once __DIR__ . '/FieldPolicy.php';
require_once __DIR__ . '/Matcher.php';
require_once __DIR__ . '/Resolver.php';

if (is_file(__DIR__ . '/Lock.php')) {
    require_once __DIR__ . '/Lock.php';
}
if (is_file(__DIR__ . '/ReportWriter.php')) {
    require_once __DIR__ . '/ReportWriter.php';
}
