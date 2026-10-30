<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/HttpClient.php';
require_once dirname(__DIR__) . '/SourceInterface.php';
require_once dirname(__DIR__) . '/SourceSupport.php';

/**
 * Bulk Wikidata SPARQL enrichment keyed by exact IPEDS UNITID (P1771).
 */
final class SrpInstitutionWikidataSource implements SrpInstitutionSourceInterface
{
    private const ENDPOINT = 'https://query.wikidata.org/sparql';

    private SrpInstitutionHttpClient $http;
    /** @var array<string, mixed>|object */
    private $config;

    /**
     * @param array<string, mixed>|object $config
     */
    public function __construct(SrpInstitutionHttpClient $http, $config = [])
    {
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('Wikidata configuration must be an array or object.');
        }
        $this->http = $http;
        $this->config = $config;
    }

    public function name(): string
    {
        return 'wikidata';
    }

    /**
     * Context accepts unitid, unitids, universities, and previous_results.
     *
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        try {
            $unitIds = $this->unitIdsFromContext($context);
            if ($unitIds === []) {
                return SrpInstitutionSourceResult::skipped(
                    $this->name(),
                    'Wikidata requires one or more trusted IPEDS UNITIDs.',
                    [
                        'started_at' => $startedAt,
                        'finished_at' => $this->http->nowAtom(),
                    ]
                );
            }
            $batchSize = $this->integerConfig(
                ['wikidata.batch_size', 'wikidata_batch_size'],
                75,
                1,
                250
            );
            $endpoint = trim((string)SrpInstitutionSourceSupport::config(
                $this->config,
                ['wikidata.endpoint', 'wikidata_endpoint'],
                self::ENDPOINT
            ));
            if (!preg_match('#^https://#i', $endpoint)) {
                throw new InvalidArgumentException('Wikidata SPARQL endpoint must use HTTPS.');
            }

            $records = [];
            $errors = [];
            $warnings = [];
            $matchedUnitIds = [];
            $batchesCompleted = 0;
            $retrievedAt = $this->http->nowAtom();
            foreach (array_chunk($unitIds, $batchSize) as $batchIndex => $batch) {
                try {
                    $query = $this->buildQuery($batch);
                    $payload = $this->executeQuery($endpoint, $query);
                    $batchRecords = $this->parseBindings(
                        $payload,
                        $endpoint,
                        $retrievedAt,
                        (int)$batchIndex
                    );
                    foreach ($batchRecords as $record) {
                        $key = $record['source_record_id'] . ':' . $record['match']['ipeds_unitid'];
                        $records[$key] = $record;
                        $matchedUnitIds[(string)$record['match']['ipeds_unitid']] = true;
                    }
                    $batchesCompleted++;
                } catch (Throwable $error) {
                    $errors[] = $error;
                    $warnings[] = 'A Wikidata batch failed; other completed batches were retained.';
                }
            }
            $missing = array_values(array_diff($unitIds, array_keys($matchedUnitIds)));
            if ($missing !== []) {
                $warnings[] = count($missing) . ' UNITIDs had no Wikidata P1771 match.';
            }
            $metadata = [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'source_url' => $endpoint,
                'queried_unitids' => count($unitIds),
                'matched_unitids' => count($matchedUnitIds),
                'missing_unitids' => $missing,
                'batch_size' => $batchSize,
                'batches_requested' => (int)ceil(count($unitIds) / $batchSize),
                'batches_completed' => $batchesCompleted,
                'record_count' => count($records),
                'query_key' => 'P1771',
            ];
            if ($errors !== [] && $records === []) {
                return SrpInstitutionSourceResult::failure(
                    $this->name(),
                    $errors[0],
                    $metadata
                );
            }
            return $errors === []
                ? SrpInstitutionSourceResult::success(
                    $this->name(),
                    array_values($records),
                    $metadata,
                    $warnings
                )
                : SrpInstitutionSourceResult::partial(
                    $this->name(),
                    array_values($records),
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
     * Exposed for fixture assertions and operational query review.
     *
     * @param list<string> $unitIds
     */
    public function buildQuery(array $unitIds): string
    {
        $values = [];
        foreach ($unitIds as $value) {
            $unitId = SrpInstitutionSourceSupport::unitId($value);
            if ($unitId === null) {
                throw new InvalidArgumentException('Wikidata query contains an invalid UNITID.');
            }
            $values[] = '"' . $unitId . '"';
        }
        if ($values === []) {
            throw new InvalidArgumentException('Wikidata query needs at least one UNITID.');
        }

        $query = <<<'SPARQL'
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
SELECT ?unitid ?item ?itemLabel
       ?website ?websiteReferenced
       ?motto ?mottoReferenced
       ?logo ?logoReferenced
       ?seal ?sealReferenced
       ?color ?colorLabel ?colorReferenced
       ?nickname ?nicknameReferenced
       ?parent ?parentLabel ?parentReferenced
       ?coordinate ?coordinateReferenced
WHERE {
  VALUES ?unitid { %VALUES% }
  ?item wdt:P1771 ?unitid .
  OPTIONAL {
    ?item p:P856 ?websiteStatement .
    ?websiteStatement ps:P856 ?website .
    BIND(EXISTS { ?websiteStatement prov:wasDerivedFrom ?websiteReference } AS ?websiteReferenced)
  }
  OPTIONAL {
    ?item p:P1451 ?mottoStatement .
    ?mottoStatement ps:P1451 ?motto .
    BIND(EXISTS { ?mottoStatement prov:wasDerivedFrom ?mottoReference } AS ?mottoReferenced)
  }
  OPTIONAL {
    ?item p:P154 ?logoStatement .
    ?logoStatement ps:P154 ?logo .
    BIND(EXISTS { ?logoStatement prov:wasDerivedFrom ?logoReference } AS ?logoReferenced)
  }
  OPTIONAL {
    ?item p:P158 ?sealStatement .
    ?sealStatement ps:P158 ?seal .
    BIND(EXISTS { ?sealStatement prov:wasDerivedFrom ?sealReference } AS ?sealReferenced)
  }
  OPTIONAL {
    ?item p:P6364 ?colorStatement .
    ?colorStatement ps:P6364 ?color .
    BIND(EXISTS { ?colorStatement prov:wasDerivedFrom ?colorReference } AS ?colorReferenced)
  }
  OPTIONAL {
    ?item p:P1449 ?nicknameStatement .
    ?nicknameStatement ps:P1449 ?nickname .
    BIND(EXISTS { ?nicknameStatement prov:wasDerivedFrom ?nicknameReference } AS ?nicknameReferenced)
  }
  OPTIONAL {
    ?item p:P749 ?parentStatement .
    ?parentStatement ps:P749 ?parent .
    BIND(EXISTS { ?parentStatement prov:wasDerivedFrom ?parentReference } AS ?parentReferenced)
  }
  OPTIONAL {
    ?item p:P625 ?coordinateStatement .
    ?coordinateStatement ps:P625 ?coordinate .
    BIND(EXISTS { ?coordinateStatement prov:wasDerivedFrom ?coordinateReference } AS ?coordinateReferenced)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
SPARQL
        ;
        return str_replace('%VALUES%', implode(' ', $values), $query);
    }

    /**
     * @return array<string, mixed>|list<mixed>
     */
    private function executeQuery(string $endpoint, string $query): array
    {
        $method = strtoupper(trim((string)SrpInstitutionSourceSupport::config(
            $this->config,
            ['wikidata.method', 'wikidata_method'],
            'POST'
        )));
        $options = [
            'headers' => ['Accept' => 'application/sparql-results+json, application/json'],
            'max_bytes' => $this->integerConfig(
                ['wikidata.max_response_bytes', 'wikidata_max_response_bytes'],
                25 * 1024 * 1024,
                1024,
                200 * 1024 * 1024
            ),
            'cache' => true,
            'cache_key' => 'wikidata-sparql:' . hash('sha256', $query),
            'cache_ttl' => $this->integerConfig(
                ['wikidata.cache_ttl', 'wikidata_cache_ttl'],
                7 * 86400,
                0,
                90 * 86400
            ),
            'minimum_interval' => $this->floatConfig(
                ['wikidata.minimum_request_interval', 'wikidata_minimum_request_interval'],
                1.0,
                0.0,
                60.0
            ),
        ];
        if ($method === 'GET') {
            $url = $endpoint . (str_contains($endpoint, '?') ? '&' : '?')
                . http_build_query(['query' => $query, 'format' => 'json'], '', '&', PHP_QUERY_RFC3986);
            return $this->http->get($url, $options)->json();
        }
        if ($method !== 'POST') {
            throw new InvalidArgumentException('Wikidata method must be GET or POST.');
        }
        $options['headers']['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        $options['body'] = http_build_query(
            ['query' => $query, 'format' => 'json'],
            '',
            '&',
            PHP_QUERY_RFC3986
        );
        return $this->http->request('POST', $endpoint, $options)->json();
    }

    /**
     * @param array<string, mixed>|list<mixed> $payload
     * @return list<array<string, mixed>>
     */
    private function parseBindings(
        array $payload,
        string $sourceUrl,
        string $retrievedAt,
        int $batchIndex
    ): array {
        $bindings = $payload['results']['bindings'] ?? null;
        if (!is_array($bindings)) {
            throw new UnexpectedValueException('Wikidata SPARQL response has no bindings array.');
        }
        /** @var array<string, array<string, mixed>> $groups */
        $groups = [];
        foreach ($bindings as $binding) {
            if (!is_array($binding)) {
                continue;
            }
            $unitId = SrpInstitutionSourceSupport::unitId($this->bindingValue($binding, 'unitid'));
            $qid = SrpInstitutionSourceSupport::wikidataId($this->bindingValue($binding, 'item'));
            if ($unitId === null || $qid === null) {
                continue;
            }
            $key = $unitId . ':' . $qid;
            $groups[$key] ??= [
                'unitid' => $unitId,
                'qid' => $qid,
                'label' => null,
                'values' => [],
            ];
            $label = SrpInstitutionSourceSupport::text($this->bindingValue($binding, 'itemLabel'), 255);
            if ($label !== null && $label !== $qid) {
                $groups[$key]['label'] ??= $label;
            }
            foreach ([
                'website', 'motto', 'logo', 'seal', 'nickname', 'coordinate',
            ] as $property) {
                $value = $this->bindingValue($binding, $property);
                if ($value !== null && $value !== '') {
                    $this->appendValue(
                        $groups[$key]['values'],
                        $property,
                        $value,
                        $this->bindingBoolean($binding, $property . 'Referenced')
                    );
                }
            }
            $color = $this->bindingValue($binding, 'colorLabel')
                ?? $this->bindingValue($binding, 'color');
            if ($color !== null && $color !== '') {
                $this->appendValue(
                    $groups[$key]['values'],
                    'color',
                    $color,
                    $this->bindingBoolean($binding, 'colorReferenced'),
                    ['entity' => $this->bindingValue($binding, 'color')]
                );
            }
            $parentLabel = $this->bindingValue($binding, 'parentLabel')
                ?? $this->bindingValue($binding, 'parent');
            if ($parentLabel !== null && $parentLabel !== '') {
                $this->appendValue(
                    $groups[$key]['values'],
                    'parent',
                    $parentLabel,
                    $this->bindingBoolean($binding, 'parentReferenced'),
                    ['wikidata_id' => SrpInstitutionSourceSupport::wikidataId(
                        $this->bindingValue($binding, 'parent')
                    )]
                );
            }
        }

        $records = [];
        foreach ($groups as $group) {
            $fields = [];
            $qid = (string)$group['qid'];
            $unitId = (string)$group['unitid'];
            $label = is_string($group['label']) ? $group['label'] : null;
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                'wikidata_id',
                $qid,
                'wikidata_referenced',
                $sourceUrl,
                $qid,
                $retrievedAt,
                0.80,
                ['matched_property' => 'P1771', 'ipeds_unitid' => $unitId]
            );

            $website = $this->firstValue($group['values'], 'website');
            $normalizedWebsite = $website !== null
                ? SrpInstitutionSourceSupport::url($website['value'])
                : null;
            if ($website !== null && $normalizedWebsite !== null) {
                $this->addWikidataCandidate(
                    $fields,
                    'official_website',
                    $normalizedWebsite,
                    $website,
                    $sourceUrl,
                    $qid,
                    $retrievedAt
                );
                $this->addWikidataCandidate(
                    $fields,
                    'website',
                    $normalizedWebsite,
                    $website,
                    $sourceUrl,
                    $qid,
                    $retrievedAt
                );
                $this->addWikidataCandidate(
                    $fields,
                    'normalized_domain',
                    SrpInstitutionSourceSupport::domain($normalizedWebsite),
                    $website,
                    $sourceUrl,
                    $qid,
                    $retrievedAt
                );
            }
            foreach ([
                'motto' => 'motto',
                'nickname' => 'nickname',
                'parent' => 'parent_institution',
            ] as $property => $field) {
                $selected = $this->firstValue($group['values'], $property);
                if ($selected !== null) {
                    $this->addWikidataCandidate(
                        $fields,
                        $field,
                        $selected['value'],
                        $selected,
                        $sourceUrl,
                        $qid,
                        $retrievedAt
                    );
                }
            }
            $managedColors = $this->managedColors($group['values']['color'] ?? []);
            foreach (['primary_color', 'secondary_color'] as $index => $field) {
                if (!isset($managedColors[$index])) {
                    continue;
                }
                $selected = $managedColors[$index];
                $this->addWikidataCandidate(
                    $fields,
                    $field,
                    $selected['normalized'],
                    $selected,
                    $sourceUrl,
                    $qid,
                    $retrievedAt
                );
            }

            foreach ([
                'logo' => ['field' => 'wikimedia_logo_file', 'type' => 'institutional_logo'],
                'seal' => ['field' => 'wikimedia_seal_file', 'type' => 'institutional_seal'],
            ] as $property => $mapping) {
                $selected = $this->firstValue($group['values'], $property);
                if ($selected === null) {
                    continue;
                }
                $file = $this->commonsFileName((string)$selected['value']);
                if ($file === null) {
                    continue;
                }
                $selected['metadata']['wikidata_image_url'] = $selected['value'];
                $selected['metadata']['logo_type'] = $mapping['type'];
                $selected['metadata']['license_status'] = 'pending_wikimedia_metadata';
                $this->addWikidataCandidate(
                    $fields,
                    $mapping['field'],
                    $file,
                    $selected,
                    $sourceUrl,
                    $qid,
                    $retrievedAt
                );
            }

            $coordinate = $this->firstValue($group['values'], 'coordinate');
            if ($coordinate !== null) {
                $point = $this->parsePoint((string)$coordinate['value']);
                if ($point !== null) {
                    $this->addWikidataCandidate(
                        $fields,
                        'longitude',
                        $point['longitude'],
                        $coordinate,
                        $sourceUrl,
                        $qid,
                        $retrievedAt
                    );
                    $this->addWikidataCandidate(
                        $fields,
                        'latitude',
                        $point['latitude'],
                        $coordinate,
                        $sourceUrl,
                        $qid,
                        $retrievedAt
                    );
                }
            }

            $records[] = SrpInstitutionSourceSupport::record(
                $this->name(),
                $qid,
                $retrievedAt,
                [
                    'ipeds_unitid' => $unitId,
                    'ope_id' => null,
                    'normalized_domain' => SrpInstitutionSourceSupport::domain($normalizedWebsite),
                    'name' => $label,
                    'city' => null,
                    'state' => null,
                ],
                $fields,
                [
                    'batch_index' => $batchIndex,
                    'ipeds_match_property' => 'P1771',
                    'value_counts' => array_map(
                        static fn(array $values): int => count($values),
                        $group['values']
                    ),
                ]
            );
        }
        return $records;
    }

    /**
     * @param array<string, mixed> $fields
     * @param array{value: mixed, referenced: bool, metadata: array<string, mixed>} $selected
     */
    private function addWikidataCandidate(
        array &$fields,
        string $field,
        $value,
        array $selected,
        string $sourceUrl,
        string $qid,
        string $retrievedAt
    ): void {
        $sourceType = $selected['referenced']
            ? 'wikidata_referenced'
            : 'wikidata_unreferenced';
        $alternatives = is_array($selected['alternatives'] ?? null)
            ? array_slice($selected['alternatives'], 0, 5)
            : [];
        SrpInstitutionSourceSupport::addCandidate(
            $fields,
            $field,
            $value,
            $sourceType,
            $sourceUrl,
            $qid,
            $retrievedAt,
            $selected['referenced'] ? 0.80 : 0.65,
            array_merge($selected['metadata'], [
                'referenced' => $selected['referenced'],
                'alternatives' => $alternatives,
            ])
        );
    }

    /**
     * @param array<string, list<array{value: mixed, referenced: bool, metadata: array<string, mixed>}>> $values
     * @param mixed $value
     * @param array<string, mixed> $metadata
     */
    private function appendValue(
        array &$values,
        string $property,
        $value,
        bool $referenced,
        array $metadata = []
    ): void {
        $identity = is_scalar($value)
            ? mb_strtolower(trim((string)$value), 'UTF-8')
            : hash('sha256', serialize($value));
        foreach ($values[$property] ?? [] as &$existing) {
            $existingIdentity = is_scalar($existing['value'])
                ? mb_strtolower(trim((string)$existing['value']), 'UTF-8')
                : hash('sha256', serialize($existing['value']));
            if ($identity === $existingIdentity) {
                $existing['referenced'] = $existing['referenced'] || $referenced;
                return;
            }
        }
        unset($existing);
        if (count($values[$property] ?? []) < 10) {
            $values[$property][] = [
                'value' => $value,
                'referenced' => $referenced,
                'metadata' => $metadata,
            ];
        }
    }

    /**
     * @param array<string, list<array{value: mixed, referenced: bool, metadata: array<string, mixed>}>> $values
     * @return array{value: mixed, referenced: bool, metadata: array<string, mixed>, alternatives: list<array<string, mixed>>}|null
     */
    private function firstValue(array $values, string $property): ?array
    {
        $candidates = $values[$property] ?? [];
        if ($candidates === []) {
            return null;
        }
        usort($candidates, static fn(array $left, array $right): int =>
            ((int)$right['referenced']) <=> ((int)$left['referenced'])
        );
        $selected = array_shift($candidates);
        $selected['alternatives'] = array_map(
            static fn(array $candidate): array => [
                'value' => $candidate['value'],
                'referenced' => $candidate['referenced'],
                'metadata' => $candidate['metadata'],
            ],
            $candidates
        );
        return $selected;
    }

    /**
     * @param array<string, mixed> $binding
     */
    private function bindingValue(array $binding, string $name): ?string
    {
        $value = $binding[$name]['value'] ?? null;
        return is_scalar($value) && trim((string)$value) !== ''
            ? trim((string)$value)
            : null;
    }

    /**
     * @param array<string, mixed> $binding
     */
    private function bindingBoolean(array $binding, string $name): bool
    {
        $value = strtolower((string)($binding[$name]['value'] ?? ''));
        return in_array($value, ['true', '1'], true);
    }

    private function commonsFileName(string $value): ?string
    {
        $value = rawurldecode($value);
        if (preg_match('#Special:FilePath/(.+)$#i', $value, $matches) === 1) {
            $value = $matches[1];
        } elseif (preg_match('#(?:File:|/wiki/File:)(.+)$#i', $value, $matches) === 1) {
            $value = $matches[1];
        }
        $value = str_replace('_', ' ', trim($value));
        return $value !== '' && strlen($value) <= 500 ? $value : null;
    }

    /**
     * @return array{longitude: float, latitude: float}|null
     */
    private function parsePoint(string $value): ?array
    {
        if (preg_match('/Point\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i', $value, $matches) !== 1) {
            return null;
        }
        $longitude = SrpInstitutionSourceSupport::float($matches[1], -180.0, 180.0);
        $latitude = SrpInstitutionSourceSupport::float($matches[2], -90.0, 90.0);
        return $longitude !== null && $latitude !== null
            ? ['longitude' => $longitude, 'latitude' => $latitude]
            : null;
    }

    /**
     * Only emit managed colors when the shared color normalizer can produce an
     * exact CSS value. Labels such as Pantone references remain unselected.
     *
     * @param list<array{value: mixed, referenced: bool, metadata: array<string, mixed>}> $candidates
     * @return list<array{
     *   value: mixed,
     *   normalized: string,
     *   referenced: bool,
     *   metadata: array<string, mixed>,
     *   alternatives: list<array<string, mixed>>
     * }>
     */
    private function managedColors(array $candidates): array
    {
        usort($candidates, static fn(array $left, array $right): int =>
            ((int)$right['referenced']) <=> ((int)$left['referenced'])
        );
        $result = [];
        $seen = [];
        foreach ($candidates as $candidate) {
            $normalized = null;
            if (class_exists('SrpInstitutionColor')
                && method_exists('SrpInstitutionColor', 'normalize')
            ) {
                try {
                    $normalized = SrpInstitutionColor::normalize($candidate['value']);
                } catch (Throwable $ignored) {
                    $normalized = null;
                }
            } elseif (is_scalar($candidate['value'])
                && preg_match('/^#?([0-9a-f]{6})$/i', trim((string)$candidate['value']), $matches) === 1
            ) {
                $normalized = '#' . strtoupper($matches[1]);
            }
            if (!is_string($normalized) || $normalized === '' || isset($seen[$normalized])) {
                continue;
            }
            $seen[$normalized] = true;
            $candidate['normalized'] = $normalized;
            $candidate['metadata']['original_value'] = $candidate['value'];
            $candidate['metadata']['wikidata_color'] = true;
            $candidate['metadata']['alternatives'] = [];
            $candidate['alternatives'] = [];
            $result[] = $candidate;
            if (count($result) >= 2) {
                break;
            }
        }
        return $result;
    }

    /**
     * @param array<string, mixed> $context
     * @return list<string>
     */
    private function unitIdsFromContext(array $context): array
    {
        $stateFilter = isset($context['state'])
            ? SrpInstitutionSourceSupport::state($context['state'])
            : null;
        $values = [];
        $hasExplicitScope = isset($context['unitid'])
            || (
                is_array($context['unitids'] ?? null)
                && $context['unitids'] !== []
            );
        if (isset($context['unitid'])) {
            $values[] = $context['unitid'];
        }
        if (is_array($context['unitids'] ?? null)) {
            array_push($values, ...$context['unitids']);
        }

        // A targeted/retry run may still pass the full repository row set in
        // universities or previous_results. Once an explicit UNITID scope is
        // present, never widen it with those ambient records.
        if (!$hasExplicitScope) {
            foreach (is_array($context['universities'] ?? null) ? $context['universities'] : [] as $university) {
                if (!is_array($university)) {
                    continue;
                }
                $recordState = SrpInstitutionSourceSupport::state(
                    $university['state'] ?? $university['match']['state'] ?? null
                );
                if ($stateFilter !== null && $recordState !== null && $recordState !== $stateFilter) {
                    continue;
                }
                $values[] = $university['ipeds_unitid']
                    ?? $university['match']['ipeds_unitid']
                    ?? $university['fields']['ipeds_unitid']['value']
                    ?? null;
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
                        if ($stateFilter !== null
                            && SrpInstitutionSourceSupport::state($record['match']['state'] ?? null) !== $stateFilter
                        ) {
                            continue;
                        }
                        $values[] = $record['match']['ipeds_unitid']
                            ?? $record['fields']['ipeds_unitid']['value']
                            ?? null;
                    }
                }
            }
        }

        $unitIds = [];
        foreach ($values as $value) {
            $unitId = SrpInstitutionSourceSupport::unitId($value);
            if ($unitId !== null) {
                $unitIds[$unitId] = true;
            }
        }
        $unitIds = array_keys($unitIds);
        sort($unitIds, SORT_STRING);
        $maximum = $this->integerConfig(
            ['wikidata.max_unitids', 'wikidata_max_unitids'],
            25000,
            1,
            100000
        );
        $limit = isset($context['limit']) && is_numeric($context['limit'])
            ? max(1, (int)$context['limit'])
            : null;
        return array_slice($unitIds, 0, min($maximum, $limit ?? $maximum));
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

if (!class_exists('SrpWikidataSource', false)) {
    class_alias(SrpInstitutionWikidataSource::class, 'SrpWikidataSource');
}
