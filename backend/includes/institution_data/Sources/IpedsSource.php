<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/HttpClient.php';
require_once dirname(__DIR__) . '/SourceInterface.php';
require_once dirname(__DIR__) . '/SourceSupport.php';

/**
 * Canonical NCES/IPEDS HD (directory) ZIP importer.
 */
final class SrpInstitutionIpedsSource implements SrpInstitutionSourceInterface
{
    private const DISCOVERY_URL = 'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx?fromIpeds=true&gotoReportId=7';
    private const ARCHIVE_TEMPLATE = 'https://nces.ed.gov/ipeds/datacenter/data/HD%d.zip';

    /**
     * Destination field => HD CSV column. Callers may replace any mapping
     * through `ipeds.column_mappings` or fetch context `column_mappings`.
     *
     * @var array<string, string>
     */
    private const DEFAULT_COLUMNS = [
        'ipeds_unitid' => 'UNITID',
        'official_name' => 'INSTNM',
        'alternate_names' => 'IALIAS',
        'address' => 'ADDR',
        'city' => 'CITY',
        'state' => 'STABBR',
        'zip' => 'ZIP',
        'county' => 'COUNTYNM',
        'latitude' => 'LATITUDE',
        'longitude' => 'LONGITUD',
        'official_website' => 'WEBADDR',
        'phone' => 'GENTELE',
        'ope_id' => 'OPEID',
        'institution_sector' => 'SECTOR',
        'institution_level' => 'ICLEVEL',
        'institution_control' => 'CONTROL',
        'degree_granting' => 'DEGGRANT',
        'is_hbcu' => 'HBCU',
        'is_tribal_college' => 'TRIBAL',
        'operating_status' => 'ACT',
        'currently_active' => 'CYACTIVE',
        'closed_at' => 'CLOSEDAT',
    ];

    /** @var array<string, mixed>|object */
    private $config;
    private SrpInstitutionHttpClient $http;

    /**
     * @param array<string, mixed>|object $config
     */
    public function __construct(SrpInstitutionHttpClient $http, $config = [])
    {
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('IPEDS configuration must be an array or object.');
        }
        $this->http = $http;
        $this->config = $config;
    }

    public function name(): string
    {
        return 'ipeds';
    }

    /**
     * Supported context:
     *   file, url, year, state, unitid, limit, column_mappings.
     *
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        $warnings = [];
        $temporary = null;

        try {
            $file = isset($context['file']) ? trim((string)$context['file']) : '';
            $sourceUrl = null;
            $year = isset($context['year']) && is_numeric($context['year'])
                ? (int)$context['year']
                : null;
            $discoveredVia = 'local_file';
            $responseMetadata = [];

            if ($file === '') {
                $discovery = $this->discover($context, $warnings);
                $sourceUrl = $discovery['url'];
                $year = $discovery['year'];
                $discoveredVia = $discovery['discovered_via'];
                $maximumArchiveBytes = $this->integerConfig(
                    ['ipeds.max_archive_bytes', 'ipeds_max_archive_bytes'],
                    100 * 1024 * 1024,
                    1024,
                    500 * 1024 * 1024
                );
                $response = $this->http->get($sourceUrl, [
                    'headers' => [
                        'Accept' => 'application/x-zip-compressed, application/zip, '
                            . 'application/octet-stream, */*;q=0.5',
                    ],
                    'max_bytes' => $maximumArchiveBytes,
                    'cache' => true,
                    'cache_ttl' => $this->integerConfig(
                        ['ipeds.cache_ttl', 'ipeds_cache_ttl'],
                        7 * 86400,
                        0,
                        90 * 86400
                    ),
                    'minimum_interval' => $this->floatConfig(
                        ['ipeds.minimum_request_interval', 'ipeds_minimum_request_interval'],
                        0.25,
                        0.0,
                        60.0
                    ),
                ]);
                $body = $response->body();
                if (strlen($body) < 4 || substr($body, 0, 2) !== "PK") {
                    throw new UnexpectedValueException('The IPEDS directory download is not a ZIP archive.');
                }
                $temporary = tempnam(sys_get_temp_dir(), 'srp-ipeds-');
                if ($temporary === false || file_put_contents($temporary, $body, LOCK_EX) === false) {
                    throw new RuntimeException('Unable to stage the IPEDS ZIP archive.');
                }
                $file = $temporary;
                $responseMetadata = [
                    'http_status' => $response->statusCode(),
                    'http_attempts' => $response->attempts(),
                    'from_cache' => $response->fromCache(),
                ];
            } else {
                if (str_contains($file, "\0") || !is_file($file) || !is_readable($file)) {
                    throw new InvalidArgumentException('The configured IPEDS file is not readable.');
                }
                $maximumArchiveBytes = $this->integerConfig(
                    ['ipeds.max_archive_bytes', 'ipeds_max_archive_bytes'],
                    100 * 1024 * 1024,
                    1024,
                    500 * 1024 * 1024
                );
                $size = filesize($file);
                if ($size === false || $size < 1 || $size > $maximumArchiveBytes) {
                    throw new UnexpectedValueException('The local IPEDS file has an invalid size.');
                }
                if (isset($context['url'])) {
                    $candidateUrl = (string)$context['url'];
                    $sourceUrl = preg_match('#^https?://#i', $candidateUrl)
                        ? SrpInstitutionHttpClient::sanitizeUrl($candidateUrl)
                        : null;
                }
                if ($year === null && preg_match('/HD(\d{4})/i', basename($file), $matches) === 1) {
                    $year = (int)$matches[1];
                }
            }

            $parsed = $this->parseFile($file, $context, $sourceUrl, $year, $warnings);
            $rawArchive = $this->preserveRawArchive(
                $file,
                $context,
                $parsed['year'],
                $sourceUrl
            );
            $minimumCompleteRows = $this->integerConfig(
                ['ipeds.minimum_complete_snapshot_rows', 'ipeds_minimum_complete_snapshot_rows'],
                5000,
                1,
                100000
            );
            $expectedEntry = $parsed['year'] !== null
                && preg_match(
                    '#(?:^|/)HD' . preg_quote((string)$parsed['year'], '#') . '\.csv$#i',
                    $parsed['entry']
                ) === 1;
            $completeSnapshot = !$this->hasActiveFilter($context)
                && $expectedEntry
                && $parsed['rows_seen'] >= $minimumCompleteRows
                && count($parsed['records']) >= $minimumCompleteRows
                && $parsed['rows_filtered'] === 0
                && $parsed['malformed_rows'] === 0
                && $parsed['duplicate_unitids'] === 0;
            $sourceVersion = $parsed['year'] !== null
                ? 'HD' . $parsed['year']
                : 'HD-unknown';
            $metadata = array_merge([
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'source_url' => $sourceUrl,
                'source_version' => $sourceVersion,
                'reporting_year' => $parsed['year'],
                'complete_snapshot' => $completeSnapshot,
                'complete_snapshot_validation' => [
                    'minimum_rows' => $minimumCompleteRows,
                    'verified_hd_entry' => $expectedEntry,
                    'unfiltered' => !$this->hasActiveFilter($context),
                    'no_malformed_rows' => $parsed['malformed_rows'] === 0,
                    'no_duplicate_unitids' => $parsed['duplicate_unitids'] === 0,
                ],
                'archive_sha256' => hash_file('sha256', $file) ?: null,
                'archive_bytes' => filesize($file) ?: null,
                'archive_entry' => $parsed['entry'],
                'record_count' => count($parsed['records']),
                'rows_seen' => $parsed['rows_seen'],
                'rows_filtered' => $parsed['rows_filtered'],
                'malformed_rows' => $parsed['malformed_rows'],
                'duplicate_unitids' => $parsed['duplicate_unitids'],
                'columns' => $parsed['columns'],
                'column_mappings' => $parsed['mappings'],
                'discovered_via' => $discoveredVia,
            ], $responseMetadata, $rawArchive);

            return SrpInstitutionSourceResult::success(
                $this->name(),
                $parsed['records'],
                $metadata,
                $warnings
            );
        } catch (Throwable $error) {
            return SrpInstitutionSourceResult::failure($this->name(), $error, [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
            ]);
        } finally {
            if ($temporary !== null && is_file($temporary)) {
                @unlink($temporary);
            }
        }
    }

    /**
     * Public discovery seam for deterministic mocked tests and status tools.
     *
     * @param array<string, mixed> $context
     * @return array{url: string, year: int, discovered_via: string, warnings: list<string>}
     */
    public function discoverLatestArchive(array $context = []): array
    {
        $warnings = [];
        $result = $this->discover($context, $warnings);
        $result['warnings'] = $warnings;
        return $result;
    }

    /**
     * @param array<string, mixed> $context
     * @param list<string> $warnings
     * @return array{url: string, year: int, discovered_via: string}
     */
    private function discover(array $context, array &$warnings): array
    {
        $configuredUrl = trim((string)($context['url'] ?? SrpInstitutionSourceSupport::config(
            $this->config,
            ['ipeds.url', 'ipeds.data_url', 'ipeds_url'],
            ''
        )));
        if ($configuredUrl !== '') {
            if (!preg_match('#^https?://#i', $configuredUrl)) {
                throw new InvalidArgumentException('The configured IPEDS URL must use HTTP(S).');
            }
            $year = isset($context['year']) && is_numeric($context['year'])
                ? (int)$context['year']
                : $this->yearFromText($configuredUrl);
            if ($year === null) {
                throw new InvalidArgumentException('An IPEDS reporting year is required for a custom URL.');
            }
            return [
                'url' => $configuredUrl,
                'year' => $year,
                'discovered_via' => 'configured_url',
            ];
        }

        $template = (string)SrpInstitutionSourceSupport::config(
            $this->config,
            ['ipeds.archive_url_template', 'ipeds_url_template'],
            self::ARCHIVE_TEMPLATE
        );
        if (!str_contains($template, '%d')) {
            throw new InvalidArgumentException('IPEDS archive URL template must contain %d.');
        }

        if (isset($context['year']) && is_numeric($context['year'])) {
            $year = (int)$context['year'];
            if ($year < 1980 || $year > (int)gmdate('Y', (int)$this->http->now()) + 2) {
                throw new InvalidArgumentException('Invalid IPEDS reporting year.');
            }
            return [
                'url' => sprintf($template, $year),
                'year' => $year,
                'discovered_via' => 'requested_year',
            ];
        }

        $discoveryUrls = SrpInstitutionSourceSupport::config(
            $this->config,
            ['ipeds.discovery_urls', 'ipeds_discovery_urls'],
            [self::DISCOVERY_URL]
        );
        if (is_string($discoveryUrls)) {
            $discoveryUrls = [$discoveryUrls];
        }
        if (!is_array($discoveryUrls)) {
            $discoveryUrls = [self::DISCOVERY_URL];
        }

        $candidates = [];
        foreach ($discoveryUrls as $discoveryUrl) {
            if (!is_string($discoveryUrl) || !preg_match('#^https?://#i', $discoveryUrl)) {
                continue;
            }
            try {
                $response = $this->http->get($discoveryUrl, [
                    'headers' => ['Accept' => 'text/html,application/xhtml+xml'],
                    'max_bytes' => $this->integerConfig(
                        ['ipeds.max_discovery_bytes', 'ipeds_max_discovery_bytes'],
                        8 * 1024 * 1024,
                        1024,
                        25 * 1024 * 1024
                    ),
                    'cache' => true,
                    'cache_ttl' => 6 * 3600,
                    'max_retries' => 1,
                    'minimum_interval' => 0.25,
                ]);
                $html = $response->body();
                if (preg_match_all(
                    '#(?:href\s*=\s*["\']([^"\']*HD(20\d{2})\.zip[^"\']*)["\'])#i',
                    $html,
                    $matches,
                    PREG_SET_ORDER
                )) {
                    foreach ($matches as $match) {
                        $year = (int)$match[2];
                        $resolved = $this->resolveUrl($discoveryUrl, html_entity_decode($match[1], ENT_QUOTES));
                        if ($resolved !== null && $this->sameDiscoveryAuthority($discoveryUrl, $resolved)) {
                            $candidates[$year] = $resolved;
                        }
                    }
                }
                if (preg_match_all('/\bHD(20\d{2})\b/i', $html, $matches)) {
                    foreach ($matches[1] as $matchedYear) {
                        $year = (int)$matchedYear;
                        $candidates[$year] ??= sprintf($template, $year);
                    }
                }
            } catch (Throwable $error) {
                $warnings[] = 'IPEDS discovery page was unavailable; archive probing was used.';
            }
        }
        if ($candidates !== []) {
            krsort($candidates, SORT_NUMERIC);
            $year = (int)array_key_first($candidates);
            return [
                'url' => $candidates[$year],
                'year' => $year,
                'discovered_via' => 'nces_data_files_page',
            ];
        }

        // NCES exposes predictable HDYYYY.zip paths. Probe recent years when
        // its ASP.NET discovery page redirects or changes markup.
        $currentYear = (int)gmdate('Y', (int)$this->http->now());
        $lookback = $this->integerConfig(
            ['ipeds.discovery_lookback_years', 'ipeds_discovery_lookback_years'],
            10,
            1,
            30
        );
        for ($year = $currentYear + 1; $year >= $currentYear - $lookback; $year--) {
            $url = sprintf($template, $year);
            try {
                $response = $this->http->head($url, [
                    'throw_http_errors' => false,
                    'cache' => false,
                    'max_retries' => 1,
                    'minimum_interval' => 0.2,
                    'max_bytes' => 1024,
                ]);
                if ($response->statusCode() >= 200 && $response->statusCode() < 300) {
                    return [
                        'url' => $url,
                        'year' => $year,
                        'discovered_via' => 'archive_probe',
                    ];
                }
            } catch (Throwable $ignored) {
                // Probe the next earlier reporting year.
            }
        }
        throw new RuntimeException('Unable to discover a current IPEDS HD directory archive.');
    }

    /**
     * @param array<string, mixed> $context
     * @param list<string> $warnings
     * @return array{
     *   records: list<array<string, mixed>>,
     *   year: int|null,
     *   entry: string,
     *   rows_seen: int,
     *   rows_filtered: int,
     *   malformed_rows: int,
     *   duplicate_unitids: int,
     *   columns: list<string>,
     *   mappings: array<string, string>
     * }
     */
    private function parseFile(
        string $path,
        array $context,
        ?string $sourceUrl,
        ?int $year,
        array &$warnings
    ): array {
        $handle = null;
        $archive = null;
        $entry = basename($path);
        $maximumUncompressedBytes = $this->integerConfig(
            ['ipeds.max_uncompressed_bytes', 'ipeds_max_uncompressed_bytes'],
            150 * 1024 * 1024,
            1024,
            1024 * 1024 * 1024
        );

        $prefixHandle = fopen($path, 'rb');
        if ($prefixHandle === false) {
            throw new RuntimeException('Unable to open the IPEDS source file.');
        }
        $prefix = fread($prefixHandle, 4);
        fclose($prefixHandle);

        if (is_string($prefix) && str_starts_with($prefix, 'PK')) {
            if (!class_exists('ZipArchive')) {
                throw new RuntimeException('The ZIP extension is required to read IPEDS archives.');
            }
            $archive = new ZipArchive();
            if ($archive->open($path, ZipArchive::RDONLY) !== true) {
                throw new UnexpectedValueException('The IPEDS ZIP archive is corrupt or unreadable.');
            }
            $selected = null;
            $selectedYear = null;
            for ($index = 0; $index < $archive->numFiles; $index++) {
                $stat = $archive->statIndex($index);
                if (!is_array($stat)) {
                    continue;
                }
                $name = str_replace('\\', '/', (string)($stat['name'] ?? ''));
                if (str_contains($name, '../') || str_starts_with($name, '/')) {
                    continue;
                }
                if (preg_match('#(?:^|/)HD(20\d{2})\.csv$#i', $name, $matches) !== 1) {
                    continue;
                }
                $candidateYear = (int)$matches[1];
                if ($selected === null || $candidateYear > (int)$selectedYear) {
                    $selected = ['index' => $index, 'name' => $name, 'stat' => $stat];
                    $selectedYear = $candidateYear;
                }
            }
            if ($selected === null) {
                $archive->close();
                throw new UnexpectedValueException('The IPEDS ZIP has no HDYYYY.csv directory file.');
            }
            $uncompressedSize = (int)($selected['stat']['size'] ?? 0);
            $compressedSize = (int)($selected['stat']['comp_size'] ?? 0);
            if ($uncompressedSize < 1 || $uncompressedSize > $maximumUncompressedBytes) {
                $archive->close();
                throw new UnexpectedValueException('The IPEDS CSV has an unsafe uncompressed size.');
            }
            if ($compressedSize > 0 && ($uncompressedSize / $compressedSize) > 250) {
                $archive->close();
                throw new UnexpectedValueException('The IPEDS archive has an unsafe compression ratio.');
            }
            $entry = $selected['name'];
            $year = $selectedYear;
            $handle = $archive->getStream($entry);
            if (!is_resource($handle)) {
                $archive->close();
                throw new RuntimeException('Unable to stream the IPEDS directory CSV.');
            }
        } else {
            $size = filesize($path);
            if ($size === false || $size < 1 || $size > $maximumUncompressedBytes) {
                throw new UnexpectedValueException('The IPEDS CSV has an invalid size.');
            }
            $handle = fopen($path, 'rb');
            if ($handle === false) {
                throw new RuntimeException('Unable to open the IPEDS CSV.');
            }
        }

        try {
            return $this->parseCsvStream(
                $handle,
                $entry,
                $context,
                $sourceUrl,
                $year,
                $warnings
            );
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
            if ($archive instanceof ZipArchive) {
                $archive->close();
            }
        }
    }

    /**
     * @param resource $handle
     * @param array<string, mixed> $context
     * @param list<string> $warnings
     * @return array{
     *   records: list<array<string, mixed>>,
     *   year: int|null,
     *   entry: string,
     *   rows_seen: int,
     *   rows_filtered: int,
     *   malformed_rows: int,
     *   duplicate_unitids: int,
     *   columns: list<string>,
     *   mappings: array<string, string>
     * }
     */
    private function parseCsvStream(
        $handle,
        string $entry,
        array $context,
        ?string $sourceUrl,
        ?int $year,
        array &$warnings
    ): array {
        $header = fgetcsv($handle, 0, ',', '"', '');
        if (!is_array($header) || $header === []) {
            throw new UnexpectedValueException('The IPEDS CSV has no header row.');
        }
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string)$header[0]) ?? (string)$header[0];
        $columns = [];
        foreach ($header as $column) {
            $column = strtoupper(trim($this->utf8((string)$column)));
            if ($column === '' || isset($columns[$column])) {
                throw new UnexpectedValueException('The IPEDS CSV has blank or duplicate column names.');
            }
            $columns[$column] = count($columns);
        }

        $mappings = $this->columnMappings($context);
        foreach (['ipeds_unitid', 'official_name', 'city', 'state'] as $requiredField) {
            $column = strtoupper($mappings[$requiredField] ?? '');
            if ($column === '' || !array_key_exists($column, $columns)) {
                throw new UnexpectedValueException(
                    "The IPEDS CSV is missing required column mapping {$requiredField}."
                );
            }
        }

        $stateFilter = isset($context['state']) ? SrpInstitutionSourceSupport::state($context['state']) : null;
        if (isset($context['state']) && $stateFilter === null) {
            throw new InvalidArgumentException('IPEDS state filter must be a two-letter postal abbreviation.');
        }
        $unitIdFilter = isset($context['unitid'])
            ? SrpInstitutionSourceSupport::unitId($context['unitid'])
            : null;
        if (isset($context['unitid']) && $unitIdFilter === null) {
            throw new InvalidArgumentException('Invalid IPEDS UNITID filter.');
        }
        $unitIdFilters = [];
        if ($unitIdFilter !== null) {
            $unitIdFilters[$unitIdFilter] = true;
        }
        if (is_array($context['unitids'] ?? null)) {
            foreach ($context['unitids'] as $value) {
                $unitId = SrpInstitutionSourceSupport::unitId($value);
                if ($unitId === null) {
                    throw new InvalidArgumentException('IPEDS unitids filter contains an invalid UNITID.');
                }
                $unitIdFilters[$unitId] = true;
            }
        } elseif (isset($context['unitids']) && $context['unitids'] !== null) {
            throw new InvalidArgumentException('IPEDS unitids filter must be an array.');
        }
        $limit = isset($context['limit']) && is_numeric($context['limit'])
            ? max(1, (int)$context['limit'])
            : null;
        $maximumRows = $this->integerConfig(
            ['ipeds.max_rows', 'ipeds_max_rows'],
            25000,
            1,
            1000000
        );
        $maximumMalformed = $this->integerConfig(
            ['ipeds.max_malformed_rows', 'ipeds_max_malformed_rows'],
            25,
            0,
            10000
        );

        $records = [];
        $seenUnitIds = [];
        $rowsSeen = 0;
        $rowsFiltered = 0;
        $malformedRows = 0;
        $duplicates = 0;
        $retrievedAt = $this->http->nowAtom();

        while (($values = fgetcsv($handle, 0, ',', '"', '')) !== false) {
            if ($values === [null] || $values === []) {
                continue;
            }
            $rowsSeen++;
            if ($rowsSeen > $maximumRows) {
                throw new UnexpectedValueException('The IPEDS CSV exceeded the configured row limit.');
            }
            if (count($values) !== count($header)) {
                $malformedRows++;
                if ($malformedRows > $maximumMalformed) {
                    throw new UnexpectedValueException('The IPEDS CSV contains too many malformed rows.');
                }
                continue;
            }
            $row = [];
            foreach ($columns as $column => $index) {
                $row[$column] = $this->cleanSourceValue($values[$index] ?? null);
            }

            $unitId = SrpInstitutionSourceSupport::unitId(
                $row[strtoupper($mappings['ipeds_unitid'])] ?? null
            );
            $officialName = SrpInstitutionSourceSupport::text(
                $row[strtoupper($mappings['official_name'])] ?? null,
                255
            );
            $state = SrpInstitutionSourceSupport::state(
                $row[strtoupper($mappings['state'])] ?? null
            );
            if ($unitId === null || $officialName === null || $state === null) {
                $malformedRows++;
                if ($malformedRows > $maximumMalformed) {
                    throw new UnexpectedValueException('The IPEDS CSV has too many records missing identity fields.');
                }
                continue;
            }
            if (isset($seenUnitIds[$unitId])) {
                $duplicates++;
                continue;
            }
            $seenUnitIds[$unitId] = true;
            if (($stateFilter !== null && $state !== $stateFilter)
                || ($unitIdFilters !== [] && !isset($unitIdFilters[$unitId]))
            ) {
                $rowsFiltered++;
                continue;
            }

            $record = $this->mapRow(
                $row,
                $mappings,
                $unitId,
                $officialName,
                $state,
                $sourceUrl,
                $year,
                $retrievedAt,
                $rowsSeen + 1
            );
            $records[] = $record;
            if ($limit !== null && count($records) >= $limit) {
                break;
            }
        }

        if ($records === [] && $unitIdFilters === [] && $stateFilter === null) {
            throw new UnexpectedValueException('The IPEDS CSV produced no valid institution records.');
        }
        if ($malformedRows > 0) {
            $warnings[] = "{$malformedRows} malformed IPEDS rows were skipped.";
        }
        if ($duplicates > 0) {
            $warnings[] = "{$duplicates} duplicate IPEDS UNITIDs were skipped.";
        }

        return [
            'records' => $records,
            'year' => $year,
            'entry' => $entry,
            'rows_seen' => $rowsSeen,
            'rows_filtered' => $rowsFiltered,
            'malformed_rows' => $malformedRows,
            'duplicate_unitids' => $duplicates,
            'columns' => array_keys($columns),
            'mappings' => $mappings,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, string> $mappings
     * @return array<string, mixed>
     */
    private function mapRow(
        array $row,
        array $mappings,
        string $unitId,
        string $officialName,
        string $state,
        ?string $sourceUrl,
        ?int $year,
        string $retrievedAt,
        int $rowNumber
    ): array {
        $get = static function (string $field) use ($row, $mappings) {
            $column = strtoupper($mappings[$field] ?? '');
            return $column !== '' ? ($row[$column] ?? null) : null;
        };

        $city = SrpInstitutionSourceSupport::text($get('city'), 100);
        $address = SrpInstitutionSourceSupport::text($get('address'), 255);
        $zip = SrpInstitutionSourceSupport::normalizeField('zip', $get('zip'));
        $website = SrpInstitutionSourceSupport::url($get('official_website'));
        $domain = SrpInstitutionSourceSupport::domain($website);
        $opeId = SrpInstitutionSourceSupport::opeId($get('ope_id'));
        $aliases = $this->nameList($get('alternate_names'));
        $locationParts = array_values(array_filter([
            $address,
            $city,
            trim($state . ($zip !== null ? ' ' . $zip : '')),
        ], static fn($part): bool => is_string($part) && $part !== ''));
        $location = $locationParts !== [] ? implode(', ', $locationParts) : null;
        $activeCode = strtoupper((string)($get('currently_active') ?? ''));
        $statusCode = strtoupper((string)($get('operating_status') ?? ''));
        $closedAt = SrpInstitutionSourceSupport::text($get('closed_at'), 50);
        [$operatingStatus, $pipelineActive] = $this->operatingStatus(
            $statusCode,
            $activeCode,
            $closedAt
        );

        $fields = [];
        $add = static function (
            string $field,
            $value,
            float $confidence = 0.95,
            array $metadata = []
        ) use (&$fields, $sourceUrl, $unitId, $retrievedAt): void {
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                $field,
                $value,
                'ipeds',
                $sourceUrl,
                $unitId,
                $retrievedAt,
                $confidence,
                $metadata
            );
        };

        $add('ipeds_unitid', $unitId, 1.0);
        $add('official_name', $officialName);
        // Existing rows retain their platform display name unless the resolver
        // explicitly accepts this strong federal candidate.
        $add('name', $officialName);
        $add('aliases', $aliases);
        $add('alternate_names', $aliases);
        $add('address', $address);
        $add('city', $city);
        $add('state', $state);
        $add('zip', $zip);
        $add('county', $get('county'));
        $add('latitude', SrpInstitutionSourceSupport::float($get('latitude'), -90.0, 90.0));
        $add('longitude', SrpInstitutionSourceSupport::float($get('longitude'), -180.0, 180.0));
        $add('location', $location);
        $add('official_website', $website);
        $add('website', $website);
        $add('normalized_domain', $domain);
        $add('phone', $get('phone'));
        $add('ope_id', $opeId);
        $add(
            'institution_sector',
            $this->mappedCode($get('institution_sector'), $this->sectorLabels()),
            0.95,
            ['ipeds_code' => $get('institution_sector')]
        );
        $add(
            'institution_level',
            $this->mappedCode($get('institution_level'), [
                '1' => 'four_or_more_years',
                '2' => 'two_to_four_years',
                '3' => 'less_than_two_years',
            ]),
            0.95,
            ['ipeds_code' => $get('institution_level')]
        );
        $add(
            'institution_control',
            $this->mappedCode($get('institution_control'), [
                '1' => 'public',
                '2' => 'private_nonprofit',
                '3' => 'private_for_profit',
            ]),
            0.95,
            ['ipeds_code' => $get('institution_control')]
        );
        $add('degree_granting', SrpInstitutionSourceSupport::boolFromYesCode($get('degree_granting')));
        $add('is_hbcu', SrpInstitutionSourceSupport::boolFromYesCode($get('is_hbcu')));
        $add('is_tribal_college', SrpInstitutionSourceSupport::boolFromYesCode($get('is_tribal_college')));
        $add('operating_status', $operatingStatus, 0.95, [
            'ipeds_status_code' => $statusCode ?: null,
            'ipeds_currently_active_code' => $activeCode ?: null,
            'closed_at' => $closedAt,
        ]);
        $add('pipeline_active', $pipelineActive);
        $add('source_reporting_year', $year);

        $record = SrpInstitutionSourceSupport::record(
            $this->name(),
            $unitId,
            $retrievedAt,
            [
                'ipeds_unitid' => $unitId,
                'ope_id' => $opeId,
                'normalized_domain' => $domain,
                'name' => $officialName,
                'city' => $city,
                'state' => $state,
            ],
            $fields,
            [
                'reporting_year' => $year,
                'source_row_number' => $rowNumber,
                'ipeds_status_code' => $statusCode ?: null,
                'ipeds_currently_active_code' => $activeCode ?: null,
                'source_version' => $year !== null ? 'HD' . $year : 'HD-unknown',
                'reporting_year' => $year,
            ]
        );
        $record['source_version'] = $year !== null ? 'HD' . $year : 'HD-unknown';
        return $record;
    }

    /**
     * @param array<string, mixed> $context
     * @return array<string, string>
     */
    private function columnMappings(array $context): array
    {
        $configured = $context['column_mappings'] ?? SrpInstitutionSourceSupport::config(
            $this->config,
            ['ipeds.column_mappings', 'ipeds_column_mappings'],
            []
        );
        $mappings = self::DEFAULT_COLUMNS;
        if (!is_array($configured)) {
            throw new InvalidArgumentException('IPEDS column mappings must be an array.');
        }
        foreach ($configured as $field => $column) {
            if (!is_string($field) || !is_scalar($column)) {
                throw new InvalidArgumentException('Invalid IPEDS column mapping.');
            }
            $field = trim($field);
            $column = strtoupper(trim((string)$column));
            if ($field === '' || $column === '' || preg_match('/^[A-Z0-9_]+$/', $column) !== 1) {
                throw new InvalidArgumentException('Invalid IPEDS column mapping.');
            }
            if (array_key_exists($field, self::DEFAULT_COLUMNS)) {
                $mappings[$field] = $column;
            } elseif (array_key_exists(strtolower((string)$column), self::DEFAULT_COLUMNS)) {
                // Also accept source-column => destination-field configuration.
                $mappings[strtolower((string)$column)] = strtoupper($field);
            } else {
                $mappings[$field] = $column;
            }
        }
        return $mappings;
    }

    /**
     * @param mixed $value
     * @return list<string>|null
     */
    private function nameList($value): ?array
    {
        $text = SrpInstitutionSourceSupport::text($value, 5000);
        if ($text === null) {
            return null;
        }
        // IPEDS separates IALIAS entries with "/"; ";" and "|" appear in older
        // extracts. Without the slash the whole alias list is stored as one
        // unusable blob that no name match can ever hit.
        $parts = preg_split('#\s*[;|/]\s*#u', $text) ?: [];
        $result = [];
        $seen = [];
        foreach ($parts as $part) {
            $part = SrpInstitutionSourceSupport::text($part, 255);
            if ($part === null || mb_strlen($part, 'UTF-8') < 2) {
                continue;
            }
            $identity = mb_strtolower(preg_replace('/\W+/u', '', $part) ?? $part, 'UTF-8');
            if ($identity !== '' && !isset($seen[$identity])) {
                $seen[$identity] = true;
                $result[] = $part;
            }
        }
        return $result !== [] ? $result : null;
    }

    /**
     * @return array{0: string, 1: bool|null}
     */
    private function operatingStatus(string $statusCode, string $activeCode, ?string $closedAt): array
    {
        if ($closedAt !== null && !in_array($closedAt, ['-2', '-3'], true)) {
            return ['closed', false];
        }
        if (in_array($statusCode, ['C', 'Q'], true)) {
            return ['closed', false];
        }
        if ($statusCode === 'M') {
            return ['merged', false];
        }
        if ($activeCode === '1' || in_array($statusCode, ['A', 'N', 'R'], true)) {
            return [
                match ($statusCode) {
                    'N' => 'newly_active',
                    'R' => 'restored',
                    default => 'active',
                },
                true,
            ];
        }
        if (in_array($activeCode, ['0', '2'], true)) {
            return ['inactive', false];
        }
        return ['status_unknown', null];
    }

    /**
     * @param mixed $code
     * @param array<string, string> $labels
     */
    private function mappedCode($code, array $labels): ?string
    {
        $code = trim((string)$code);
        if ($code === '' || in_array($code, ['-2', '-3'], true)) {
            return null;
        }
        return $labels[$code] ?? 'ipeds_code_' . preg_replace('/[^a-z0-9]+/i', '_', strtolower($code));
    }

    /**
     * @return array<string, string>
     */
    private function sectorLabels(): array
    {
        return [
            '0' => 'administrative_unit',
            '1' => 'public_four_year_or_above',
            '2' => 'private_nonprofit_four_year_or_above',
            '3' => 'private_for_profit_four_year_or_above',
            '4' => 'public_two_year',
            '5' => 'private_nonprofit_two_year',
            '6' => 'private_for_profit_two_year',
            '7' => 'public_less_than_two_year',
            '8' => 'private_nonprofit_less_than_two_year',
            '9' => 'private_for_profit_less_than_two_year',
            '99' => 'sector_unknown_non_degree_granting',
        ];
    }

    /**
     * @param mixed $value
     * @return mixed
     */
    private function cleanSourceValue($value)
    {
        if ($value === null) {
            return null;
        }
        $value = trim($this->utf8((string)$value));
        return $value === '' || in_array(strtoupper($value), ['NULL', 'NA', 'N/A'], true)
            ? null
            : $value;
    }

    private function utf8(string $value): string
    {
        if (mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }
        return mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
    }

    private function yearFromText(string $value): ?int
    {
        return preg_match('/HD(20\d{2})/i', $value, $matches) === 1
            ? (int)$matches[1]
            : null;
    }

    private function resolveUrl(string $base, string $reference): ?string
    {
        if (preg_match('#^https?://#i', $reference)) {
            return $reference;
        }
        $parts = parse_url($base);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        $origin = strtolower((string)$parts['scheme']) . '://' . strtolower((string)$parts['host']);
        if (isset($parts['port'])) {
            $origin .= ':' . (int)$parts['port'];
        }
        if (str_starts_with($reference, '//')) {
            return strtolower((string)$parts['scheme']) . ':' . $reference;
        }
        if (str_starts_with($reference, '/')) {
            return $origin . $reference;
        }
        $basePath = (string)($parts['path'] ?? '/');
        return $origin . rtrim(str_replace('\\', '/', dirname($basePath)), '/') . '/' . ltrim($reference, '/');
    }

    private function sameDiscoveryAuthority(string $base, string $candidate): bool
    {
        return strtolower((string)parse_url($base, PHP_URL_HOST))
            === strtolower((string)parse_url($candidate, PHP_URL_HOST));
    }

    /**
     * Retain the exact downloaded/local source snapshot and a small atomic
     * manifest when the pipeline supplied its private raw-data directory.
     *
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    private function preserveRawArchive(
        string $sourcePath,
        array $context,
        ?int $year,
        ?string $sourceUrl
    ): array {
        $rawRoot = $context['raw_data_path'] ?? SrpInstitutionSourceSupport::config(
            $this->config,
            ['raw_data_path', 'paths.raw_data', 'ipeds.raw_data_path'],
            null
        );
        if (!is_string($rawRoot) || trim($rawRoot) === '') {
            return [
                'raw_archive_preserved' => false,
                'raw_archive_path' => null,
                'raw_manifest_path' => null,
            ];
        }
        $rawRoot = rtrim(trim($rawRoot), DIRECTORY_SEPARATOR);
        if ($rawRoot === '' || str_contains($rawRoot, "\0")) {
            throw new InvalidArgumentException('IPEDS raw-data path is invalid.');
        }
        $directory = $rawRoot . DIRECTORY_SEPARATOR . 'ipeds';
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create the private IPEDS raw-data directory.');
        }
        if (!is_writable($directory)) {
            throw new RuntimeException('The private IPEDS raw-data directory is not writable.');
        }

        $sha256 = hash_file('sha256', $sourcePath);
        $bytes = filesize($sourcePath);
        if (!is_string($sha256) || $sha256 === '' || $bytes === false || $bytes < 1) {
            throw new RuntimeException('Unable to checksum the IPEDS raw source.');
        }
        $handle = fopen($sourcePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Unable to inspect the IPEDS raw source.');
        }
        $prefix = fread($handle, 4);
        fclose($handle);
        $extension = is_string($prefix) && str_starts_with($prefix, 'PK') ? 'zip' : 'csv';
        $sourceVersion = $year !== null ? 'HD' . $year : 'HD-unknown';
        $base = $sourceVersion . '-' . substr($sha256, 0, 16);
        $archivePath = $directory . DIRECTORY_SEPARATOR . $base . '.' . $extension;
        if (!is_file($archivePath)) {
            $temporary = $archivePath . '.tmp-' . bin2hex(random_bytes(5));
            if (!copy($sourcePath, $temporary)) {
                throw new RuntimeException('Unable to copy the IPEDS raw source atomically.');
            }
            @chmod($temporary, 0660);
            if (hash_file('sha256', $temporary) !== $sha256 || !rename($temporary, $archivePath)) {
                @unlink($temporary);
                throw new RuntimeException('Unable to publish the preserved IPEDS raw source.');
            }
        } elseif (hash_file('sha256', $archivePath) !== $sha256) {
            throw new RuntimeException('An existing preserved IPEDS source has an unexpected checksum.');
        }

        $manifestPath = $directory . DIRECTORY_SEPARATOR . $base . '.manifest.json';
        $manifest = [
            'source' => $this->name(),
            'source_version' => $sourceVersion,
            'reporting_year' => $year,
            'source_url' => $sourceUrl,
            'retrieved_at' => $this->http->nowAtom(),
            'sha256' => $sha256,
            'bytes' => $bytes,
            'archive_filename' => basename($archivePath),
            'original_filename' => basename($sourcePath),
        ];
        $encoded = json_encode(
            $manifest,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ) . PHP_EOL;
        $temporaryManifest = $manifestPath . '.tmp-' . bin2hex(random_bytes(5));
        if (file_put_contents($temporaryManifest, $encoded, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write the IPEDS raw-source manifest.');
        }
        @chmod($temporaryManifest, 0660);
        if (!rename($temporaryManifest, $manifestPath)) {
            @unlink($temporaryManifest);
            throw new RuntimeException('Unable to publish the IPEDS raw-source manifest.');
        }

        return [
            'raw_archive_preserved' => true,
            'raw_archive_path' => $archivePath,
            'raw_manifest_path' => $manifestPath,
        ];
    }

    /**
     * @param array<string, mixed> $context
     */
    private function hasActiveFilter(array $context): bool
    {
        if (isset($context['state']) && trim((string)$context['state']) !== '') {
            return true;
        }
        if (isset($context['unitid']) && trim((string)$context['unitid']) !== '') {
            return true;
        }
        if (is_array($context['unitids'] ?? null) && $context['unitids'] !== []) {
            return true;
        }
        return isset($context['limit']) && is_numeric($context['limit']) && (int)$context['limit'] > 0;
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

// Short aliases keep hand-written integrations readable without introducing
// a second implementation or namespace.
if (!class_exists('SrpIpedsSource', false)) {
    class_alias(SrpInstitutionIpedsSource::class, 'SrpIpedsSource');
}
