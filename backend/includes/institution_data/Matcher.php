<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Normalizer.php';

/**
 * Conservative in-memory institution matcher. Weak fuzzy names never select a
 * row without exact city and state confirmation.
 */
final class SrpInstitutionMatcher
{
    /** @var array<string, array<string, mixed>> */
    private array $rows = [];
    /** @var array<string, list<string>> */
    private array $unitIdIndex = [];
    /** @var array<string, list<string>> */
    private array $opeIdIndex = [];
    /** @var array<string, list<string>> */
    private array $wikidataIndex = [];
    /** @var array<string, list<string>> */
    private array $domainIndex = [];
    /** @var array<string, list<string>> */
    private array $nameGeographyIndex = [];
    /** @var array<string, list<string>> */
    private array $geographyIndex = [];
    /** @var array<string, list<string>> */
    private array $rowNames = [];
    private float $fuzzyThreshold;
    private float $fuzzyMargin;
    private float $reviewThreshold;

    /**
     * @param iterable<array<string, mixed>> $rows
     * @param array<string, mixed> $options
     */
    public static function buildIndex(iterable $rows, array $options = []): self
    {
        $matcher = new self($options);
        $ordinal = 0;
        foreach ($rows as $row) {
            $ordinal++;
            if (!is_array($row)) {
                throw new InvalidArgumentException('Every matcher row must be an array.');
            }
            if (
                isset($row['community_type'])
                && strtolower((string)$row['community_type']) !== 'university'
            ) {
                continue;
            }
            $key = self::rowKey($row, $ordinal);
            $matcher->rows[$key] = $row;

            self::indexValue(
                $matcher->unitIdIndex,
                SrpInstitutionNormalizer::unitId(
                    self::first($row, ['ipeds_unitid', 'unitid', 'UNITID'])
                ),
                $key
            );
            self::indexValue(
                $matcher->opeIdIndex,
                SrpInstitutionNormalizer::opeId(
                    self::first($row, ['ope_id', 'opeid', 'OPEID'])
                ),
                $key
            );
            self::indexValue(
                $matcher->wikidataIndex,
                SrpInstitutionNormalizer::wikidataId(
                    self::first($row, ['wikidata_id', 'wikidata', 'qid'])
                ),
                $key
            );
            $domain = SrpInstitutionNormalizer::domain(
                self::first(
                    $row,
                    ['normalized_domain', 'website', 'official_website', 'INSTURL']
                )
            );
            self::indexValue($matcher->domainIndex, $domain, $key);

            $city = self::placeKey(self::first($row, ['city', 'CITY']));
            $state = SrpInstitutionNormalizer::state(
                self::first($row, ['state', 'STABBR'])
            );
            if ($city === '' || $state === null) {
                $legacyGeography = self::legacyDisplayGeography(
                    self::first($row, ['location'])
                );
                $city = $city !== '' ? $city : $legacyGeography['city'];
                $state = $state ?? $legacyGeography['state'];
            }
            $names = self::namesFromRecord($row);
            $matcher->rowNames[$key] = $names;
            if ($city !== '' && $state !== null) {
                $geography = "{$city}|{$state}";
                self::indexValue($matcher->geographyIndex, $geography, $key);
                foreach ($names as $name) {
                    self::indexValue(
                        $matcher->nameGeographyIndex,
                        "{$name}|{$geography}",
                        $key
                    );
                }
            }
        }
        return $matcher;
    }

    /**
     * @param array<string, mixed> $sourceRecord
     * @return array<string, mixed>
     */
    public function match(array $sourceRecord): array
    {
        $unitId = SrpInstitutionNormalizer::unitId(
            self::first(
                $sourceRecord,
                ['ipeds_unitid', 'unitid', 'UNITID', 'college_scorecard_id']
            )
        );
        $opeId = SrpInstitutionNormalizer::opeId(
            self::first($sourceRecord, ['ope_id', 'opeid', 'OPEID'])
        );
        $wikidataId = SrpInstitutionNormalizer::wikidataId(
            self::first($sourceRecord, ['wikidata_id', 'wikidata', 'qid'])
        );

        $identifierEvidence = [];
        if ($unitId !== null && isset($this->unitIdIndex[$unitId])) {
            $identifierEvidence['unitid'] = $this->unitIdIndex[$unitId];
        }
        if ($opeId !== null && isset($this->opeIdIndex[$opeId])) {
            $identifierEvidence['ope_id'] = $this->opeIdIndex[$opeId];
        }
        if ($wikidataId !== null && isset($this->wikidataIndex[$wikidataId])) {
            $identifierEvidence['wikidata_id'] = $this->wikidataIndex[$wikidataId];
        }

        if ($identifierEvidence !== []) {
            $allIdentifierRows = [];
            foreach ($identifierEvidence as $method => $keys) {
                foreach ($keys as $key) {
                    $allIdentifierRows[$key][] = $method;
                }
            }
            if (count($allIdentifierRows) > 1) {
                return $this->decision(
                    null,
                    'trusted_identifier_conflict',
                    0.0,
                    true,
                    ['trusted_identifiers_resolve_to_different_rows'],
                    $this->candidateEntries(array_keys($allIdentifierRows), 'identifier', 1.0)
                );
            }
            $key = (string)array_key_first($allIdentifierRows);
            foreach ($identifierEvidence as $method => $keys) {
                if (count(array_unique($keys)) > 1) {
                    return $this->decision(
                        null,
                        "{$method}_duplicate",
                        0.0,
                        true,
                        ["duplicate_{$method}_in_existing_rows"],
                        $this->candidateEntries($keys, $method, 1.0)
                    );
                }
            }
            $method = isset($identifierEvidence['unitid'])
                ? 'unitid'
                : (isset($identifierEvidence['ope_id']) ? 'ope_id' : 'wikidata_id');
            $score = match ($method) {
                'unitid' => 1.0,
                'ope_id' => 0.99,
                default => 0.98,
            };
            return $this->decision(
                $this->rows[$key],
                $method,
                $score,
                false,
                [],
                $this->candidateEntries([$key], $method, $score)
            );
        }

        $domain = SrpInstitutionNormalizer::domain(
            self::first(
                $sourceRecord,
                ['normalized_domain', 'website', 'official_website', 'INSTURL']
            )
        );
        $deferredAmbiguity = null;
        if ($domain !== null && isset($this->domainIndex[$domain])) {
            $keys = array_values(array_unique($this->domainIndex[$domain]));
            if (count($keys) > 1) {
                // Multi-campus systems publish one domain for every campus, so a
                // shared domain is not evidence of a duplicate. Narrow the domain
                // candidates with an exact name, city, and state match before
                // giving up; only defer to review when that cannot single one out.
                $narrowed = $this->narrowByNameGeography($sourceRecord, $keys);
                if (count($narrowed) === 1) {
                    return $this->decision(
                        $this->rows[$narrowed[0]],
                        'domain_name_city_state',
                        0.97,
                        false,
                        [],
                        $this->candidateEntries(
                            $narrowed,
                            'domain_name_city_state',
                            0.97
                        )
                    );
                }
                $deferredAmbiguity = $this->decision(
                    null,
                    'domain_ambiguous',
                    0.0,
                    true,
                    ['official_domain_is_shared_by_multiple_rows'],
                    $this->candidateEntries($keys, 'domain', 0.97)
                );
            }
        }
        if ($deferredAmbiguity === null
            && $domain !== null
            && isset($this->domainIndex[$domain])
        ) {
            $keys = array_values(array_unique($this->domainIndex[$domain]));
            $row = $this->rows[$keys[0]];
            $identifierConflicts = self::identifierConflicts($sourceRecord, $row);
            if ($identifierConflicts !== []) {
                return $this->decision(
                    null,
                    'domain_identifier_conflict',
                    0.0,
                    true,
                    $identifierConflicts,
                    $this->candidateEntries($keys, 'domain', 0.97)
                );
            }
            if (self::geographyConflicts($sourceRecord, $row)) {
                return $this->decision(
                    null,
                    'domain_geography_conflict',
                    0.0,
                    true,
                    ['exact_domain_but_geography_conflicts'],
                    $this->candidateEntries($keys, 'domain', 0.97)
                );
            }
            $sourceName = self::primaryName($sourceRecord);
            $rowSimilarity = $sourceName !== ''
                ? self::bestNameSimilarity($sourceName, $this->rowNames[$keys[0]])
                : 1.0;
            if ($sourceName !== '' && $rowSimilarity < 0.55) {
                return $this->decision(
                    null,
                    'domain_name_conflict',
                    0.0,
                    true,
                    ['exact_domain_but_names_are_unrelated'],
                    $this->candidateEntries($keys, 'domain', 0.97)
                );
            }
            $review = $sourceName !== '' && $rowSimilarity < 0.80;
            return $this->decision(
                $row,
                'domain',
                0.97,
                $review,
                $review ? ['exact_domain_with_name_change'] : [],
                $this->candidateEntries($keys, 'domain', 0.97)
            );
        }

        $sourceName = self::primaryName($sourceRecord);
        $city = self::placeKey(self::first($sourceRecord, ['city', 'CITY']));
        $state = SrpInstitutionNormalizer::state(
            self::first($sourceRecord, ['state', 'STABBR'])
        );
        if ($sourceName !== '' && $city !== '' && $state !== null) {
            $geography = "{$city}|{$state}";
            $exactKey = "{$sourceName}|{$geography}";
            if (isset($this->nameGeographyIndex[$exactKey])) {
                $keys = array_values(array_unique($this->nameGeographyIndex[$exactKey]));
                $keys = $this->withoutIdentifierConflicts($sourceRecord, $keys);
                if (count($keys) === 1) {
                    return $this->decision(
                        $this->rows[$keys[0]],
                        'name_city_state',
                        0.95,
                        false,
                        [],
                        $this->candidateEntries($keys, 'name_city_state', 0.95)
                    );
                }
                if (count($keys) > 1) {
                    return $this->decision(
                        null,
                        'name_city_state_ambiguous',
                        0.0,
                        true,
                        ['same_normalized_name_and_geography_on_multiple_rows'],
                        $this->candidateEntries($keys, 'name_city_state', 0.95)
                    );
                }
                return $this->decision(
                    null,
                    'name_city_state_identifier_conflict',
                    0.0,
                    true,
                    ['name_and_geography_match_but_external_identifiers_conflict'],
                    []
                );
            }

            $geographicKeys = array_values(array_unique(
                $this->geographyIndex[$geography] ?? []
            ));
            $ranked = [];
            foreach ($geographicKeys as $key) {
                if (self::identifierConflicts($sourceRecord, $this->rows[$key]) !== []) {
                    continue;
                }
                $score = self::bestNameSimilarity(
                    $sourceName,
                    $this->rowNames[$key] ?? []
                );
                if ($score >= $this->reviewThreshold) {
                    $ranked[] = ['key' => $key, 'score' => $score];
                }
            }
            usort(
                $ranked,
                static fn (array $left, array $right): int =>
                    $right['score'] <=> $left['score']
                    ?: strcmp($left['key'], $right['key'])
            );
            if ($ranked !== []) {
                $best = $ranked[0];
                $secondScore = isset($ranked[1]) ? (float)$ranked[1]['score'] : 0.0;
                $margin = (float)$best['score'] - $secondScore;
                $candidateEntries = [];
                foreach (array_slice($ranked, 0, 5) as $candidate) {
                    $candidateEntries[] = $this->candidateEntry(
                        $candidate['key'],
                        'fuzzy_name_geography',
                        (float)$candidate['score']
                    );
                }
                if (
                    (float)$best['score'] >= $this->fuzzyThreshold
                    && $margin >= $this->fuzzyMargin
                ) {
                    return $this->decision(
                        $this->rows[$best['key']],
                        'fuzzy_name_geography',
                        round((float)$best['score'], 4),
                        false,
                        [],
                        $candidateEntries
                    );
                }
                return $this->decision(
                    null,
                    'fuzzy_name_geography_review',
                    round((float)$best['score'], 4),
                    true,
                    [
                        (float)$best['score'] < $this->fuzzyThreshold
                            ? 'fuzzy_name_below_automatic_threshold'
                            : 'fuzzy_candidates_too_close',
                    ],
                    $candidateEntries
                );
            }
        }

        if ($deferredAmbiguity !== null) {
            // The shared domain remains the only evidence, so report the
            // ambiguity for review rather than inserting a possible duplicate.
            return $deferredAmbiguity;
        }

        $reason = $sourceName === '' ? 'source_name_missing'
            : (($city === '' || $state === null)
                ? 'insufficient_geography_for_name_match'
                : 'no_safe_match');
        return $this->decision(null, 'none', 0.0, false, [$reason], []);
    }

    public static function nameSimilarity(mixed $left, mixed $right): float
    {
        $left = SrpInstitutionNormalizer::name($left);
        $right = SrpInstitutionNormalizer::name($right);
        if ($left === '' || $right === '') {
            return 0.0;
        }
        if ($left === $right) {
            return 1.0;
        }
        $character = self::levenshteinRatio($left, $right);
        $leftTokens = explode(' ', $left);
        $rightTokens = explode(' ', $right);
        $leftSorted = $leftTokens;
        $rightSorted = $rightTokens;
        sort($leftSorted, SORT_STRING);
        sort($rightSorted, SORT_STRING);
        $sorted = self::levenshteinRatio(
            implode(' ', $leftSorted),
            implode(' ', $rightSorted)
        );
        $token = self::symmetricTokenSimilarity($leftTokens, $rightTokens);
        return round(
            max(0.0, min(1.0, 0.35 * $character + 0.20 * $sorted + 0.45 * $token)),
            4
        );
    }

    /**
     * @param array<string, mixed> $options
     */
    private function __construct(array $options)
    {
        $defaults = SrpInstitutionConfig::load()['matching'];
        $matching = isset($options['matching']) && is_array($options['matching'])
            ? array_replace($defaults, $options['matching'])
            : array_replace($defaults, $options);
        $this->fuzzyThreshold = self::threshold(
            $matching['fuzzy_threshold'] ?? 0.93,
            0.93
        );
        $this->fuzzyMargin = self::threshold(
            $matching['fuzzy_margin'] ?? 0.04,
            0.04
        );
        $this->reviewThreshold = self::threshold(
            $matching['review_threshold'] ?? 0.80,
            0.80
        );
        if ($this->reviewThreshold > $this->fuzzyThreshold) {
            throw new InvalidArgumentException(
                'Matcher review threshold cannot exceed the automatic threshold.'
            );
        }
    }

    private static function threshold(mixed $value, float $default): float
    {
        if (!is_numeric($value)) {
            return $default;
        }
        $value = (float)$value;
        if (!is_finite($value) || $value < 0.0 || $value > 1.0) {
            throw new InvalidArgumentException('Matcher thresholds must be between 0 and 1.');
        }
        return $value;
    }

    /**
     * @param array<string, list<string>> $index
     */
    private static function indexValue(array &$index, ?string $value, string $rowKey): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $index[$value] ??= [];
        if (!in_array($rowKey, $index[$value], true)) {
            $index[$value][] = $rowKey;
        }
    }

    /**
     * @param array<string, mixed> $record
     */
    private static function rowKey(array $record, int $ordinal): string
    {
        $id = trim((string)self::first($record, ['id', 'community_id']));
        return $id !== '' ? 'id:' . $id : 'row:' . $ordinal;
    }

    /**
     * @param array<string, mixed> $record
     * @param list<string> $keys
     */
    private static function first(array $record, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $record) && $record[$key] !== null && $record[$key] !== '') {
                return $record[$key];
            }
        }
        // Source adapters use a common envelope whose matching identity is
        // deliberately isolated from the field candidates. Existing database
        // rows remain flat, so support both shapes here instead of requiring
        // every matcher caller to unwrap the record first.
        $match = $record['match'] ?? null;
        if (is_array($match)) {
            foreach ($keys as $key) {
                if (array_key_exists($key, $match) && $match[$key] !== null && $match[$key] !== '') {
                    return $match[$key];
                }
            }
        }
        return null;
    }

    /**
     * @param array<string, mixed> $record
     * @return list<string>
     */
    private static function namesFromRecord(array $record): array
    {
        $values = [];
        foreach (['official_name', 'institution_name', 'name', 'INSTNM'] as $key) {
            if (isset($record[$key])) {
                $values[] = $record[$key];
            }
        }
        foreach (['aliases', 'former_names', 'alternate_names'] as $key) {
            $additional = $record[$key] ?? null;
            if (is_string($additional)) {
                $decoded = json_decode($additional, true);
                $additional = is_array($decoded)
                    ? $decoded
                    : preg_split('/[;|]/', $additional);
            }
            if (is_array($additional)) {
                foreach ($additional as $name) {
                    $values[] = $name;
                }
            }
        }
        $names = [];
        foreach ($values as $value) {
            $name = SrpInstitutionNormalizer::name($value);
            if ($name !== '') {
                $names[$name] = $name;
            }
        }
        return array_values($names);
    }

    /**
     * @param array<string, mixed> $record
     */
    private static function primaryName(array $record): string
    {
        return SrpInstitutionNormalizer::name(
            self::first(
                $record,
                ['official_name', 'institution_name', 'name', 'INSTNM']
            )
        );
    }

    private static function placeKey(mixed $value): string
    {
        return SrpInstitutionNormalizer::name($value);
    }

    /**
     * The pre-pipeline importer stored a display location in the stable shape
     * "address, city, ST, ZIP". Read its trailing components for first-run
     * matching only; the pipeline never rewrites or treats this display field
     * as authoritative structured data.
     *
     * @return array{city: string, state: ?string}
     */
    private static function legacyDisplayGeography(mixed $location): array
    {
        if (!is_scalar($location)) {
            return ['city' => '', 'state' => null];
        }
        $parts = array_values(array_filter(
            array_map('trim', explode(',', (string)$location)),
            static fn(string $part): bool => $part !== ''
        ));
        if (count($parts) < 3) {
            return ['city' => '', 'state' => null];
        }

        // A ZIP (including ZIP+4) normally occupies the final component. If
        // absent, allow "address, city, ST" but require a real state code.
        $last = (string)$parts[count($parts) - 1];
        $hasZip = preg_match('/^\d{3,5}(?:-\d{4})?$/', $last) === 1;
        $stateIndex = count($parts) - ($hasZip ? 2 : 1);
        $cityIndex = $stateIndex - 1;
        if ($cityIndex < 1) {
            return ['city' => '', 'state' => null];
        }
        $state = SrpInstitutionNormalizer::state($parts[$stateIndex] ?? null);
        $city = $state !== null
            ? self::placeKey($parts[$cityIndex] ?? null)
            : '';
        return ['city' => $city, 'state' => $state];
    }

    /**
     * @param array<string, mixed> $source
     * @param array<string, mixed> $row
     * @return list<string>
     */
    private static function identifierConflicts(array $source, array $row): array
    {
        $pairs = [
            'unitid' => [
                SrpInstitutionNormalizer::unitId(
                    self::first($source, ['ipeds_unitid', 'unitid', 'UNITID', 'college_scorecard_id'])
                ),
                SrpInstitutionNormalizer::unitId(
                    self::first($row, ['ipeds_unitid', 'unitid', 'UNITID'])
                ),
            ],
            'ope_id' => [
                SrpInstitutionNormalizer::opeId(
                    self::first($source, ['ope_id', 'opeid', 'OPEID'])
                ),
                SrpInstitutionNormalizer::opeId(
                    self::first($row, ['ope_id', 'opeid', 'OPEID'])
                ),
            ],
            'wikidata_id' => [
                SrpInstitutionNormalizer::wikidataId(
                    self::first($source, ['wikidata_id', 'wikidata', 'qid'])
                ),
                SrpInstitutionNormalizer::wikidataId(
                    self::first($row, ['wikidata_id', 'wikidata', 'qid'])
                ),
            ],
        ];
        $conflicts = [];
        foreach ($pairs as $type => [$sourceValue, $rowValue]) {
            if ($sourceValue !== null && $rowValue !== null && $sourceValue !== $rowValue) {
                $conflicts[] = "{$type}_conflicts_with_existing_row";
            }
        }
        return $conflicts;
    }

    /**
     * @param array<string, mixed> $source
     * @param array<string, mixed> $row
     */
    private static function geographyConflicts(array $source, array $row): bool
    {
        $sourceState = SrpInstitutionNormalizer::state(
            self::first($source, ['state', 'STABBR'])
        );
        $rowState = SrpInstitutionNormalizer::state(
            self::first($row, ['state', 'STABBR'])
        );
        return $sourceState !== null && $rowState !== null && $sourceState !== $rowState;
    }

    /**
     * @param array<string, mixed> $source
     * @param list<string> $keys
     * @return list<string>
     */
    private function withoutIdentifierConflicts(array $source, array $keys): array
    {
        return array_values(array_filter(
            $keys,
            fn (string $key): bool =>
                self::identifierConflicts($source, $this->rows[$key]) === []
        ));
    }

    /**
     * Reduce an ambiguous candidate set to the rows whose normalized name,
     * city, and state all match the source record exactly. This is the same
     * exact evidence the name/city/state stage uses, applied to an already
     * domain-confirmed subset, so it never widens a match beyond that stage.
     *
     * @param array<string, mixed> $sourceRecord
     * @param list<string> $keys
     * @return list<string>
     */
    private function narrowByNameGeography(array $sourceRecord, array $keys): array
    {
        $sourceName = self::primaryName($sourceRecord);
        $city = self::placeKey(self::first($sourceRecord, ['city', 'CITY']));
        $state = SrpInstitutionNormalizer::state(
            self::first($sourceRecord, ['state', 'STABBR'])
        );
        if ($sourceName === '' || $city === '' || $state === null) {
            return [];
        }
        $indexed = $this->nameGeographyIndex["{$sourceName}|{$city}|{$state}"] ?? [];
        if ($indexed === []) {
            return [];
        }
        $allowed = array_fill_keys($keys, true);
        $narrowed = [];
        foreach (array_unique($indexed) as $key) {
            if (isset($allowed[$key])) {
                $narrowed[] = (string)$key;
            }
        }
        return $this->withoutIdentifierConflicts($sourceRecord, $narrowed);
    }

    /**
     * @param list<string> $names
     */
    private static function bestNameSimilarity(string $sourceName, array $names): float
    {
        $best = 0.0;
        foreach ($names as $name) {
            $best = max($best, self::nameSimilarity($sourceName, $name));
        }
        return $best;
    }

    private static function levenshteinRatio(string $left, string $right): float
    {
        $maximumLength = max(strlen($left), strlen($right));
        if ($maximumLength === 0) {
            return 1.0;
        }
        if ($maximumLength > 255) {
            $left = substr($left, 0, 255);
            $right = substr($right, 0, 255);
            $maximumLength = max(strlen($left), strlen($right));
        }
        return max(0.0, 1.0 - (levenshtein($left, $right) / $maximumLength));
    }

    /**
     * @param list<string> $left
     * @param list<string> $right
     */
    private static function symmetricTokenSimilarity(array $left, array $right): float
    {
        if ($left === [] || $right === []) {
            return 0.0;
        }
        $directional = static function (array $from, array $to): float {
            $total = 0.0;
            foreach ($from as $token) {
                $best = 0.0;
                foreach ($to as $candidate) {
                    $best = max($best, self::levenshteinRatio($token, $candidate));
                }
                $total += $best;
            }
            return $total / count($from);
        };
        return ($directional($left, $right) + $directional($right, $left)) / 2;
    }

    /**
     * @param list<string> $keys
     * @return list<array<string, mixed>>
     */
    private function candidateEntries(
        array $keys,
        string $method,
        float $score
    ): array {
        $entries = [];
        foreach (array_slice(array_values(array_unique($keys)), 0, 5) as $key) {
            $entries[] = $this->candidateEntry($key, $method, $score);
        }
        return $entries;
    }

    /**
     * @return array<string, mixed>
     */
    private function candidateEntry(string $key, string $method, float $score): array
    {
        $row = $this->rows[$key];
        return [
            'row' => $row,
            'community_id' => (string)self::first($row, ['id', 'community_id']),
            'method' => $method,
            'score' => round($score, 4),
        ];
    }

    /**
     * @param array<string, mixed>|null $row
     * @param list<string> $reasons
     * @param list<array<string, mixed>> $candidates
     * @return array<string, mixed>
     */
    private function decision(
        ?array $row,
        string $method,
        float $score,
        bool $review,
        array $reasons,
        array $candidates
    ): array {
        return [
            'row' => $row,
            'method' => $method,
            'score' => round($score, 4),
            'review' => $review,
            'reasons' => array_values(array_unique($reasons)),
            'candidates' => $candidates,
            // Explicit aliases keep repository/report consumers unambiguous.
            'matched' => $row !== null,
            'status' => $row !== null ? 'matched' : ($review ? 'review' : 'unmatched'),
            'match_method' => $method,
            'match_score' => round($score, 4),
            'confidence' => round($score, 4),
            'review_required' => $review,
            'reason' => $reasons[0] ?? null,
        ];
    }
}

/**
 * @param iterable<array<string, mixed>> $rows
 * @param array<string, mixed> $sourceRecord
 * @param array<string, mixed> $options
 * @return array<string, mixed>
 */
function srp_institution_match(
    iterable $rows,
    array $sourceRecord,
    array $options = []
): array {
    return SrpInstitutionMatcher::buildIndex($rows, $options)->match($sourceRecord);
}
