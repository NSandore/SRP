<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/search_gap_signals.php';

$cases = [
    '  FAFSA   DEADLINE  ' => 'fafsa deadline',
    "Housing\nhelp" => 'housing help',
    'Email me at Student@example.com about aid' => 'email me at [email] about aid',
    'Call (555) 123-4567 for details' => 'call [phone] for details',
    'My identifier is 123-45-6789' => 'my identifier is [id]',
    'My application number is 123456789' => 'my application number is [number]',
    'Look at https://example.com/private?q=1 please' => 'look at [link] please',
];

$failures = 0;
foreach ($cases as $input => $expected) {
    $actual = srp_normalize_search_gap_query($input);
    if ($actual !== $expected) {
        fwrite(STDERR, "Expected '{$expected}', got '{$actual}'\n");
        $failures++;
    }
}

$long = str_repeat('A', 200);
if (mb_strlen(srp_normalize_search_gap_query($long)) !== 160) {
    fwrite(STDERR, "Expected normalized searches to be capped at 160 characters.\n");
    $failures++;
}

if ($failures > 0) {
    exit(1);
}

fwrite(STDOUT, "Search-gap signal normalization tests passed.\n");
