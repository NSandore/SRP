#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script may only be run from the command line.\n");
    exit(1);
}

$dryRun = in_array('--dry-run', $argv, true);
$unknownArguments = array_values(array_filter(
    array_slice($argv, 1),
    static fn(string $argument): bool => $argument !== '--dry-run'
));
if ($unknownArguments !== []) {
    fwrite(STDERR, 'Unknown argument: ' . $unknownArguments[0] . "\n");
    exit(1);
}

/**
 * User or community activity that must keep an institution in the listed tier.
 * Posts and threads are covered through their parent forum.
 *
 * @var array<string, string>
 */
$activityColumns = [
    'users' => 'verified_community_id',
    'followed_communities' => 'community_id',
    'forums' => 'community_id',
    'events' => 'community_id',
    'polls' => 'community_id',
    'announcements' => 'community_id',
    'reels' => 'community_id',
    'educational_experience' => 'community_id',
    'ambassadors' => 'community_id',
    'verified_users' => 'community_id',
    'user_verification_requests' => 'community_id',
];

function hasTableColumn(PDO $db, string $table, string $column): bool
{
    $statement = $db->prepare(
        'SELECT 1
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :table_name
            AND COLUMN_NAME = :column_name
          LIMIT 1'
    );
    $statement->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);
    return $statement->fetchColumn() !== false;
}

$db = getDB();
$requiredColumns = [
    'directory_visibility',
    'directory_visibility_reason',
    'directory_visibility_manual',
];
foreach ($requiredColumns as $requiredColumn) {
    if (!hasTableColumn($db, 'communities', $requiredColumn)) {
        fwrite(
            STDERR,
            "Missing communities.{$requiredColumn}; run database migrations first.\n"
        );
        exit(1);
    }
}

$activityPredicates = [];
$availableActivitySources = [];
foreach ($activityColumns as $table => $column) {
    if (!hasTableColumn($db, $table, $column)) {
        continue;
    }
    $availableActivitySources[] = $table;
    $activityPredicates[] = sprintf(
        'EXISTS (SELECT 1 FROM `%s` activity WHERE activity.`%s` = c.id LIMIT 1)',
        $table,
        $column
    );
}
$hasActivity = $activityPredicates === []
    ? '0 = 1'
    : '(' . implode("\n OR ", $activityPredicates) . ')';

$visibilityCase = "CASE
    WHEN {$hasActivity} THEN 'listed'
    WHEN COALESCE(c.pipeline_active, 1) = 0
      OR LOWER(COALESCE(c.operating_status, '')) IN ('closed', 'merged')
      OR LOWER(COALESCE(c.institution_sector, '')) = 'administrative_unit'
        THEN 'archived'
    WHEN c.pipeline_active = 1
      AND LOWER(COALESCE(c.operating_status, '')) IN ('active', 'newly_active', 'restored')
      AND c.degree_granting = 1
      AND COALESCE(c.pipeline_review_required, 0) = 0
        THEN 'listed'
    ELSE 'search_only'
END";

$reasonCase = "CASE
    WHEN {$hasActivity} THEN 'attached_activity'
    WHEN LOWER(COALESCE(c.institution_sector, '')) = 'administrative_unit'
        THEN 'administrative_unit'
    WHEN COALESCE(c.pipeline_active, 1) = 0
      OR LOWER(COALESCE(c.operating_status, '')) IN ('closed', 'merged')
        THEN 'inactive_or_closed'
    WHEN c.pipeline_active = 1
      AND LOWER(COALESCE(c.operating_status, '')) IN ('active', 'newly_active', 'restored')
      AND c.degree_granting = 1
      AND COALESCE(c.pipeline_review_required, 0) = 0
        THEN 'active_degree_granting_reviewed'
    WHEN c.degree_granting = 0 THEN 'non_degree_granting'
    WHEN COALESCE(c.pipeline_review_required, 0) = 1 THEN 'needs_review'
    ELSE 'unclassified'
END";

$eligibleWhere = "c.community_type = 'university'
    AND COALESCE(c.directory_visibility_manual, 0) = 0";

if (!$dryRun) {
    $updated = $db->exec(
        "UPDATE communities c
            SET c.directory_visibility = {$visibilityCase},
                c.directory_visibility_reason = {$reasonCase}
          WHERE {$eligibleWhere}"
    );
} else {
    $updated = 0;
}

$counts = $db->query(
    $dryRun
        ? "SELECT proposed_visibility AS directory_visibility, COUNT(*) AS total
             FROM (
                 SELECT {$visibilityCase} AS proposed_visibility
                   FROM communities c
                  WHERE {$eligibleWhere}
             ) proposed
            GROUP BY proposed_visibility
            ORDER BY proposed_visibility"
        : "SELECT directory_visibility, COUNT(*) AS total
             FROM communities
            WHERE community_type = 'university'
            GROUP BY directory_visibility
            ORDER BY directory_visibility"
)->fetchAll(PDO::FETCH_KEY_PAIR);

$manualCount = (int)$db->query(
    "SELECT COUNT(*)
       FROM communities
      WHERE community_type = 'university'
        AND directory_visibility_manual = 1"
)->fetchColumn();

fwrite(STDOUT, json_encode([
    'status' => 'success',
    'dry_run' => $dryRun,
    'updated_rows' => (int)$updated,
    'activity_sources' => $availableActivitySources,
    'manual_overrides_preserved' => $manualCount,
    'counts' => array_map('intval', $counts),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL);
