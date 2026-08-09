<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';

/**
 * Validates and deterministically serializes the six row-level JSON documents.
 */
final class SrpInstitutionJson
{
    /** @var list<string> */
    private const COLUMNS = [
        'data_sources_json',
        'data_confidence_json',
        'data_verified_json',
        'data_candidates_json',
        'pipeline_metadata_json',
        'manual_overrides_json',
    ];

    /**
     * @return array<string, mixed>
     */
    public static function decodeColumn(string $column, mixed $value): array
    {
        self::assertKnownColumn($column);
        if ($value === null || $value === '') {
            return [];
        }

        if (is_object($value)) {
            $value = get_object_vars($value);
        }
        if (is_array($value)) {
            return self::validateColumn($column, $value);
        }
        if (!is_string($value)) {
            throw new InvalidArgumentException("{$column} must be JSON, an array, or null.");
        }

        try {
            $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new InvalidArgumentException(
                "{$column} contains malformed JSON: {$error->getMessage()}",
                0,
                $error
            );
        }
        if (!is_array($decoded)) {
            throw new InvalidArgumentException("{$column} must contain a JSON object.");
        }
        return self::validateColumn($column, $decoded);
    }

    /**
     * @param array<string, mixed> $value
     */
    public static function encodeColumn(string $column, array $value): string
    {
        $validated = self::validateColumn($column, $value);
        self::sortObjectRecursively($validated);
        try {
            return json_encode(
                (object)$validated,
                JSON_THROW_ON_ERROR
                | JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
                | JSON_PRESERVE_ZERO_FRACTION
            );
        } catch (JsonException $error) {
            throw new InvalidArgumentException(
                "{$column} could not be encoded: {$error->getMessage()}",
                0,
                $error
            );
        }
    }

    /**
     * @param array<string, mixed> $value
     * @return array<string, mixed>
     */
    public static function validateColumn(string $column, array $value): array
    {
        self::assertKnownColumn($column);
        self::assertObject($value, $column);
        self::assertJsonSafe($value, $column);

        match ($column) {
            'data_sources_json' => self::validateSources($value),
            'data_confidence_json' => self::validateConfidences($value),
            'data_verified_json' => self::validateVerified($value),
            'data_candidates_json' => self::validateCandidates($value),
            'manual_overrides_json' => self::validateOverrides($value),
            'pipeline_metadata_json' => self::validatePipelineMetadata($value),
        };

        $encoded = json_encode(
            (object)$value,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        $maximum = (int)SrpInstitutionConfig::load()['max_json_bytes'];
        if (strlen($encoded) > $maximum) {
            throw new LengthException(
                "{$column} exceeds the configured {$maximum}-byte limit."
            );
        }
        return $value;
    }

    /**
     * Add or refresh one candidate and retain a deterministic bounded list.
     *
     * @param array<string, mixed> $allCandidates
     * @param array<string, mixed> $candidate
     * @return array<string, mixed>
     */
    public static function addCandidate(
        array $allCandidates,
        string $field,
        array $candidate,
        int $limit = 5
    ): array {
        self::assertFieldKey($field);
        if ($limit < 1 || $limit > 100) {
            throw new InvalidArgumentException('Candidate retention limit must be between 1 and 100.');
        }
        self::validateCandidate($candidate, "data_candidates_json.{$field}");

        $existing = $allCandidates[$field] ?? [];
        if (!is_array($existing) || (!empty($existing) && !array_is_list($existing))) {
            throw new InvalidArgumentException(
                "data_candidates_json.{$field} must contain a list."
            );
        }

        $identity = self::candidateIdentity($candidate);
        $byIdentity = [];
        foreach ($existing as $entry) {
            if (!is_array($entry)) {
                throw new InvalidArgumentException(
                    "data_candidates_json.{$field} contains an invalid candidate."
                );
            }
            self::validateCandidate($entry, "data_candidates_json.{$field}");
            $byIdentity[self::candidateIdentity($entry)] = $entry;
        }
        $byIdentity[$identity] = $candidate;

        $entries = array_values($byIdentity);
        usort($entries, [self::class, 'compareCandidates']);
        $allCandidates[$field] = array_slice($entries, 0, $limit);

        return self::validateColumn('data_candidates_json', $allCandidates);
    }

    /**
     * @param array<string, mixed> $document
     * @param string|list<string> $path
     */
    public static function get(array $document, string|array $path, mixed $default = null): mixed
    {
        $segments = self::pathSegments($path);
        $cursor = $document;
        foreach ($segments as $segment) {
            if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                return $default;
            }
            $cursor = $cursor[$segment];
        }
        return $cursor;
    }

    /**
     * @param array<string, mixed> $document
     * @param string|list<string> $path
     * @return array<string, mixed>
     */
    public static function set(array $document, string|array $path, mixed $value): array
    {
        $segments = self::pathSegments($path);
        $cursor =& $document;
        foreach ($segments as $segment) {
            if (!isset($cursor[$segment]) || !is_array($cursor[$segment])) {
                $cursor[$segment] = [];
            }
            $cursor =& $cursor[$segment];
        }
        $cursor = $value;
        unset($cursor);
        return $document;
    }

    /**
     * @param array<string, mixed> $document
     * @param string|list<string> $path
     * @return array<string, mixed>
     */
    public static function remove(array $document, string|array $path): array
    {
        $segments = self::pathSegments($path);
        $last = array_pop($segments);
        $cursor =& $document;
        foreach ($segments as $segment) {
            if (!isset($cursor[$segment]) || !is_array($cursor[$segment])) {
                return $document;
            }
            $cursor =& $cursor[$segment];
        }
        if ($last !== null) {
            unset($cursor[$last]);
        }
        unset($cursor);
        return $document;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, array<string, mixed>>
     */
    public static function metadataFromRow(array $row): array
    {
        $metadata = [];
        foreach (self::COLUMNS as $column) {
            $metadata[$column] = self::decodeColumn($column, $row[$column] ?? null);
        }
        return $metadata;
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validateSources(array $value): void
    {
        foreach ($value as $field => $source) {
            self::assertFieldKey((string)$field);
            if (!is_array($source) || array_is_list($source)) {
                throw new InvalidArgumentException(
                    "data_sources_json.{$field} must be an object."
                );
            }
            self::validateSourceDescriptor($source, "data_sources_json.{$field}", true);
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validateConfidences(array $value): void
    {
        foreach ($value as $field => $confidence) {
            self::assertFieldKey((string)$field);
            self::assertConfidence($confidence, "data_confidence_json.{$field}");
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validateVerified(array $value): void
    {
        foreach ($value as $field => $verification) {
            self::assertFieldKey((string)$field);
            if (!is_array($verification) || array_is_list($verification)) {
                throw new InvalidArgumentException(
                    "data_verified_json.{$field} must be an object."
                );
            }
            if (
                !array_key_exists('verified', $verification)
                || !is_bool($verification['verified'])
            ) {
                throw new InvalidArgumentException(
                    "data_verified_json.{$field}.verified must be boolean."
                );
            }
            self::optionalString($verification, 'verified_by', 64, "data_verified_json.{$field}");
            self::optionalDate($verification, 'verified_at', "data_verified_json.{$field}");
            self::optionalString($verification, 'notes', 2_000, "data_verified_json.{$field}");
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validateCandidates(array $value): void
    {
        $limit = (int)SrpInstitutionConfig::load()['candidate_limit'];
        foreach ($value as $field => $candidates) {
            self::assertFieldKey((string)$field);
            if (!is_array($candidates) || (!empty($candidates) && !array_is_list($candidates))) {
                throw new InvalidArgumentException(
                    "data_candidates_json.{$field} must be a list."
                );
            }
            if (count($candidates) > $limit) {
                throw new LengthException(
                    "data_candidates_json.{$field} exceeds the {$limit}-candidate limit."
                );
            }
            foreach ($candidates as $index => $candidate) {
                if (!is_array($candidate)) {
                    throw new InvalidArgumentException(
                        "data_candidates_json.{$field}.{$index} must be an object."
                    );
                }
                self::validateCandidate(
                    $candidate,
                    "data_candidates_json.{$field}.{$index}"
                );
            }
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validateOverrides(array $value): void
    {
        foreach ($value as $field => $override) {
            self::assertFieldKey((string)$field);
            if (!is_array($override) || array_is_list($override)) {
                throw new InvalidArgumentException(
                    "manual_overrides_json.{$field} must be an object."
                );
            }
            if (!array_key_exists('value', $override)) {
                throw new InvalidArgumentException(
                    "manual_overrides_json.{$field}.value is required."
                );
            }
            self::optionalUrl($override, 'source_url', "manual_overrides_json.{$field}");
            self::optionalString($override, 'notes', 4_000, "manual_overrides_json.{$field}");
            self::optionalString($override, 'verified_by', 64, "manual_overrides_json.{$field}");
            self::optionalDate($override, 'verified_at', "manual_overrides_json.{$field}");
            self::optionalDate($override, 'expires_at', "manual_overrides_json.{$field}");
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function validatePipelineMetadata(array $value): void
    {
        if (isset($value['review_reasons'])) {
            if (
                !is_array($value['review_reasons'])
                || (!empty($value['review_reasons']) && !array_is_list($value['review_reasons']))
            ) {
                throw new InvalidArgumentException(
                    'pipeline_metadata_json.review_reasons must be a list.'
                );
            }
            if (count($value['review_reasons']) > 100) {
                throw new LengthException(
                    'pipeline_metadata_json.review_reasons exceeds 100 entries.'
                );
            }
            foreach ($value['review_reasons'] as $reason) {
                if (!is_string($reason) || strlen($reason) > 500) {
                    throw new InvalidArgumentException(
                        'Each pipeline review reason must be a string of at most 500 bytes.'
                    );
                }
            }
        }
        foreach (
            [
                'last_ipeds_import',
                'last_scorecard_import',
                'last_wikidata_import',
                'last_official_site_crawl',
            ] as $dateKey
        ) {
            self::optionalDate($value, $dateKey, 'pipeline_metadata_json');
        }
        if (isset($value['match_score'])) {
            self::assertConfidence(
                $value['match_score'],
                'pipeline_metadata_json.match_score'
            );
        }
    }

    /**
     * @param array<string, mixed> $candidate
     */
    private static function validateCandidate(array $candidate, string $path): void
    {
        if (array_is_list($candidate)) {
            throw new InvalidArgumentException("{$path} must be an object.");
        }
        if (!array_key_exists('value', $candidate)) {
            throw new InvalidArgumentException("{$path}.value is required.");
        }
        self::validateSourceDescriptor($candidate, $path, false);
        if (isset($candidate['confidence'])) {
            self::assertConfidence($candidate['confidence'], "{$path}.confidence");
        }
        if (isset($candidate['match_confidence'])) {
            self::assertConfidence(
                $candidate['match_confidence'],
                "{$path}.match_confidence"
            );
        }
        if (isset($candidate['selected']) && !is_bool($candidate['selected'])) {
            throw new InvalidArgumentException("{$path}.selected must be boolean.");
        }
        self::optionalString($candidate, 'status', 40, $path);
        self::optionalString($candidate, 'reason', 500, $path);

        $encodedValue = json_encode(
            $candidate['value'],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        if (strlen($encodedValue) > 32_768) {
            throw new LengthException("{$path}.value exceeds 32,768 bytes.");
        }
    }

    /**
     * @param array<string, mixed> $descriptor
     */
    private static function validateSourceDescriptor(
        array $descriptor,
        string $path,
        bool $sourceRequired
    ): void {
        if ($sourceRequired && !isset($descriptor['source_type'])) {
            throw new InvalidArgumentException("{$path}.source_type is required.");
        }
        if (isset($descriptor['source_type'])) {
            if (
                !is_string($descriptor['source_type'])
                || preg_match('/^[a-z][a-z0-9_]{0,63}$/', $descriptor['source_type']) !== 1
            ) {
                throw new InvalidArgumentException(
                    "{$path}.source_type must use lowercase snake_case."
                );
            }
        }
        self::optionalUrl($descriptor, 'source_url', $path);
        self::optionalString($descriptor, 'source_record_id', 255, $path);
        self::optionalDate($descriptor, 'retrieved_at', $path);
        self::optionalDate($descriptor, 'last_seen_at', $path);
    }

    private static function assertConfidence(mixed $value, string $path): void
    {
        if (!is_int($value) && !is_float($value)) {
            throw new InvalidArgumentException("{$path} must be numeric.");
        }
        $confidence = (float)$value;
        if (!is_finite($confidence) || $confidence < 0.0 || $confidence > 1.0) {
            throw new InvalidArgumentException("{$path} must be between 0 and 1.");
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function optionalString(
        array $value,
        string $key,
        int $maximum,
        string $path
    ): void {
        if (!array_key_exists($key, $value) || $value[$key] === null) {
            return;
        }
        if (!is_string($value[$key]) || strlen($value[$key]) > $maximum) {
            throw new InvalidArgumentException(
                "{$path}.{$key} must be a string of at most {$maximum} bytes."
            );
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function optionalUrl(array $value, string $key, string $path): void
    {
        if (!array_key_exists($key, $value) || $value[$key] === null || $value[$key] === '') {
            return;
        }
        if (
            !is_string($value[$key])
            || strlen($value[$key]) > 2_048
            || filter_var($value[$key], FILTER_VALIDATE_URL) === false
        ) {
            throw new InvalidArgumentException("{$path}.{$key} must be a valid URL.");
        }
        $scheme = strtolower((string)parse_url($value[$key], PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException("{$path}.{$key} must use HTTP or HTTPS.");
        }
    }

    /**
     * @param array<string, mixed> $value
     */
    private static function optionalDate(array $value, string $key, string $path): void
    {
        if (!array_key_exists($key, $value) || $value[$key] === null || $value[$key] === '') {
            return;
        }
        if (!is_string($value[$key]) || strlen($value[$key]) > 40) {
            throw new InvalidArgumentException("{$path}.{$key} must be a date string.");
        }
        if (
            preg_match(
                '/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?)?$/',
                $value[$key]
            ) !== 1
        ) {
            throw new InvalidArgumentException(
                "{$path}.{$key} must use ISO-8601 or MySQL date-time format."
            );
        }
        try {
            new DateTimeImmutable($value[$key]);
        } catch (Throwable $error) {
            throw new InvalidArgumentException("{$path}.{$key} is not a valid date.", 0, $error);
        }
    }

    /**
     * @param array<mixed> $value
     */
    private static function assertObject(array $value, string $path): void
    {
        if ($value !== [] && array_is_list($value)) {
            throw new InvalidArgumentException("{$path} must contain a JSON object.");
        }
    }

    private static function assertFieldKey(string $field): void
    {
        if (preg_match('/^[a-z][a-z0-9_]{0,63}$/', $field) !== 1) {
            throw new InvalidArgumentException(
                "Invalid institution metadata field key: {$field}"
            );
        }
    }

    private static function assertKnownColumn(string $column): void
    {
        if (!in_array($column, self::COLUMNS, true)) {
            throw new InvalidArgumentException(
                "Unknown institution JSON column: {$column}"
            );
        }
    }

    private static function assertJsonSafe(mixed $value, string $path, int $depth = 0): void
    {
        if ($depth > 16) {
            throw new LengthException("{$path} exceeds the maximum JSON nesting depth.");
        }
        if (is_resource($value) || $value instanceof Closure) {
            throw new InvalidArgumentException("{$path} contains a non-JSON value.");
        }
        if (is_float($value) && !is_finite($value)) {
            throw new InvalidArgumentException("{$path} contains a non-finite number.");
        }
        if (is_object($value)) {
            throw new InvalidArgumentException("{$path} must not contain PHP objects.");
        }
        if (is_array($value)) {
            if (count($value) > 1_000) {
                throw new LengthException("{$path} contains too many entries.");
            }
            foreach ($value as $key => $nested) {
                self::assertJsonSafe($nested, "{$path}.{$key}", $depth + 1);
            }
            return;
        }
        if (
            $value !== null
            && !is_string($value)
            && !is_int($value)
            && !is_float($value)
            && !is_bool($value)
        ) {
            throw new InvalidArgumentException("{$path} contains a non-JSON value.");
        }
    }

    /**
     * @param string|list<string> $path
     * @return list<string>
     */
    private static function pathSegments(string|array $path): array
    {
        $segments = is_string($path) ? explode('.', $path) : $path;
        $segments = array_values(array_filter(
            array_map(static fn (mixed $part): string => trim((string)$part), $segments),
            static fn (string $part): bool => $part !== ''
        ));
        if ($segments === []) {
            throw new InvalidArgumentException('JSON path cannot be empty.');
        }
        return $segments;
    }

    /**
     * @param array<string, mixed> $candidate
     */
    private static function candidateIdentity(array $candidate): string
    {
        $identity = [
            'value' => $candidate['value'] ?? null,
            'source_type' => strtolower(trim((string)($candidate['source_type'] ?? 'unknown'))),
            'source_url' => trim((string)($candidate['source_url'] ?? '')),
            'source_record_id' => trim((string)($candidate['source_record_id'] ?? '')),
        ];
        self::sortObjectRecursively($identity);
        return hash(
            'sha256',
            json_encode(
                $identity,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            )
        );
    }

    /**
     * @param array<string, mixed> $left
     * @param array<string, mixed> $right
     */
    private static function compareCandidates(array $left, array $right): int
    {
        $leftRetention = self::candidateRetentionRank($left);
        $rightRetention = self::candidateRetentionRank($right);
        if ($leftRetention !== $rightRetention) {
            return $rightRetention <=> $leftRetention;
        }

        $leftConfidence = is_numeric($left['confidence'] ?? null)
            ? (float)$left['confidence']
            : SrpInstitutionConfig::sourcePriority((string)($left['source_type'] ?? 'unknown'));
        $rightConfidence = is_numeric($right['confidence'] ?? null)
            ? (float)$right['confidence']
            : SrpInstitutionConfig::sourcePriority((string)($right['source_type'] ?? 'unknown'));
        if (abs($leftConfidence - $rightConfidence) > 0.000001) {
            return $rightConfidence <=> $leftConfidence;
        }

        $leftRetrieved = (string)($left['retrieved_at'] ?? '');
        $rightRetrieved = (string)($right['retrieved_at'] ?? '');
        if ($leftRetrieved !== $rightRetrieved) {
            return strcmp($rightRetrieved, $leftRetrieved);
        }
        return strcmp(self::candidateIdentity($left), self::candidateIdentity($right));
    }

    /**
     * @param array<string, mixed> $candidate
     */
    private static function candidateRetentionRank(array $candidate): int
    {
        if (($candidate['selected'] ?? false) === true) {
            return 4;
        }
        $status = strtolower((string)($candidate['status'] ?? ''));
        if (in_array($status, ['manual_rejected', 'approved', 'rejected'], true)) {
            return 3;
        }
        return 1;
    }

    /**
     * @param array<mixed> $value
     */
    private static function sortObjectRecursively(array &$value): void
    {
        if ($value !== [] && !array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as &$nested) {
            if (is_array($nested)) {
                self::sortObjectRecursively($nested);
            }
        }
        unset($nested);
    }
}

/**
 * @return array<string, mixed>
 */
function srp_institution_json_decode(string $column, mixed $value): array
{
    return SrpInstitutionJson::decodeColumn($column, $value);
}

/**
 * @param array<string, mixed> $value
 */
function srp_institution_json_encode(string $column, array $value): string
{
    return SrpInstitutionJson::encodeColumn($column, $value);
}

/**
 * @param array<string, mixed> $allCandidates
 * @param array<string, mixed> $candidate
 * @return array<string, mixed>
 */
function srp_institution_add_candidate(
    array $allCandidates,
    string $field,
    array $candidate,
    int $limit = 5
): array {
    return SrpInstitutionJson::addCandidate($allCandidates, $field, $candidate, $limit);
}
