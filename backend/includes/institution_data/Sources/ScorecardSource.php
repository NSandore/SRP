<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/HttpClient.php';
require_once dirname(__DIR__) . '/SourceInterface.php';
require_once dirname(__DIR__) . '/SourceSupport.php';

/**
 * Optional, key-gated College Scorecard bulk-page enrichment.
 */
final class SrpInstitutionScorecardSource implements SrpInstitutionSourceInterface
{
    private const ENDPOINT = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';
    /** @var list<string> */
    private const DEFAULT_FIELDS = [
        'id',
        'ope6_id',
        'ope8_id',
        'school.name',
        'school.city',
        'school.state',
        'school.zip',
        'school.school_url',
        'school.ownership',
        'school.operating',
        'school.accreditor',
        'school.federal_school_code',
    ];

    private SrpInstitutionHttpClient $http;
    /** @var array<string, mixed>|object */
    private $config;

    /**
     * @param array<string, mixed>|object $config
     */
    public function __construct(SrpInstitutionHttpClient $http, $config = [])
    {
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('Scorecard configuration must be an array or object.');
        }
        $this->http = $http;
        $this->config = $config;
    }

    public function name(): string
    {
        return 'scorecard';
    }

    /**
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        $apiKey = trim((string)($context['api_key'] ?? SrpInstitutionSourceSupport::config(
            $this->config,
            ['data_gov_api_key', 'scorecard.api_key', 'scorecard_api_key'],
            getenv('DATA_GOV_API_KEY') ?: ''
        )));
        if ($apiKey === '') {
            return SrpInstitutionSourceResult::skipped(
                $this->name(),
                'DATA_GOV_API_KEY is not configured; College Scorecard enrichment was skipped.',
                [
                    'started_at' => $startedAt,
                    'finished_at' => $this->http->nowAtom(),
                    'key_required' => true,
                ]
            );
        }

        try {
            $endpoint = trim((string)SrpInstitutionSourceSupport::config(
                $this->config,
                ['scorecard.endpoint', 'scorecard_endpoint'],
                self::ENDPOINT
            ));
            if (!preg_match('#^https://#i', $endpoint)) {
                throw new InvalidArgumentException('College Scorecard endpoint must use HTTPS.');
            }
            $perPage = $this->integerConfig(
                ['scorecard.per_page', 'scorecard_per_page'],
                100,
                1,
                100
            );
            $maxPages = $this->integerConfig(
                ['scorecard.max_pages', 'scorecard_max_pages'],
                100,
                1,
                1000
            );
            $fields = $this->configuredFields();
            $queryBase = [
                'api_key' => $apiKey,
                'fields' => implode(',', $fields),
                '_per_page' => $perPage,
            ];

            $stateFilter = isset($context['state'])
                ? SrpInstitutionSourceSupport::state($context['state'])
                : null;
            if (isset($context['state']) && $stateFilter === null) {
                throw new InvalidArgumentException('Scorecard state filter must be a postal abbreviation.');
            }
            if ($stateFilter !== null) {
                $queryBase['school.state'] = $stateFilter;
            }
            $unitIdFilter = isset($context['unitid'])
                ? SrpInstitutionSourceSupport::unitId($context['unitid'])
                : null;
            if (isset($context['unitid']) && $unitIdFilter === null) {
                throw new InvalidArgumentException('Invalid Scorecard UNITID filter.');
            }
            $unitIds = $this->unitIdsFromContext($context);
            if ($unitIdFilter !== null) {
                $unitIds = [$unitIdFilter];
            }
            if ($unitIds !== []) {
                // Open Data Maker accepts comma-separated values for an exact
                // field filter. Results are still checked locally below.
                $queryBase['id'] = implode(',', $unitIds);
            }
            $allowedUnitIds = $unitIds !== [] ? array_fill_keys($unitIds, true) : [];
            $limit = isset($context['limit']) && is_numeric($context['limit'])
                ? max(1, (int)$context['limit'])
                : null;

            $records = [];
            $seen = [];
            $warnings = [];
            $errors = [];
            $pagesFetched = 0;
            $reportedTotal = null;
            $page = 0;
            $retrievedAt = $this->http->nowAtom();

            while ($page < $maxPages) {
                $query = $queryBase;
                $query['page'] = $page;
                $url = $endpoint . (str_contains($endpoint, '?') ? '&' : '?')
                    . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
                try {
                    $response = $this->http->get($url, [
                        'headers' => ['Accept' => 'application/json'],
                        'max_bytes' => $this->integerConfig(
                            ['scorecard.max_page_bytes', 'scorecard_max_page_bytes'],
                            15 * 1024 * 1024,
                            1024,
                            100 * 1024 * 1024
                        ),
                        'cache' => true,
                        'cache_ttl' => $this->integerConfig(
                            ['scorecard.cache_ttl', 'scorecard_cache_ttl'],
                            3 * 86400,
                            0,
                            30 * 86400
                        ),
                        'minimum_interval' => $this->floatConfig(
                            ['scorecard.minimum_request_interval', 'scorecard_minimum_request_interval'],
                            0.2,
                            0.0,
                            60.0
                        ),
                    ]);
                    $payload = $response->json();
                } catch (Throwable $error) {
                    if ($records === []) {
                        throw $error;
                    }
                    $errors[] = $error;
                    $warnings[] = "College Scorecard page {$page} failed; earlier pages were retained.";
                    break;
                }

                if (!isset($payload['results']) || !is_array($payload['results'])) {
                    throw new UnexpectedValueException('College Scorecard response has no results array.');
                }
                $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];
                if (isset($metadata['total']) && is_numeric($metadata['total'])) {
                    $reportedTotal = max(0, (int)$metadata['total']);
                }
                $pageResults = $payload['results'];
                $pagesFetched++;
                if ($pageResults === []) {
                    break;
                }

                foreach ($pageResults as $index => $raw) {
                    if (!is_array($raw)) {
                        $warnings[] = "College Scorecard page {$page} contained a non-object record.";
                        continue;
                    }
                    $record = $this->mapRecord(
                        $raw,
                        $endpoint,
                        $retrievedAt,
                        $page,
                        (int)$index
                    );
                    if ($record === null) {
                        $warnings[] = "College Scorecard page {$page} contained a record without a valid ID.";
                        continue;
                    }
                    $unitId = (string)$record['match']['ipeds_unitid'];
                    if ($allowedUnitIds !== [] && !isset($allowedUnitIds[$unitId])) {
                        continue;
                    }
                    if ($stateFilter !== null && $record['match']['state'] !== $stateFilter) {
                        continue;
                    }
                    if (isset($seen[$record['source_record_id']])) {
                        continue;
                    }
                    $seen[$record['source_record_id']] = true;
                    $records[] = $record;
                    if ($limit !== null && count($records) >= $limit) {
                        break 2;
                    }
                }

                $page++;
                if ($reportedTotal !== null && ($page * $perPage) >= $reportedTotal) {
                    break;
                }
                if (count($pageResults) < $perPage) {
                    break;
                }
            }
            if ($page >= $maxPages
                && $reportedTotal !== null
                && ($pagesFetched * $perPage) < $reportedTotal
            ) {
                $warnings[] = 'College Scorecard pagination stopped at the configured page limit.';
            }

            $resultMetadata = [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'source_url' => $endpoint,
                'record_count' => count($records),
                'pages_fetched' => $pagesFetched,
                'reported_total' => $reportedTotal,
                'per_page' => $perPage,
                'fields' => $fields,
                'filters' => [
                    'state' => $stateFilter,
                    'unitids' => $unitIds,
                    'limit' => $limit,
                ],
            ];
            return $errors === []
                ? SrpInstitutionSourceResult::success(
                    $this->name(),
                    $records,
                    $resultMetadata,
                    $warnings
                )
                : SrpInstitutionSourceResult::partial(
                    $this->name(),
                    $records,
                    $errors,
                    $resultMetadata,
                    $warnings
                );
        } catch (Throwable $error) {
            return SrpInstitutionSourceResult::failure($this->name(), $error, [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'source_url' => self::ENDPOINT,
            ]);
        }
    }

    /**
     * @param array<string, mixed> $raw
     * @return array<string, mixed>|null
     */
    private function mapRecord(
        array $raw,
        string $sourceUrl,
        string $retrievedAt,
        int $page,
        int $index
    ): ?array {
        $unitId = SrpInstitutionSourceSupport::unitId($this->clean($raw['id'] ?? null));
        if ($unitId === null) {
            return null;
        }
        $name = SrpInstitutionSourceSupport::text($this->clean($raw['school.name'] ?? null), 255);
        $city = SrpInstitutionSourceSupport::text($this->clean($raw['school.city'] ?? null), 100);
        $state = SrpInstitutionSourceSupport::state($this->clean($raw['school.state'] ?? null));
        $website = SrpInstitutionSourceSupport::url($this->clean($raw['school.school_url'] ?? null));
        $domain = SrpInstitutionSourceSupport::domain($website);
        $opeId = SrpInstitutionSourceSupport::opeId(
            $this->clean($raw['ope8_id'] ?? $raw['ope6_id'] ?? null)
        );
        $ownershipCode = $this->clean($raw['school.ownership'] ?? null);
        $control = match ((string)$ownershipCode) {
            '1' => 'public',
            '2' => 'private_nonprofit',
            '3' => 'private_for_profit',
            default => null,
        };
        $operatingRaw = $this->clean($raw['school.operating'] ?? null);
        $active = SrpInstitutionSourceSupport::boolFromYesCode($operatingRaw);
        $operatingStatus = $active === true ? 'active' : ($active === false ? 'inactive' : null);

        $fields = [];
        $add = static function (
            string $field,
            $value,
            float $confidence = 0.90,
            array $metadata = []
        ) use (&$fields, $sourceUrl, $unitId, $retrievedAt): void {
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                $field,
                $value,
                'college_scorecard',
                $sourceUrl,
                $unitId,
                $retrievedAt,
                $confidence,
                $metadata
            );
        };
        $add('college_scorecard_id', $unitId, 1.0);
        $add('ipeds_unitid', $unitId, 1.0);
        $add('official_name', $name);
        $add('name', $name);
        $add('city', $city);
        $add('state', $state);
        $add('zip', $this->clean($raw['school.zip'] ?? null));
        $add('official_website', $website);
        $add('website', $website);
        $add('normalized_domain', $domain);
        $add('ope_id', $opeId);
        $add('institution_control', $control, 0.90, ['scorecard_code' => $ownershipCode]);
        $add('operating_status', $operatingStatus, 0.90, ['scorecard_code' => $operatingRaw]);
        $add('pipeline_active', $active);
        $add('accreditor', $this->clean($raw['school.accreditor'] ?? null));
        $add('federal_school_code', $this->clean($raw['school.federal_school_code'] ?? null));

        return SrpInstitutionSourceSupport::record(
            $this->name(),
            $unitId,
            $retrievedAt,
            [
                'ipeds_unitid' => $unitId,
                'ope_id' => $opeId,
                'normalized_domain' => $domain,
                'name' => $name,
                'city' => $city,
                'state' => $state,
            ],
            $fields,
            [
                'page' => $page,
                'page_index' => $index,
                'ownership_code' => $ownershipCode,
                'operating_code' => $operatingRaw,
            ]
        );
    }

    /**
     * @param mixed $value
     * @return mixed
     */
    private function clean($value)
    {
        if ($value === null || is_array($value) || is_object($value)) {
            return null;
        }
        $text = trim((string)$value);
        if ($text === ''
            || in_array(strtoupper($text), ['NULL', 'NA', 'N/A', 'PS', 'PRIVACYSUPPRESSED'], true)
        ) {
            return null;
        }
        return $value;
    }

    /**
     * @return list<string>
     */
    private function configuredFields(): array
    {
        $fields = SrpInstitutionSourceSupport::config(
            $this->config,
            ['scorecard.fields', 'scorecard_fields'],
            self::DEFAULT_FIELDS
        );
        if (is_string($fields)) {
            $fields = preg_split('/\s*,\s*/', $fields) ?: [];
        }
        if (!is_array($fields)) {
            throw new InvalidArgumentException('College Scorecard fields must be an array or CSV string.');
        }
        $normalized = [];
        foreach (array_merge(self::DEFAULT_FIELDS, $fields) as $field) {
            $field = trim((string)$field);
            if ($field !== ''
                && preg_match('/^[a-zA-Z0-9_.]+$/', $field) === 1
                && !in_array($field, $normalized, true)
            ) {
                $normalized[] = $field;
            }
        }
        return $normalized;
    }

    /**
     * @param array<string, mixed> $context
     * @return list<string>
     */
    private function unitIdsFromContext(array $context): array
    {
        $values = is_array($context['unitids'] ?? null) ? $context['unitids'] : [];
        $unitIds = [];
        foreach ($values as $value) {
            $unitId = SrpInstitutionSourceSupport::unitId($value);
            if ($unitId !== null && !in_array($unitId, $unitIds, true)) {
                $unitIds[] = $unitId;
            }
        }
        return $unitIds;
    }

    /**
     * @param list<string> $keys
     */
    private function integerConfig(
        array $keys,
        int $default,
        int $minimum,
        int $maximum
    ): int {
        $value = SrpInstitutionSourceSupport::config($this->config, $keys, $default);
        return is_numeric($value) ? max($minimum, min($maximum, (int)$value)) : $default;
    }

    /**
     * @param list<string> $keys
     */
    private function floatConfig(
        array $keys,
        float $default,
        float $minimum,
        float $maximum
    ): float {
        $value = SrpInstitutionSourceSupport::config($this->config, $keys, $default);
        return is_numeric($value) ? max($minimum, min($maximum, (float)$value)) : $default;
    }
}

if (!class_exists('SrpScorecardSource', false)) {
    class_alias(SrpInstitutionScorecardSource::class, 'SrpScorecardSource');
}
