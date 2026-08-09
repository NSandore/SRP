<?php

declare(strict_types=1);

require_once __DIR__ . '/Lock.php';
require_once __DIR__ . '/Repository.php';
require_once __DIR__ . '/Schema.php';

final class SrpInstitutionPipeline
{
    private PDO $db;
    /** @var array<string, mixed> */
    private array $config;
    private SrpInstitutionReportWriter $reporter;
    /** @var array<string, object> */
    private array $sources;

    /**
     * @param array<string, mixed> $config
     * @param array<string, object> $sources Source name => source adapter.
     */
    public function __construct(
        PDO $db,
        array $config,
        SrpInstitutionReportWriter $reporter,
        array $sources
    ) {
        $this->db = $db;
        $this->config = $config;
        $this->reporter = $reporter;
        $this->sources = $sources;
    }

    /**
     * @param array<string, mixed> $options
     * @return array<string, mixed>
     */
    public function refresh(array $options = []): array
    {
        SrpInstitutionSchema::assertReady($this->db);
        $options = array_merge([
            'sources' => [],
            'state' => null,
            'unitid' => null,
            'unitids' => [],
            'branding_only' => false,
            'dry_run' => false,
            'file' => null,
            'limit' => null,
        ], $options);
        $sourceNames = $this->selectedSources($options);
        $this->reporter->configure(
            (bool)$options['dry_run'],
            [
                'state' => $options['state'],
                'unitid' => $options['unitid'],
                'unitids' => $options['unitids'],
                'branding_only' => (bool)$options['branding_only'],
                'sources' => $sourceNames,
            ],
            (string)($this->config['pipeline_version'] ?? '1.0.0')
        );

        $lock = new SrpInstitutionRunLock(
            $this->db,
            (string)($this->config['runtime_path'] ?? dirname(__DIR__, 2)
                . '/runtime/institution_pipeline')
        );
        $lock->acquire();
        $repository = new SrpInstitutionRepository(
            $this->db,
            $this->config,
            $this->reporter
        );
        $overallStatus = 'success';
        $successfulSources = 0;
        $failedSources = 0;
        $previousResults = [];

        try {
            foreach ($sourceNames as $sourceName) {
                if (!isset($this->sources[$sourceName])) {
                    $failedSources++;
                    $overallStatus = 'partial';
                    $this->reporter->source($sourceName, 'failed', [
                        'error' => 'Source adapter is not configured.',
                    ]);
                    $this->reporter->error(
                        $sourceName,
                        'configuration',
                        'Source adapter is not configured.'
                    );
                    continue;
                }

                $started = microtime(true);
                $source = $this->sources[$sourceName];
                $context = [
                    'state' => $options['state'],
                    'unitid' => $options['unitid'],
                    'unitids' => $options['unitids'],
                    'file' => $sourceName === 'ipeds' ? $options['file'] : null,
                    'limit' => $options['limit'],
                    'universities' => $repository->allUniversities(),
                    'previous_results' => $previousResults,
                    'run_id' => $this->reporter->runId(),
                    'raw_data_path' => $this->config['raw_data_path'] ?? null,
                ];

                try {
                    $result = $source->fetch($context);
                } catch (Throwable $error) {
                    $failedSources++;
                    $overallStatus = 'partial';
                    $this->logSourceException($sourceName, 'fetch', $error);
                    $this->reporter->source($sourceName, 'failed', [
                        'duration_seconds' => round(microtime(true) - $started, 3),
                        'error' => $error->getMessage(),
                    ]);
                    continue;
                }

                $this->writeSourceErrors($sourceName, $result);
                foreach ((array)$result->warnings() as $warning) {
                    $this->reporter->warning(
                        $sourceName . ': ' . trim((string)$warning)
                    );
                }
                if ($result->isSkipped()) {
                    $this->reporter->source($sourceName, 'skipped', array_merge(
                        (array)$result->metadata(),
                        ['duration_seconds' => round(microtime(true) - $started, 3)]
                    ));
                    $previousResults[$sourceName] = $result;
                    continue;
                }
                if (!$result->isSuccess()) {
                    $failedSources++;
                    $overallStatus = 'partial';
                    $this->reporter->source($sourceName, 'failed', array_merge(
                        (array)$result->metadata(),
                        ['duration_seconds' => round(microtime(true) - $started, 3)]
                    ));
                    $previousResults[$sourceName] = $result;
                    continue;
                }

                try {
                    $stage = $this->applySourceResult(
                        $sourceName,
                        (array)$result->records(),
                        (array)$result->metadata(),
                        $repository,
                        $options
                    );
                    $successfulSources++;
                    $this->reporter->source($sourceName, 'success', array_merge(
                        (array)$result->metadata(),
                        $stage,
                        ['duration_seconds' => round(microtime(true) - $started, 3)]
                    ));
                } catch (Throwable $error) {
                    $failedSources++;
                    $overallStatus = 'partial';
                    $this->logSourceException($sourceName, 'apply', $error);
                    $this->reporter->source($sourceName, 'failed', array_merge(
                        (array)$result->metadata(),
                        [
                            'duration_seconds' => round(microtime(true) - $started, 3),
                            'error' => $error->getMessage(),
                        ]
                    ));
                }
                $previousResults[$sourceName] = $result;
            }

            $this->writeMissingBrandingReport($repository->allUniversities());
            if ($successfulSources === 0 && $failedSources > 0) {
                $overallStatus = 'failed';
            }
            $summaryPath = $this->reporter->finalize($overallStatus, [
                'successful_sources' => $successfulSources,
                'failed_sources' => $failedSources,
            ]);
            return [
                'status' => $overallStatus,
                'report_path' => $summaryPath,
                'run_directory' => $this->reporter->directory(),
                'successful_sources' => $successfulSources,
                'failed_sources' => $failedSources,
            ];
        } catch (Throwable $error) {
            $this->reporter->error('pipeline', 'fatal', $error->getMessage());
            $this->reporter->finalize('failed', [
                'successful_sources' => $successfulSources,
                'failed_sources' => $failedSources + 1,
            ]);
            throw $error;
        } finally {
            $lock->release();
        }
    }

    /**
     * @param list<array<string, mixed>> $records
     * @param array<string, mixed> $sourceMetadata
     * @param array<string, mixed> $options
     * @return array<string, int>
     */
    private function applySourceResult(
        string $sourceName,
        array $records,
        array $sourceMetadata,
        SrpInstitutionRepository $repository,
        array $options
    ): array {
        $rows = $repository->allUniversities();
        $matcher = SrpInstitutionMatcher::buildIndex($rows, [
            'fuzzy_threshold' => $this->config['matching']['fuzzy_threshold'] ?? 0.93,
            'fuzzy_margin' => $this->config['matching']['fuzzy_margin'] ?? 0.04,
            'review_threshold' => $this->config['matching']['review_threshold'] ?? 0.80,
        ]);
        $plans = [];
        $claimed = [];
        $seenUnitids = [];
        $reservedNames = [];
        $stats = [
            'records' => 0,
            'proposed_inserts' => 0,
            'proposed_updates' => 0,
            'unchanged' => 0,
            'unmatched' => 0,
            'potential_duplicates' => 0,
            'applied_inserts' => 0,
            'applied_updates' => 0,
            'record_errors' => 0,
        ];

        foreach ($records as $record) {
            if (!is_array($record) || !$this->recordMatchesFilters($record, $options)) {
                continue;
            }
            if (!isset($record['source_version'])) {
                $record['source_version'] = $sourceMetadata['source_version']
                    ?? $sourceMetadata['reporting_year']
                    ?? $sourceMetadata['archive_sha256']
                    ?? null;
            }
            $stats['records']++;
            $unitId = SrpInstitutionNormalizer::unitId(
                $record['match']['ipeds_unitid'] ?? null
            );
            if ($unitId !== null) {
                $seenUnitids[$unitId] = true;
            }
            try {
                $match = $matcher->match($record);
                $matchedRow = isset($match['row']) && is_array($match['row'])
                    ? $match['row']
                    : null;
                if ($matchedRow === null
                    && ($match['review'] ?? false) === true
                    && !empty($match['candidates'])
                ) {
                    $this->reportPotentialMatches($sourceName, $record, $match);
                    $stats['potential_duplicates']++;
                    $plans[] = [
                        'action' => 'duplicate_match',
                        'source_record' => $record,
                        'match' => $match,
                    ];
                    continue;
                }
                if ($matchedRow !== null) {
                    $communityId = (string)$matchedRow['id'];
                    $claimIdentity = (string)$record['source_record_id'];
                    if (isset($claimed[$communityId])
                        && $claimed[$communityId] !== $claimIdentity
                    ) {
                        $this->reportPotentialMatches(
                            $sourceName,
                            $record,
                            array_merge($match, [
                                'reasons' => ['Two source records claimed one existing community row.'],
                            ])
                        );
                        $stats['potential_duplicates']++;
                        $plans[] = [
                            'action' => 'duplicate_match',
                            'source_record' => $record,
                            'match' => $match,
                        ];
                        continue;
                    }
                    $claimed[$communityId] = $claimIdentity;
                }
                $plan = $repository->plan($record, $match);
                if (($plan['action'] ?? '') === 'insert') {
                    $plan = $this->reservePlannedDisplayName($plan, $reservedNames);
                }
                $plans[] = $plan;
                match ($plan['action']) {
                    'insert' => $stats['proposed_inserts']++,
                    'update' => $stats['proposed_updates']++,
                    'noop' => $stats['unchanged']++,
                    default => $stats['unmatched']++,
                };
                if (($plan['action'] ?? '') === 'unmatched') {
                    $this->reportUnmatched($sourceName, $record, (string)$plan['reason']);
                }
            } catch (Throwable $error) {
                $stats['record_errors']++;
                $this->reportUnmatched(
                    $sourceName,
                    $record,
                    'Record planning failed: ' . $error->getMessage()
                );
                $this->structuredLog($sourceName, 'record_plan_error', [
                    'source_record_id' => $record['source_record_id'] ?? null,
                    'message' => $error->getMessage(),
                ]);
            }
        }

        if (!(bool)$options['dry_run']) {
            $this->db->beginTransaction();
            try {
                foreach ($plans as $index => $plan) {
                    if (!in_array($plan['action'] ?? '', ['insert', 'update'], true)) {
                        continue;
                    }
                    $savepoint = 'institution_row_' . $index;
                    $this->db->exec("SAVEPOINT {$savepoint}");
                    try {
                        $applied = $repository->apply($plan);
                        if (($applied['applied'] ?? false) === true) {
                            if ($plan['action'] === 'insert') {
                                $stats['applied_inserts']++;
                            } else {
                                $stats['applied_updates']++;
                            }
                        }
                        $this->db->exec("RELEASE SAVEPOINT {$savepoint}");
                    } catch (Throwable $error) {
                        $this->db->exec("ROLLBACK TO SAVEPOINT {$savepoint}");
                        $this->db->exec("RELEASE SAVEPOINT {$savepoint}");
                        $stats['record_errors']++;
                        $record = $plan['source_record'];
                        if (!empty($plan['community_id'])) {
                            try {
                                $repository->recordRowError(
                                    (string)$plan['community_id'],
                                    $sourceName,
                                    'apply',
                                    $error->getMessage()
                                );
                            } catch (Throwable $recordError) {
                                $this->structuredLog(
                                    $sourceName,
                                    'record_error_state_failed',
                                    [
                                        'community_id' => (string)$plan['community_id'],
                                        'message' => $recordError->getMessage(),
                                    ]
                                );
                            }
                        }
                        $this->reportUnmatched(
                            $sourceName,
                            $record,
                            'Record apply failed: ' . $error->getMessage()
                        );
                        $this->reporter->row('failed-requests.csv', [
                            'source' => $sourceName,
                            'url' => '',
                            'category' => 'record_apply',
                            'http_status' => '',
                            'attempts' => '',
                            'message' => $error->getMessage(),
                        ]);
                        $this->structuredLog($sourceName, 'record_apply_error', [
                            'source_record_id' => $record['source_record_id'] ?? null,
                            'message' => $error->getMessage(),
                        ]);
                    }
                }
                $this->db->commit();
            } catch (Throwable $error) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $error;
            }
        }

        $isCompleteIpeds = $sourceName === 'ipeds'
            && $options['state'] === null
            && $options['unitid'] === null
            && $options['unitids'] === []
            && $options['limit'] === null
            && (bool)($sourceMetadata['complete_snapshot'] ?? false);
        if ($isCompleteIpeds) {
            foreach ($repository->allUniversities() as $row) {
                $unitId = SrpInstitutionNormalizer::unitId($row['ipeds_unitid'] ?? null);
                if ($unitId !== null && !isset($seenUnitids[$unitId])) {
                    if ($repository->flagMissingFromDirectory(
                        $row,
                        (bool)$options['dry_run']
                    )) {
                        $stats['potential_duplicates']++;
                    }
                }
            }
        }

        foreach ($stats as $key => $value) {
            $this->reporter->increment($sourceName . '_' . $key, $value);
        }
        return $stats;
    }

    /**
     * @param array<string, mixed> $options
     * @return list<string>
     */
    private function selectedSources(array $options): array
    {
        if (!empty($options['sources'])) {
            return array_values(array_unique(array_map('strval', $options['sources'])));
        }
        if ((bool)$options['branding_only']) {
            $sources = ['wikidata', 'wikimedia', 'college-color'];
            if ((bool)($this->config['crawler_enabled'] ?? false)) {
                $sources[] = 'official-site';
            }
            return $sources;
        }
        $sources = ['ipeds', 'scorecard', 'wikidata', 'wikimedia', 'college-color'];
        if ((bool)($this->config['crawler_enabled'] ?? false)) {
            $sources[] = 'official-site';
        }
        return $sources;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, mixed> $options
     */
    private function recordMatchesFilters(array $record, array $options): bool
    {
        if ($options['state'] !== null
            && SrpInstitutionNormalizer::state($record['match']['state'] ?? null)
                !== $options['state']
        ) {
            return false;
        }
        if ($options['unitid'] !== null
            && SrpInstitutionNormalizer::unitId($record['match']['ipeds_unitid'] ?? null)
                !== SrpInstitutionNormalizer::unitId($options['unitid'])
        ) {
            return false;
        }
        if ($options['unitids'] !== []) {
            $allowed = array_fill_keys(array_map(
                static fn(mixed $value): string => (string)SrpInstitutionNormalizer::unitId($value),
                (array)$options['unitids']
            ), true);
            $recordUnitId = SrpInstitutionNormalizer::unitId(
                $record['match']['ipeds_unitid'] ?? null
            );
            if ($recordUnitId === null || !isset($allowed[$recordUnitId])) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param array<string, mixed> $plan
     * @param array<string, bool> $reservedNames
     * @return array<string, mixed>
     */
    private function reservePlannedDisplayName(array $plan, array &$reservedNames): array
    {
        $name = (string)$plan['values']['name'];
        $key = mb_strtolower($name, 'UTF-8');
        if (!isset($reservedNames[$key])) {
            $reservedNames[$key] = true;
            return $plan;
        }
        $unitId = (string)($plan['values']['ipeds_unitid']
            ?? $plan['source_record']['match']['ipeds_unitid']
            ?? '');
        $suffix = $unitId !== '' ? " ({$unitId})" : ' (additional campus)';
        $maxBase = max(1, 100 - mb_strlen($suffix, 'UTF-8'));
        $name = mb_substr((string)$plan['values']['official_name'], 0, $maxBase, 'UTF-8')
            . $suffix;
        $key = mb_strtolower($name, 'UTF-8');
        if (isset($reservedNames[$key])) {
            throw new RuntimeException('Unable to reserve a unique institution display name.');
        }
        $reservedNames[$key] = true;
        $plan['values']['name'] = $name;
        return $plan;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, mixed> $match
     */
    private function reportPotentialMatches(
        string $source,
        array $record,
        array $match
    ): void {
        $candidates = (array)($match['candidates'] ?? []);
        if ($candidates === []) {
            $candidates = [[
                'row' => $match['row'] ?? null,
                'method' => $match['method'] ?? 'unknown',
                'score' => $match['score'] ?? 0,
            ]];
        }
        foreach (array_slice($candidates, 0, 5) as $candidate) {
            $row = is_array($candidate['row'] ?? null) ? $candidate['row'] : [];
            $this->reporter->row('potential-duplicates.csv', [
                'source' => $source,
                'source_record_id' => (string)($record['source_record_id'] ?? ''),
                'candidate_community_id' => (string)($row['id'] ?? ''),
                'name' => (string)($record['match']['name'] ?? ''),
                'city' => (string)($record['match']['city'] ?? ''),
                'state' => (string)($record['match']['state'] ?? ''),
                'match_method' => (string)($candidate['method'] ?? $match['method'] ?? ''),
                'match_score' => (string)($candidate['score'] ?? $match['score'] ?? ''),
                'reason' => implode('|', array_map(
                    'strval',
                    (array)($match['reasons'] ?? ['ambiguous_match'])
                )),
            ]);
        }
    }

    /**
     * @param array<string, mixed> $record
     */
    private function reportUnmatched(string $source, array $record, string $reason): void
    {
        $this->reporter->row('unmatched-source-records.csv', [
            'source' => $source,
            'source_record_id' => (string)($record['source_record_id'] ?? ''),
            'name' => (string)($record['match']['name'] ?? ''),
            'city' => (string)($record['match']['city'] ?? ''),
            'state' => (string)($record['match']['state'] ?? ''),
            'reason' => $reason,
        ]);
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function writeMissingBrandingReport(array $rows): void
    {
        foreach ($rows as $row) {
            $missing = [];
            foreach (['primary_color', 'secondary_color', 'motto'] as $field) {
                if ($this->blank($row[$field] ?? null)
                    || in_array(strtoupper((string)$row[$field]), ['#0077B5', '#005F8D'], true)
                ) {
                    $missing[] = $field;
                }
            }
            $localLogo = trim((string)($row['logo_path'] ?? ''));
            $remoteLogo = trim((string)($row['logo_url'] ?? ''));
            if ($localLogo === ''
                || in_array(strtolower(basename($localLogo)), ['default-logo.png', 'defaultlogo.png'], true)
            ) {
                if ($remoteLogo === '') {
                    $missing[] = 'logo';
                }
            }
            if ($missing !== []) {
                $this->reporter->row('missing-branding.csv', [
                    'community_id' => (string)$row['id'],
                    'ipeds_unitid' => (string)($row['ipeds_unitid'] ?? ''),
                    'name' => (string)$row['name'],
                    'missing_fields' => implode('|', $missing),
                ]);
            }
        }
    }

    private function blank(mixed $value): bool
    {
        return $value === null || trim((string)$value) === '';
    }

    private function writeSourceErrors(string $source, object $result): void
    {
        foreach ((array)$result->errors() as $error) {
            $entry = is_array($error) ? $error : ['message' => (string)$error];
            $this->reporter->row('failed-requests.csv', [
                'source' => $source,
                'url' => $this->sanitizeUrl((string)($entry['url'] ?? '')),
                'category' => (string)($entry['category'] ?? 'source'),
                'http_status' => (string)($entry['http_status'] ?? ''),
                'attempts' => (string)($entry['attempts'] ?? ''),
                'message' => (string)($entry['message'] ?? 'Source request failed.'),
            ]);
            $this->reporter->error(
                $source,
                (string)($entry['category'] ?? 'source'),
                (string)($entry['message'] ?? 'Source request failed.')
            );
        }
    }

    private function logSourceException(string $source, string $stage, Throwable $error): void
    {
        $this->reporter->error($source, $stage, $error->getMessage());
        $this->structuredLog($source, $stage, ['message' => $error->getMessage()]);
    }

    /**
     * @param array<string, mixed> $context
     */
    private function structuredLog(string $source, string $event, array $context): void
    {
        $payload = array_merge([
            'component' => 'institution-data',
            'run_id' => $this->reporter->runId(),
            'source' => $source,
            'event' => $event,
            'at' => gmdate(DATE_ATOM),
        ], $context);
        error_log('[SRP institution-data] ' . json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        ));
    }

    private function sanitizeUrl(string $url): string
    {
        if ($url === '') {
            return '';
        }
        $parts = parse_url($url);
        if (!is_array($parts)) {
            return '';
        }
        $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
        $host = $parts['host'] ?? '';
        $path = $parts['path'] ?? '';
        return $scheme . $host . $path;
    }
}
