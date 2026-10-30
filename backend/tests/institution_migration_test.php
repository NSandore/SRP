<?php

declare(strict_types=1);

/**
 * Structural forward/rollback tests that never connect to or mutate a live
 * database. Run with: php backend/tests/institution_migration_test.php
 */

require_once __DIR__ . '/institution_test_helpers.php';

$test = new SrpInstitutionTestHarness();
$forwardPath = __DIR__ . '/../migrations/20260806_institution_pipeline.sql';
$rollbackPath = __DIR__ . '/../migrations/rollback/20260806_institution_pipeline.sql';
$forward = file_get_contents($forwardPath);
$rollback = file_get_contents($rollbackPath);

$test->check('forward migration is readable', is_string($forward) && $forward !== '');
$test->check('rollback migration is readable', is_string($rollback) && $rollback !== '');
if (!is_string($forward) || !is_string($rollback)) {
    $test->finish('Institution migration tests');
}

$extractColumnLines = static function (string $sql, string $operation): array {
    $columns = [];
    foreach (preg_split('/\R/', $sql) ?: [] as $line) {
        $line = trim($line);
        if (preg_match(
            '/^' . preg_quote($operation, '/') . '\s+COLUMN\s+`?([a-z][a-z0-9_]*)`?\s*(.*?)(?:,\s*)?$/i',
            $line,
            $matches
        ) === 1) {
            $columns[$matches[1]] = trim($matches[2]);
        }
    }
    return $columns;
};

$added = $extractColumnLines($forward, 'ADD');
$dropped = $extractColumnLines($rollback, 'DROP');
$addedNames = array_keys($added);
$droppedNames = array_keys($dropped);
sort($addedNames, SORT_STRING);
sort($droppedNames, SORT_STRING);

$test->check('forward migration adds pipeline columns', count($added) >= 40);
$test->same('rollback drops exactly the forward-added columns', $addedNames, $droppedNames);
$test->same('UNITID uses the expected scalar column', true, isset($added['ipeds_unitid']));
$test->same('review flag is present', true, isset($added['pipeline_review_required']));

foreach ($added as $column => $definition) {
    if ($column === 'pipeline_review_required') {
        $test->check(
            'review flag alone is non-null and defaults false',
            preg_match('/\bNOT\s+NULL\b/i', $definition) === 1
                && preg_match('/\bDEFAULT\s+0\b/i', $definition) === 1,
            $definition
        );
        continue;
    }
    $test->check(
        "{$column} remains nullable",
        preg_match('/\bNULL\b/i', $definition) === 1
            && preg_match('/\bNOT\s+NULL\b/i', $definition) !== 1,
        $definition
    );
}

$test->check(
    'UNITID unique key remains nullable',
    preg_match(
        '/ADD\s+UNIQUE\s+KEY\s+uq_communities_ipeds_unitid\s*\(\s*ipeds_unitid\s*\)/i',
        $forward
    ) === 1
        && preg_match('/ipeds_unitid\s+CHAR\(6\)\s+NULL/i', $forward) === 1
);
$test->check(
    'provenance columns use native JSON',
    preg_match('/data_sources_json\s+JSON\s+NULL/i', $forward) === 1
        && preg_match('/data_confidence_json\s+JSON\s+NULL/i', $forward) === 1
        && preg_match('/data_verified_json\s+JSON\s+NULL/i', $forward) === 1
        && preg_match('/data_candidates_json\s+JSON\s+NULL/i', $forward) === 1
        && preg_match('/pipeline_metadata_json\s+JSON\s+NULL/i', $forward) === 1
        && preg_match('/manual_overrides_json\s+JSON\s+NULL/i', $forward) === 1
);

$alterTargets = [];
preg_match_all('/\bALTER\s+TABLE\s+`?([a-z][a-z0-9_]*)`?/i', $forward . "\n" . $rollback, $targetMatches);
foreach ($targetMatches[1] ?? [] as $target) {
    $alterTargets[strtolower($target)] = true;
}
$test->same('both migrations target only communities', ['communities'], array_keys($alterTargets));
$test->check(
    'neither migration creates or drops another table',
    preg_match('/\b(?:CREATE|DROP)\s+TABLE\b/i', $forward . "\n" . $rollback) !== 1
);
$test->check(
    'migrations contain no row-level data mutation',
    preg_match('/\b(?:INSERT|UPDATE|DELETE|REPLACE|TRUNCATE)\b/i', $forward . "\n" . $rollback) !== 1
);
$test->check(
    'forward migration never drops, renames, or changes an existing column',
    preg_match('/\b(?:DROP|RENAME|MODIFY|CHANGE)\s+(?:COLUMN\s+)?/i', $forward) !== 1
);

$preexistingColumns = [
    'id',
    'community_type',
    'parent_community_id',
    'name',
    'location',
    'website',
    'phone',
    'tagline',
    'aliases',
    'created_at',
    'updated_at',
    'logo_path',
    'primary_color',
    'secondary_color',
    'banner_path',
];
$test->same(
    'rollback does not drop a preexisting column',
    [],
    array_values(array_intersect($preexistingColumns, $droppedNames))
);
$test->same(
    'existing selected fields are reused rather than duplicated',
    [],
    array_values(array_intersect(
        ['official_website', 'alternate_names', 'college_scorecard_id'],
        $addedNames
    ))
);
$test->check(
    'forward migration starts with executable SQL for the current runner',
    str_starts_with(ltrim($forward), 'ALTER TABLE communities')
);
$test->check(
    'column additions request instant DDL',
    preg_match('/ALGORITHM\s*=\s*INSTANT/i', $forward) === 1
);
$test->check(
    'index additions request nonblocking DDL',
    preg_match('/ALGORITHM\s*=\s*INPLACE/i', $forward) === 1
        && preg_match('/LOCK\s*=\s*NONE/i', $forward) === 1
);

$test->finish('Institution migration tests');
