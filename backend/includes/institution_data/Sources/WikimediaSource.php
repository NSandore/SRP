<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/HttpClient.php';
require_once dirname(__DIR__) . '/SourceInterface.php';
require_once dirname(__DIR__) . '/SourceSupport.php';

/**
 * Batched Wikimedia Commons imageinfo and license-metadata enrichment.
 */
final class SrpInstitutionWikimediaSource implements SrpInstitutionSourceInterface
{
    private const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

    private SrpInstitutionHttpClient $http;
    /** @var array<string, mixed>|object */
    private $config;

    /**
     * @param array<string, mixed>|object $config
     */
    public function __construct(SrpInstitutionHttpClient $http, $config = [])
    {
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('Wikimedia configuration must be an array or object.');
        }
        $this->http = $http;
        $this->config = $config;
    }

    public function name(): string
    {
        return 'wikimedia';
    }

    /**
     * Context accepts files, universities, and Wikidata previous_results.
     *
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        try {
            $files = $this->filesFromContext($context);
            if ($files === []) {
                return SrpInstitutionSourceResult::skipped(
                    $this->name(),
                    'No Wikidata logo or seal filenames were available for Wikimedia lookup.',
                    [
                        'started_at' => $startedAt,
                        'finished_at' => $this->http->nowAtom(),
                    ]
                );
            }
            $endpoint = trim((string)SrpInstitutionSourceSupport::config(
                $this->config,
                ['wikimedia.endpoint', 'wikimedia_endpoint'],
                self::ENDPOINT
            ));
            if (!preg_match('#^https://#i', $endpoint)) {
                throw new InvalidArgumentException('Wikimedia API endpoint must use HTTPS.');
            }
            // Thumbnail imageinfo is capped at 50 titles by MediaWiki. A
            // default of 25 also keeps GET URLs within conservative proxy limits.
            $batchSize = $this->integerConfig(
                ['wikimedia.batch_size', 'wikimedia_batch_size'],
                25,
                1,
                50
            );
            $thumbnailWidth = $this->integerConfig(
                ['wikimedia.thumbnail_width', 'wikimedia_thumbnail_width'],
                512,
                32,
                2048
            );

            $records = [];
            $warnings = [];
            $errors = [];
            $found = [];
            $batchesCompleted = 0;
            $licenseIssues = 0;
            $retrievedAt = $this->http->nowAtom();
            foreach (array_chunk(array_values($files), $batchSize) as $batchIndex => $batch) {
                try {
                    $payload = $this->requestBatch($endpoint, $batch, $thumbnailWidth);
                    $batchRecords = $this->parsePages(
                        $payload,
                        $batch,
                        $endpoint,
                        $retrievedAt,
                        (int)$batchIndex
                    );
                    foreach ($batchRecords as $record) {
                        $records[] = $record;
                        $found[$record['raw_metadata']['requested_file_identity']] = true;
                        if (($record['raw_metadata']['license_permits_redistribution'] ?? false) !== true) {
                            $licenseIssues++;
                        }
                    }
                    $batchesCompleted++;
                } catch (Throwable $error) {
                    $errors[] = $error;
                    $warnings[] = 'A Wikimedia metadata batch failed; completed batches were retained.';
                }
            }
            $missing = [];
            foreach ($files as $identity => $file) {
                if (!isset($found[$identity])) {
                    $missing[] = $file['file'];
                }
            }
            if ($missing !== []) {
                $warnings[] = count($missing) . ' Commons files were missing or had no imageinfo metadata.';
            }
            if ($licenseIssues > 0) {
                $warnings[] = "{$licenseIssues} Commons logo candidates require license review.";
            }

            $metadata = [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'source_url' => $endpoint,
                'files_requested' => count($files),
                'files_found' => count($records),
                'missing_files' => $missing,
                'license_issues' => $licenseIssues,
                'batch_size' => $batchSize,
                'batches_requested' => (int)ceil(count($files) / $batchSize),
                'batches_completed' => $batchesCompleted,
                'thumbnail_width' => $thumbnailWidth,
            ];
            if ($errors !== [] && $records === []) {
                return SrpInstitutionSourceResult::failure($this->name(), $errors[0], $metadata);
            }
            return $errors === []
                ? SrpInstitutionSourceResult::success(
                    $this->name(),
                    $records,
                    $metadata,
                    $warnings
                )
                : SrpInstitutionSourceResult::partial(
                    $this->name(),
                    $records,
                    $errors,
                    $metadata,
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
     * Copyright-license assessment is public so validation/report commands can
     * apply the same deterministic policy to stored candidates.
     *
     * @param array<string, mixed> $metadata
     * @return array{permitted: bool, status: string, reason: string}
     */
    public function assessLicense(array $metadata): array
    {
        $name = strtolower(trim((string)($metadata['license_name'] ?? '')));
        $url = strtolower(trim((string)($metadata['license_url'] ?? '')));
        $usage = strtolower(trim((string)($metadata['usage_terms'] ?? '')));
        $combined = implode(' ', [$name, $url, $usage]);
        if ($combined === '') {
            return [
                'permitted' => false,
                'status' => 'missing',
                'reason' => 'No machine-readable copyright license was supplied by Commons.',
            ];
        }
        if (preg_match('/fair[\s_-]*use|non[\s_-]*free|all rights reserved|copyrighted free use/i', $combined)) {
            return [
                'permitted' => false,
                'status' => 'restricted',
                'reason' => 'The Commons metadata identifies a non-free or restricted-use work.',
            ];
        }
        if (preg_match(
            '/public[\s_-]*domain|\bcc0\b|creativecommons\.org\/publicdomain|'
            . 'cc[\s_-]*by(?:[\s_-]*sa)?|creativecommons\.org\/licenses\/by|'
            . '\bgfdl\b|gnu free documentation/i',
            $combined
        )) {
            return [
                'permitted' => true,
                'status' => 'licensed',
                'reason' => 'Commons supplied a recognized redistribution license.',
            ];
        }
        return [
            'permitted' => false,
            'status' => 'unknown',
            'reason' => 'The supplied Commons license is not on the configured redistribution allowlist.',
        ];
    }

    /**
     * @param list<array<string, mixed>> $batch
     * @return array<string, mixed>|list<mixed>
     */
    private function requestBatch(string $endpoint, array $batch, int $thumbnailWidth): array
    {
        $titles = array_map(
            static fn(array $entry): string => 'File:' . $entry['file'],
            $batch
        );
        $query = [
            'action' => 'query',
            'format' => 'json',
            'formatversion' => 2,
            'redirects' => 1,
            'prop' => 'imageinfo',
            'titles' => implode('|', $titles),
            'iiprop' => 'url|size|mime|mediatype|extmetadata|user|sha1',
            'iiurlwidth' => $thumbnailWidth,
            'iimetadataversion' => 'latest',
            'iiextmetadatalanguage' => 'en',
            'iiextmetadatafilter' => implode('|', [
                'LicenseShortName',
                'LicenseUrl',
                'UsageTerms',
                'Artist',
                'Credit',
                'Attribution',
                'Copyrighted',
                'Restrictions',
                'ImageDescription',
            ]),
        ];
        $url = $endpoint . (str_contains($endpoint, '?') ? '&' : '?')
            . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        return $this->http->get($url, [
            'headers' => ['Accept' => 'application/json'],
            'max_bytes' => $this->integerConfig(
                ['wikimedia.max_response_bytes', 'wikimedia_max_response_bytes'],
                15 * 1024 * 1024,
                1024,
                100 * 1024 * 1024
            ),
            'cache' => true,
            'cache_ttl' => $this->integerConfig(
                ['wikimedia.cache_ttl', 'wikimedia_cache_ttl'],
                14 * 86400,
                0,
                180 * 86400
            ),
            'minimum_interval' => $this->floatConfig(
                ['wikimedia.minimum_request_interval', 'wikimedia_minimum_request_interval'],
                0.25,
                0.0,
                60.0
            ),
        ])->json();
    }

    /**
     * @param array<string, mixed>|list<mixed> $payload
     * @param list<array<string, mixed>> $batch
     * @return list<array<string, mixed>>
     */
    private function parsePages(
        array $payload,
        array $batch,
        string $endpoint,
        string $retrievedAt,
        int $batchIndex
    ): array {
        $pages = $payload['query']['pages'] ?? null;
        if (!is_array($pages)) {
            throw new UnexpectedValueException('Wikimedia response has no query.pages array.');
        }
        // formatversion=1 fixtures use a pageid-keyed object; values are the
        // same shape, so normalize both forms.
        $pages = array_values($pages);
        $requested = [];
        foreach ($batch as $entry) {
            $requested[$this->fileIdentity((string)$entry['file'])] = $entry;
        }
        $normalized = is_array($payload['query']['normalized'] ?? null)
            ? $payload['query']['normalized']
            : [];
        $normalizationMap = [];
        foreach ($normalized as $mapping) {
            if (is_array($mapping) && isset($mapping['from'], $mapping['to'])) {
                $normalizationMap[$this->fileIdentity((string)$mapping['to'])] =
                    $this->fileIdentity((string)$mapping['from']);
            }
        }

        $records = [];
        foreach ($pages as $page) {
            if (!is_array($page)
                || isset($page['missing'])
                || !is_array($page['imageinfo'][0] ?? null)
            ) {
                continue;
            }
            $title = preg_replace('/^File:/i', '', (string)($page['title'] ?? '')) ?? '';
            $pageIdentity = $this->fileIdentity($title);
            $requestedIdentity = $normalizationMap[$pageIdentity] ?? $pageIdentity;
            $entry = $requested[$requestedIdentity] ?? $requested[$pageIdentity] ?? null;
            if (!is_array($entry)) {
                continue;
            }
            $info = $page['imageinfo'][0];
            $originalUrl = SrpInstitutionSourceSupport::url($info['url'] ?? null);
            $thumbnailUrl = SrpInstitutionSourceSupport::url($info['thumburl'] ?? null);
            $mime = strtolower(trim((string)($info['mime'] ?? '')));
            $width = filter_var($info['width'] ?? null, FILTER_VALIDATE_INT);
            $height = filter_var($info['height'] ?? null, FILTER_VALIDATE_INT);
            if ($originalUrl === null
                || !str_starts_with($mime, 'image/')
                || $width === false
                || $height === false
                || $width < 1
                || $height < 1
            ) {
                continue;
            }
            $ext = is_array($info['extmetadata'] ?? null) ? $info['extmetadata'] : [];
            $licenseMetadata = [
                'license_name' => $this->extValue($ext, 'LicenseShortName'),
                'license_url' => SrpInstitutionSourceSupport::url($this->extValue($ext, 'LicenseUrl')),
                'usage_terms' => $this->extValue($ext, 'UsageTerms'),
            ];
            $assessment = $this->assessLicense($licenseMetadata);
            $attribution = $this->attribution($ext, $info);
            $restrictions = $this->extValue($ext, 'Restrictions');
            $descriptionUrl = SrpInstitutionSourceSupport::url($info['descriptionurl'] ?? null)
                ?? $endpoint;
            $type = $this->normalizeLogoType((string)($entry['type'] ?? 'institutional_logo'));
            $athletics = str_contains($type, 'athletic');
            $allowAthletics = (bool)SrpInstitutionSourceSupport::config(
                $this->config,
                ['wikimedia.allow_athletics_logos', 'allow_athletics_logos'],
                false
            );
            $selectable = $assessment['permitted'] && (!$athletics || $allowAthletics);

            $sourceRecordId = (string)($page['pageid'] ?? ('File:' . $title));
            $commonMetadata = [
                'commons_file' => $title,
                'description_url' => $descriptionUrl,
                'logo_type' => $type,
                'logo_license_name' => $licenseMetadata['license_name'],
                'logo_license_url' => $licenseMetadata['license_url'],
                'logo_attribution' => $attribution,
                'license' => [
                    'name' => $licenseMetadata['license_name'],
                    'url' => $licenseMetadata['license_url'],
                ],
                'license_permits_redistribution' => $assessment['permitted'],
                'license_status' => $assessment['status'],
                'license_reason' => $assessment['reason'],
                'restrictions' => $restrictions,
                'trademark_review_required' => $restrictions !== null
                    && stripos($restrictions, 'trademark') !== false,
                'selectable' => $selectable,
                'sha1' => SrpInstitutionSourceSupport::text($info['sha1'] ?? null, 100),
            ];
            $fields = [];
            $add = static function (
                string $field,
                $value,
                float $confidence = 0.80,
                array $metadata = []
            ) use (
                &$fields,
                $descriptionUrl,
                $sourceRecordId,
                $retrievedAt,
                $commonMetadata
            ): void {
                SrpInstitutionSourceSupport::addCandidate(
                    $fields,
                    $field,
                    $value,
                    'wikimedia_commons',
                    $descriptionUrl,
                    $sourceRecordId,
                    $retrievedAt,
                    $confidence,
                    array_merge($commonMetadata, $metadata)
                );
            };
            $add('wikimedia_file', $title);
            $add('logo_type', $type);
            $add('logo_mime_type', $mime);
            $add('logo_license_name', $licenseMetadata['license_name']);
            $add('logo_license_url', $licenseMetadata['license_url']);
            $add('logo_attribution', $attribution);
            $add('logo_width', $width);
            $add('logo_height', $height);
            $add('last_logo_check_at', $retrievedAt);
            // Licensed images may be selected. Restricted/unknown images still
            // enter the managed logo field so the resolver can retain them as
            // review candidates while its top-level license gate rejects them.
            $add('logo_url', $originalUrl, $selectable ? 0.80 : 0.0, [
                'requires_license_review' => !$selectable,
            ]);
            $add('logo_thumbnail_url', $thumbnailUrl, $selectable ? 0.80 : 0.0, [
                'requires_license_review' => !$selectable,
            ]);

            $records[] = SrpInstitutionSourceSupport::record(
                $this->name(),
                $sourceRecordId,
                $retrievedAt,
                $entry['match'],
                $fields,
                [
                    'batch_index' => $batchIndex,
                    'page_id' => isset($page['pageid']) ? (int)$page['pageid'] : null,
                    'requested_file_identity' => $requestedIdentity,
                    'commons_file' => $title,
                    'media_type' => $info['mediatype'] ?? null,
                    'file_bytes' => isset($info['size']) ? (int)$info['size'] : null,
                    'license_permits_redistribution' => $assessment['permitted'],
                    'license_status' => $assessment['status'],
                    'selectable' => $selectable,
                    'wikidata_id' => $entry['wikidata_id'] ?? null,
                ]
            );
        }
        return $records;
    }

    /**
     * @param array<string, mixed> $context
     * @return array<string, array<string, mixed>>
     */
    private function filesFromContext(array $context): array
    {
        $entries = [];
        $direct = $context['files'] ?? [];
        if (is_string($direct)) {
            $direct = [$direct];
        }
        if (is_array($direct)) {
            foreach ($direct as $key => $value) {
                if (is_string($value)) {
                    $this->addFileEntry($entries, [
                        'file' => $value,
                        'type' => is_string($key) && !is_numeric($key) ? $key : 'institutional_logo',
                        'match' => [],
                    ]);
                } elseif (is_array($value)) {
                    $this->addFileEntry($entries, $value);
                }
            }
        }

        foreach (is_array($context['universities'] ?? null) ? $context['universities'] : [] as $university) {
            if (!is_array($university)) {
                continue;
            }
            $match = $this->matchFromRecord($university);
            foreach ([
                'wikimedia_logo_file' => 'institutional_logo',
                'logo_file' => 'institutional_logo',
                'wikimedia_seal_file' => 'institutional_seal',
                'seal_file' => 'institutional_seal',
            ] as $field => $type) {
                $value = $university[$field] ?? $university['fields'][$field]['value'] ?? null;
                if (is_scalar($value)) {
                    $this->addFileEntry($entries, [
                        'file' => (string)$value,
                        'type' => $type,
                        'match' => $match,
                        'wikidata_id' => $university['wikidata_id']
                            ?? $university['fields']['wikidata_id']['value']
                            ?? null,
                    ]);
                }
            }
            $this->addStoredProvenanceFiles($entries, $university, $match);
        }

        $previous = $context['previous_results'] ?? [];
        if ($previous instanceof SrpInstitutionSourceResult) {
            $previous = [$previous];
        }
        if (is_array($previous)) {
            foreach ($previous as $result) {
                $records = $result instanceof SrpInstitutionSourceResult
                    ? $result->records()
                    : (is_array($result['records'] ?? null) ? $result['records'] : []);
                foreach ($records as $record) {
                    if (!is_array($record)) {
                        continue;
                    }
                    $match = $this->matchFromRecord($record);
                    foreach ([
                        'wikimedia_logo_file' => 'institutional_logo',
                        'wikimedia_seal_file' => 'institutional_seal',
                    ] as $field => $type) {
                        $value = $record['fields'][$field]['value'] ?? null;
                        if (is_scalar($value)) {
                            $this->addFileEntry($entries, [
                                'file' => (string)$value,
                                'type' => $type,
                                'match' => $match,
                                'wikidata_id' => $record['fields']['wikidata_id']['value']
                                    ?? $record['source_record_id']
                                    ?? null,
                            ]);
                        }
                    }
                }
            }
        }

        $stateFilter = isset($context['state'])
            ? SrpInstitutionSourceSupport::state($context['state'])
            : null;
        $unitIds = [];
        if (isset($context['unitid'])) {
            $unitId = SrpInstitutionSourceSupport::unitId($context['unitid']);
            if ($unitId !== null) {
                $unitIds[$unitId] = true;
            }
        }
        foreach (is_array($context['unitids'] ?? null) ? $context['unitids'] : [] as $value) {
            $unitId = SrpInstitutionSourceSupport::unitId($value);
            if ($unitId !== null) {
                $unitIds[$unitId] = true;
            }
        }
        if ($stateFilter !== null || $unitIds !== []) {
            $entries = array_filter(
                $entries,
                static function (array $entry) use ($stateFilter, $unitIds): bool {
                    if ($stateFilter !== null
                        && ($entry['match']['state'] ?? null) !== null
                        && $entry['match']['state'] !== $stateFilter
                    ) {
                        return false;
                    }
                    return $unitIds === []
                        || isset($unitIds[(string)($entry['match']['ipeds_unitid'] ?? '')]);
                }
            );
        }
        $limit = isset($context['limit']) && is_numeric($context['limit'])
            ? max(1, (int)$context['limit'])
            : null;
        return $limit !== null ? array_slice($entries, 0, $limit, true) : $entries;
    }

    /**
     * @param array<string, array<string, mixed>> $entries
     * @param array<string, mixed> $entry
     */
    private function addFileEntry(array &$entries, array $entry): void
    {
        $file = $this->normalizeFileName((string)($entry['file'] ?? $entry['title'] ?? ''));
        if ($file === null) {
            return;
        }
        $identity = $this->fileIdentity($file);
        $match = is_array($entry['match'] ?? null) ? $entry['match'] : $entry;
        $entries[$identity] ??= [
            'file' => $file,
            'type' => $entry['type'] ?? 'institutional_logo',
            'match' => array_merge([
                'ipeds_unitid' => null,
                'ope_id' => null,
                'normalized_domain' => null,
                'name' => null,
                'city' => null,
                'state' => null,
            ], [
                'ipeds_unitid' => SrpInstitutionSourceSupport::unitId(
                    $match['ipeds_unitid'] ?? null
                ),
                'ope_id' => SrpInstitutionSourceSupport::opeId($match['ope_id'] ?? null),
                'normalized_domain' => SrpInstitutionSourceSupport::domain(
                    $match['normalized_domain'] ?? $match['website'] ?? null
                ),
                'name' => SrpInstitutionSourceSupport::text($match['name'] ?? null, 255),
                'city' => SrpInstitutionSourceSupport::text($match['city'] ?? null, 100),
                'state' => SrpInstitutionSourceSupport::state($match['state'] ?? null),
            ]),
            'wikidata_id' => SrpInstitutionSourceSupport::wikidataId($entry['wikidata_id'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function matchFromRecord(array $record): array
    {
        $match = is_array($record['match'] ?? null) ? $record['match'] : $record;
        return [
            'ipeds_unitid' => $match['ipeds_unitid']
                ?? $record['fields']['ipeds_unitid']['value']
                ?? null,
            'ope_id' => $match['ope_id'] ?? null,
            'normalized_domain' => $match['normalized_domain'] ?? null,
            'name' => $match['name'] ?? null,
            'city' => $match['city'] ?? null,
            'state' => $match['state'] ?? null,
        ];
    }

    /**
     * Recover Commons filenames for scheduled logo rechecks when this run did
     * not execute Wikidata first. Repository rows retain the Commons
     * description URL in selected/candidate provenance JSON.
     *
     * @param array<string, array<string, mixed>> $entries
     * @param array<string, mixed> $row
     * @param array<string, mixed> $match
     */
    private function addStoredProvenanceFiles(
        array &$entries,
        array $row,
        array $match
    ): void {
        $type = $this->normalizeLogoType((string)($row['logo_type'] ?? 'institutional_logo'));
        $wikidataId = SrpInstitutionSourceSupport::wikidataId($row['wikidata_id'] ?? null);
        $sources = $this->decodeJsonObject($row['data_sources_json'] ?? null);
        foreach (['logo_url', 'logo_thumbnail_url'] as $field) {
            $source = is_array($sources[$field] ?? null) ? $sources[$field] : [];
            $file = $this->commonsFileFromProvenance(
                $source['source_url'] ?? null,
                $row[$field] ?? null
            );
            if ($file !== null
                && (
                    ($source['source_type'] ?? '') === 'wikimedia_commons'
                    || $this->looksLikeCommonsUrl((string)($source['source_url'] ?? ''))
                )
            ) {
                $this->addFileEntry($entries, [
                    'file' => $file,
                    'type' => $type,
                    'match' => $match,
                    'wikidata_id' => $wikidataId,
                ]);
            }
        }

        $candidateJson = $this->decodeJsonObject($row['data_candidates_json'] ?? null);
        foreach (['logo_url', 'logo_thumbnail_url'] as $field) {
            $candidates = is_array($candidateJson[$field] ?? null)
                ? $candidateJson[$field]
                : [];
            foreach ($candidates as $candidate) {
                if (!is_array($candidate)) {
                    continue;
                }
                $sourceUrl = $candidate['source_url'] ?? null;
                if (($candidate['source_type'] ?? '') !== 'wikimedia_commons'
                    && !$this->looksLikeCommonsUrl((string)$sourceUrl)
                ) {
                    continue;
                }
                $file = $this->commonsFileFromProvenance(
                    $sourceUrl,
                    $candidate['value'] ?? null
                );
                if ($file !== null) {
                    $this->addFileEntry($entries, [
                        'file' => $file,
                        'type' => $candidate['logo_type'] ?? $type,
                        'match' => $match,
                        'wikidata_id' => $wikidataId,
                    ]);
                }
            }
        }
    }

    /**
     * @param mixed $value
     * @return array<string, mixed>
     */
    private function decodeJsonObject($value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        try {
            $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : [];
        } catch (JsonException $ignored) {
            return [];
        }
    }

    /**
     * @param mixed $sourceUrl
     * @param mixed $valueUrl
     */
    private function commonsFileFromProvenance($sourceUrl, $valueUrl): ?string
    {
        foreach ([$sourceUrl, $valueUrl] as $candidate) {
            if (!is_scalar($candidate)) {
                continue;
            }
            $url = html_entity_decode((string)$candidate, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (!$this->looksLikeCommonsUrl($url)) {
                continue;
            }
            $parts = parse_url($url);
            $path = rawurldecode((string)($parts['path'] ?? ''));
            if (preg_match('#(?:/wiki/)?File:(.+)$#i', $path, $matches) === 1
                || preg_match('#Special:FilePath/(.+)$#i', $path, $matches) === 1
            ) {
                return $this->normalizeFileName($matches[1]);
            }
            if (preg_match('#/thumb/[0-9a-f]/[0-9a-f]{2}/([^/]+)/#i', $path, $matches) === 1
                || preg_match('#/[0-9a-f]/[0-9a-f]{2}/([^/]+)$#i', $path, $matches) === 1
            ) {
                return $this->normalizeFileName($matches[1]);
            }
            if (isset($parts['query'])) {
                parse_str((string)$parts['query'], $query);
                $titles = $query['titles'] ?? null;
                if (is_string($titles)) {
                    $first = explode('|', $titles, 2)[0];
                    $file = $this->normalizeFileName($first);
                    if ($file !== null) {
                        return $file;
                    }
                }
            }
        }
        return null;
    }

    private function looksLikeCommonsUrl(string $url): bool
    {
        $host = strtolower((string)parse_url($url, PHP_URL_HOST));
        return $host === 'commons.wikimedia.org'
            || $host === 'upload.wikimedia.org'
            || str_ends_with($host, '.wikimedia.org');
    }

    private function normalizeFileName(string $value): ?string
    {
        $value = rawurldecode(trim($value));
        if (preg_match('#Special:FilePath/(.+)$#i', $value, $matches) === 1) {
            $value = $matches[1];
        }
        $value = preg_replace('#^(?:https?://[^/]+)?/(?:wiki/)?File:#i', '', $value) ?? $value;
        $value = preg_replace('/^File:/i', '', $value) ?? $value;
        $value = trim(str_replace('_', ' ', $value));
        if ($value === '' || strlen($value) > 500 || str_contains($value, "\0")) {
            return null;
        }
        return $value;
    }

    private function fileIdentity(string $file): string
    {
        return mb_strtolower(trim(str_replace('_', ' ', preg_replace('/^File:/i', '', $file) ?? $file)), 'UTF-8');
    }

    /**
     * @param array<string, mixed> $ext
     */
    private function extValue(array $ext, string $name): ?string
    {
        $raw = $ext[$name]['value'] ?? $ext[$name] ?? null;
        if (!is_scalar($raw)) {
            return null;
        }
        $value = html_entity_decode(
            strip_tags((string)$raw),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8'
        );
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        return $value !== '' ? mb_strcut($value, 0, 20000, 'UTF-8') : null;
    }

    /**
     * @param array<string, mixed> $ext
     * @param array<string, mixed> $info
     */
    private function attribution(array $ext, array $info): ?string
    {
        $parts = [];
        foreach (['Attribution', 'Artist', 'Credit'] as $name) {
            $value = $this->extValue($ext, $name);
            if ($value !== null && !in_array($value, $parts, true)) {
                $parts[] = $value;
            }
        }
        if ($parts === []) {
            $uploader = SrpInstitutionSourceSupport::text($info['user'] ?? null, 255);
            if ($uploader !== null) {
                $parts[] = $uploader;
            }
        }
        return $parts !== [] ? implode('; ', $parts) : null;
    }

    private function normalizeLogoType(string $type): string
    {
        $type = strtolower(trim(str_replace(['-', ' '], '_', $type)));
        return match ($type) {
            'seal', 'institution_seal', 'institutional_seal' => 'seal',
            'athletics', 'athletics_logo', 'athletic_logo' => 'athletics_logo',
            default => 'institutional_logo',
        };
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

if (!class_exists('SrpWikimediaSource', false)) {
    class_alias(SrpInstitutionWikimediaSource::class, 'SrpWikimediaSource');
}
