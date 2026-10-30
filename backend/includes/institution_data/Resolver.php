<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Json.php';
require_once __DIR__ . '/FieldPolicy.php';
require_once __DIR__ . '/License.php';

/**
 * Deterministic field-level winner selection.
 */
final class SrpInstitutionResolver
{
    /** @var list<string> */
    private const JSON_COLUMNS = [
        'data_sources_json',
        'data_confidence_json',
        'data_verified_json',
        'data_candidates_json',
        'pipeline_metadata_json',
        'manual_overrides_json',
    ];

    /** @var list<string> */
    private const IDENTITY_CHANGE_FIELDS = [
        'ipeds_unitid',
        'ope_id',
        'wikidata_id',
        'official_name',
        'normalized_domain',
        'city',
        'state',
        'operating_status',
        'pipeline_active',
    ];

    /**
     * @param array<string, mixed> $incomingCandidate
     * @param array<string, mixed> $rowMetadata
     * @return array{
     *   selected: bool,
     *   changed: bool,
     *   value: mixed,
     *   source: ?array,
     *   confidence: ?float,
     *   candidates: array,
     *   review_required: bool,
     *   review_reason: ?string,
     *   reason: string,
     *   metadata: array<string, array<string, mixed>>
     * }
     */
    public static function resolveField(
        string $field,
        mixed $currentValue,
        array $incomingCandidate,
        array $rowMetadata = []
    ): array {
        $policy = SrpInstitutionFieldPolicy::forField($field);
        if ($policy === null) {
            throw new InvalidArgumentException(
                "Field {$field} is not managed by the institution pipeline."
            );
        }
        if (!array_key_exists('value', $incomingCandidate)) {
            throw new InvalidArgumentException('Incoming candidate must contain a value.');
        }
        $sourceType = SrpInstitutionFieldPolicy::canonicalSourceType(
            (string)($incomingCandidate['source_type'] ?? '')
        );
        if ($sourceType === '') {
            throw new InvalidArgumentException('Incoming candidate must contain a source_type.');
        }
        $incomingCandidate['source_type'] = $sourceType;
        $metadata = self::normalizeMetadata($rowMetadata);
        $candidateLimit = self::candidateLimit($rowMetadata);
        $currentNormalized = SrpInstitutionFieldPolicy::normalize($field, $currentValue);

        $override = $metadata['manual_overrides_json'][$field] ?? null;
        if (is_array($override) && self::overrideIsActive($override)) {
            $overrideValue = SrpInstitutionFieldPolicy::normalize(
                $field,
                $override['value'] ?? null
            );
            if ($overrideValue !== null) {
                return self::manualOverrideResult(
                    $field,
                    $currentNormalized,
                    $overrideValue,
                    $override,
                    $incomingCandidate,
                    $metadata,
                    $candidateLimit
                );
            }
        }

        $incomingValue = SrpInstitutionFieldPolicy::normalize(
            $field,
            $incomingCandidate['value']
        );
        if ($incomingValue === null) {
            $reason = in_array($field, ['primary_color', 'secondary_color'], true)
                && SrpInstitutionColor::isPantone($incomingCandidate['value'])
                ? 'pantone_requires_cited_conversion'
                : 'incoming_value_missing_or_invalid';
            $storedCandidate = self::candidateForStorage(
                $incomingCandidate,
                $incomingCandidate['value'],
                0.0,
                false,
                'needs_review',
                $reason
            );
            $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
                $metadata['data_candidates_json'],
                $field,
                $storedCandidate,
                $candidateLimit
            );
            $review = $reason === 'pantone_requires_cited_conversion';
            return self::result(
                false,
                false,
                $currentNormalized,
                self::currentSource($field, $currentNormalized, $metadata, $policy),
                self::currentConfidence($field, $currentNormalized, $metadata, $policy),
                $field,
                $metadata,
                $review,
                $review ? $reason : null,
                $reason
            );
        }

        if (!SrpInstitutionFieldPolicy::allowsSource($field, $sourceType)) {
            $reason = 'source_not_allowed_for_field';
            $storedCandidate = self::candidateForStorage(
                $incomingCandidate,
                $incomingValue,
                0.0,
                false,
                'rejected',
                $reason
            );
            $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
                $metadata['data_candidates_json'],
                $field,
                $storedCandidate,
                $candidateLimit
            );
            return self::result(
                false,
                false,
                $currentNormalized,
                self::currentSource($field, $currentNormalized, $metadata, $policy),
                self::currentConfidence($field, $currentNormalized, $metadata, $policy),
                $field,
                $metadata,
                true,
                $reason,
                $reason
            );
        }

        if (
            in_array($field, ['logo_url', 'logo_thumbnail_url'], true)
            && $sourceType !== 'manual_verified'
        ) {
            $licenseDecision = SrpInstitutionLicense::logoCandidate($incomingCandidate);
            if (($licenseDecision['status'] ?? 'review') !== 'allowed') {
                $reason = (string)($licenseDecision['reason'] ?? 'logo_license_requires_review');
                $storedCandidate = self::candidateForStorage(
                    $incomingCandidate,
                    $incomingValue,
                    self::incomingConfidence($incomingCandidate, $rowMetadata),
                    false,
                    ($licenseDecision['status'] ?? '') === 'blocked'
                        ? 'license_blocked'
                        : 'license_review',
                    $reason
                );
                $storedCandidate['license_decision'] = $licenseDecision;
                $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
                    $metadata['data_candidates_json'],
                    $field,
                    $storedCandidate,
                    $candidateLimit
                );
                return self::result(
                    false,
                    false,
                    $currentNormalized,
                    self::currentSource($field, $currentNormalized, $metadata, $policy),
                    self::currentConfidence($field, $currentNormalized, $metadata, $policy),
                    $field,
                    $metadata,
                    true,
                    $reason,
                    'logo_license_not_selectable'
                );
            }
        }

        $incomingConfidence = self::incomingConfidence($incomingCandidate, $rowMetadata);
        $currentSource = self::currentSource($field, $currentNormalized, $metadata, $policy);
        $currentConfidence = self::currentConfidence(
            $field,
            $currentNormalized,
            $metadata,
            $policy
        );
        $verification = $metadata['data_verified_json'][$field] ?? null;
        $currentVerified = is_array($verification)
            && ($verification['verified'] ?? false) === true;

        if (($policy['strategy'] ?? 'replace') === 'merge_list') {
            $merged = SrpInstitutionFieldPolicy::mergeLists(
                $currentNormalized,
                $incomingValue
            );
            $changed = !SrpInstitutionFieldPolicy::valuesEqual(
                $field,
                $currentNormalized,
                $merged
            );
            $source = self::sourceDescriptor($incomingCandidate);
            $metadata = self::selectMetadata(
                $field,
                $source,
                max($currentConfidence ?? 0.0, $incomingConfidence),
                $incomingCandidate,
                $merged,
                $metadata,
                $candidateLimit
            );
            return self::result(
                true,
                $changed,
                $merged,
                $source,
                max($currentConfidence ?? 0.0, $incomingConfidence),
                $field,
                $metadata,
                false,
                null,
                $changed ? 'list_values_merged' : 'same_value'
            );
        }

        if (
            $currentNormalized !== null
            && SrpInstitutionFieldPolicy::valuesEqual(
                $field,
                $currentNormalized,
                $incomingValue
            )
        ) {
            $incomingSource = self::sourceDescriptor($incomingCandidate);
            $source = $currentSource;
            $confidence = $currentConfidence;
            if (
                $source === null
                || $incomingConfidence > ($currentConfidence ?? 0.0) + 0.000001
            ) {
                $source = $incomingSource;
                $confidence = max($incomingConfidence, $currentConfidence ?? 0.0);
            } elseif (self::sameSourceIdentity($source, $incomingSource)) {
                // Preserve retrieval metadata for an unchanged, repeated import.
                $confidence = max($incomingConfidence, $currentConfidence ?? 0.0);
            }
            $metadata = self::selectMetadata(
                $field,
                $source ?? $incomingSource,
                $confidence ?? $incomingConfidence,
                $incomingCandidate,
                $currentNormalized,
                $metadata,
                $candidateLimit
            );
            return self::result(
                true,
                false,
                $currentNormalized,
                $source ?? $incomingSource,
                $confidence ?? $incomingConfidence,
                $field,
                $metadata,
                false,
                null,
                'same_value'
            );
        }

        if ($currentNormalized === null) {
            $source = self::sourceDescriptor($incomingCandidate);
            $metadata = self::selectMetadata(
                $field,
                $source,
                $incomingConfidence,
                $incomingCandidate,
                $incomingValue,
                $metadata,
                $candidateLimit
            );
            return self::result(
                true,
                true,
                $incomingValue,
                $source,
                $incomingConfidence,
                $field,
                $metadata,
                false,
                null,
                'empty_value_filled'
            );
        }

        $storedCandidate = self::candidateForStorage(
            $incomingCandidate,
            $incomingValue,
            $incomingConfidence,
            false,
            'alternative',
            'conflicts_with_selected_value'
        );
        $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
            $metadata['data_candidates_json'],
            $field,
            $storedCandidate,
            $candidateLimit
        );

        if ($currentVerified) {
            return self::result(
                false,
                false,
                $currentNormalized,
                $currentSource,
                $currentConfidence,
                $field,
                $metadata,
                true,
                'verified_value_conflict',
                'verified_value_preserved'
            );
        }

        $delta = $incomingConfidence - ($currentConfidence ?? 0.0);
        $conflictDelta = (float)($policy['conflict_delta'] ?? 0.05);
        if ($delta <= $conflictDelta) {
            $reason = abs($delta) <= $conflictDelta
                ? 'similarly_reliable_sources_disagree'
                : 'lower_confidence_value_rejected';
            // Keeping the better source is the expected outcome, not an
            // administrative question. Only a materially different value is
            // worth a reviewer's time; an equivalent URL form or a coordinate
            // that agrees to within campus distance is not.
            $review = self::materiallyDifferent(
                $field,
                $currentNormalized,
                $incomingValue
            );
            return self::result(
                false,
                false,
                $currentNormalized,
                $currentSource,
                $currentConfidence,
                $field,
                $metadata,
                $review,
                $review ? $reason : null,
                $reason
            );
        }

        $source = self::sourceDescriptor($incomingCandidate);
        $reviewReason = self::identityReviewReason($field, $currentNormalized, $incomingValue);
        $metadata = self::selectMetadata(
            $field,
            $source,
            $incomingConfidence,
            $incomingCandidate,
            $incomingValue,
            $metadata,
            $candidateLimit
        );
        return self::result(
            true,
            true,
            $incomingValue,
            $source,
            $incomingConfidence,
            $field,
            $metadata,
            $reviewReason !== null,
            $reviewReason,
            'higher_confidence_value_selected'
        );
    }

    /**
     * @param array<string, mixed> $rowMetadata
     * @return array<string, array<string, mixed>>
     */
    private static function normalizeMetadata(array $rowMetadata): array
    {
        $metadata = [];
        foreach (self::JSON_COLUMNS as $column) {
            $metadata[$column] = SrpInstitutionJson::decodeColumn(
                $column,
                $rowMetadata[$column] ?? null
            );
        }
        return $metadata;
    }

    /**
     * @param array<string, mixed> $rowMetadata
     */
    private static function candidateLimit(array $rowMetadata): int
    {
        $limit = $rowMetadata['candidate_limit']
            ?? SrpInstitutionConfig::load()['candidate_limit'];
        $limit = filter_var($limit, FILTER_VALIDATE_INT);
        return is_int($limit) && $limit >= 1 && $limit <= 20 ? $limit : 5;
    }

    /**
     * @param array<string, mixed> $override
     */
    private static function overrideIsActive(array $override): bool
    {
        $expiresAt = trim((string)($override['expires_at'] ?? ''));
        if ($expiresAt === '') {
            return true;
        }
        try {
            return new DateTimeImmutable($expiresAt) > new DateTimeImmutable('now');
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @param array<string, mixed> $override
     * @param array<string, mixed> $incomingCandidate
     * @param array<string, array<string, mixed>> $metadata
     * @return array<string, mixed>
     */
    private static function manualOverrideResult(
        string $field,
        mixed $currentValue,
        mixed $overrideValue,
        array $override,
        array $incomingCandidate,
        array $metadata,
        int $candidateLimit
    ): array {
        $overrideSource = [
            'source_type' => 'manual_verified',
            'source_url' => $override['source_url'] ?? null,
            'source_record_id' => $override['verified_by'] ?? null,
            'retrieved_at' => $override['verified_at'] ?? gmdate(DATE_ATOM),
        ];
        $overrideSource = array_filter(
            $overrideSource,
            static fn (mixed $value): bool => $value !== null && $value !== ''
        );

        $incomingValue = SrpInstitutionFieldPolicy::normalize(
            $field,
            $incomingCandidate['value'] ?? null
        );
        if (
            $incomingValue !== null
            && !SrpInstitutionFieldPolicy::valuesEqual($field, $overrideValue, $incomingValue)
        ) {
            $candidate = self::candidateForStorage(
                $incomingCandidate,
                $incomingValue,
                self::incomingConfidence($incomingCandidate, []),
                false,
                'alternative',
                'manual_override_preserved'
            );
            $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
                $metadata['data_candidates_json'],
                $field,
                $candidate,
                $candidateLimit
            );
        }

        $metadata['data_sources_json'][$field] = $overrideSource;
        $metadata['data_confidence_json'][$field] = 1.0;
        $metadata['data_verified_json'][$field] = [
            'verified' => true,
            'verified_by' => $override['verified_by'] ?? null,
            'verified_at' => $override['verified_at'] ?? gmdate(DATE_ATOM),
        ];
        $metadata['data_verified_json'][$field] = array_filter(
            $metadata['data_verified_json'][$field],
            static fn (mixed $value): bool => $value !== null && $value !== ''
        );
        self::clearFieldReviewReasons($metadata, $field);

        return self::result(
            false,
            !SrpInstitutionFieldPolicy::valuesEqual($field, $currentValue, $overrideValue),
            $overrideValue,
            $overrideSource,
            1.0,
            $field,
            $metadata,
            false,
            null,
            'manual_override_selected'
        );
    }

    /**
     * @param array<string, mixed> $candidate
     * @param array<string, mixed> $rowMetadata
     */
    private static function incomingConfidence(
        array $candidate,
        array $rowMetadata
    ): float {
        $sourceType = (string)($candidate['source_type'] ?? 'unknown');
        $sourcePriority = SrpInstitutionFieldPolicy::sourcePriority($sourceType);
        $declared = isset($candidate['confidence']) && is_numeric($candidate['confidence'])
            ? max(0.0, min(1.0, (float)$candidate['confidence']))
            : $sourcePriority;
        $match = $candidate['match_confidence']
            ?? $rowMetadata['match_confidence']
            ?? 1.0;
        $match = is_numeric($match) ? max(0.0, min(1.0, (float)$match)) : 1.0;
        if ($sourceType === 'manual_verified') {
            return 1.0;
        }
        return round(min($sourcePriority, $declared) * $match, 4);
    }

    /**
     * @param array<string, array<string, mixed>> $metadata
     * @param array<string, mixed> $policy
     * @return array<string, mixed>|null
     */
    private static function currentSource(
        string $field,
        mixed $currentValue,
        array $metadata,
        array $policy
    ): ?array {
        $source = $metadata['data_sources_json'][$field] ?? null;
        if (is_array($source)) {
            return $source;
        }
        if ($currentValue === null) {
            return null;
        }
        return [
            'source_type' => ($policy['protect_untracked'] ?? false)
                ? 'platform_existing'
                : 'unknown',
        ];
    }

    /**
     * @param array<string, array<string, mixed>> $metadata
     * @param array<string, mixed> $policy
     */
    private static function currentConfidence(
        string $field,
        mixed $currentValue,
        array $metadata,
        array $policy
    ): ?float {
        $confidence = $metadata['data_confidence_json'][$field] ?? null;
        if (is_numeric($confidence)) {
            return max(0.0, min(1.0, (float)$confidence));
        }
        if ($currentValue === null) {
            return null;
        }
        return SrpInstitutionFieldPolicy::sourcePriority(
            ($policy['protect_untracked'] ?? false)
                ? 'platform_existing'
                : 'unknown'
        );
    }

    /**
     * @param array<string, mixed> $candidate
     * @return array<string, mixed>
     */
    private static function sourceDescriptor(array $candidate): array
    {
        $source = [
            'source_type' => (string)$candidate['source_type'],
            'source_url' => $candidate['source_url'] ?? null,
            'source_record_id' => $candidate['source_record_id'] ?? null,
            'retrieved_at' => $candidate['retrieved_at'] ?? null,
        ];
        return array_filter(
            $source,
            static fn (mixed $value): bool => $value !== null && $value !== ''
        );
    }

    /**
     * @param array<string, mixed> $left
     * @param array<string, mixed> $right
     */
    private static function sameSourceIdentity(array $left, array $right): bool
    {
        foreach (['source_type', 'source_url', 'source_record_id'] as $key) {
            if ((string)($left[$key] ?? '') !== (string)($right[$key] ?? '')) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param array<string, mixed> $candidate
     * @return array<string, mixed>
     */
    private static function candidateForStorage(
        array $candidate,
        mixed $value,
        float $confidence,
        bool $selected,
        string $status,
        string $reason
    ): array {
        $stored = [
            'value' => $value,
            'source_type' => (string)($candidate['source_type'] ?? 'unknown'),
            'source_url' => $candidate['source_url'] ?? null,
            'source_record_id' => $candidate['source_record_id'] ?? null,
            'retrieved_at' => $candidate['retrieved_at'] ?? null,
            'confidence' => round(max(0.0, min(1.0, $confidence)), 4),
            'selected' => $selected,
            'status' => $status,
            'reason' => $reason,
        ];
        foreach (
            [
                'logo_type',
                'logo_license_name',
                'logo_license_url',
                'logo_attribution',
                'license',
                'approximation',
                'conversion_source',
                'original_value',
            ] as $key
        ) {
            if (array_key_exists($key, $candidate)) {
                $stored[$key] = $candidate[$key];
            }
        }
        // A null candidate is useful evidence that a source omitted a value,
        // and the JSON schema requires every candidate to retain its `value`
        // key. Remove empty optional metadata without dropping that key.
        foreach ($stored as $key => $entry) {
            if ($key !== 'value' && ($entry === null || $entry === '')) {
                unset($stored[$key]);
            }
        }
        return $stored;
    }

    /**
     * @param array<string, mixed> $source
     * @param array<string, mixed> $incomingCandidate
     * @param array<string, array<string, mixed>> $metadata
     * @return array<string, array<string, mixed>>
     */
    private static function selectMetadata(
        string $field,
        array $source,
        float $confidence,
        array $incomingCandidate,
        mixed $selectedValue,
        array $metadata,
        int $candidateLimit
    ): array {
        $existingSource = $metadata['data_sources_json'][$field] ?? null;
        if (
            is_array($existingSource)
            && self::sameSourceIdentity($existingSource, $source)
            && SrpInstitutionFieldPolicy::valuesEqual(
                $field,
                $selectedValue,
                $incomingCandidate['value'] ?? null
            )
        ) {
            $source = $existingSource;
        }
        $metadata['data_sources_json'][$field] = $source;
        $metadata['data_confidence_json'][$field] = round($confidence, 4);
        if (
            ($incomingCandidate['verified'] ?? false) === true
            && ($incomingCandidate['source_type'] ?? '') === 'manual_verified'
        ) {
            $metadata['data_verified_json'][$field] = [
                'verified' => true,
                'verified_by' => $incomingCandidate['verified_by'] ?? null,
                'verified_at' => $incomingCandidate['verified_at']
                    ?? $incomingCandidate['retrieved_at']
                    ?? gmdate(DATE_ATOM),
            ];
            $metadata['data_verified_json'][$field] = array_filter(
                $metadata['data_verified_json'][$field],
                static fn (mixed $value): bool => $value !== null && $value !== ''
            );
        }
        $selectedCandidate = self::candidateForStorage(
            $incomingCandidate,
            $selectedValue,
            $confidence,
            true,
            'selected',
            'selected_value'
        );
        $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
            $metadata['data_candidates_json'],
            $field,
            $selectedCandidate,
            $candidateLimit
        );
        return $metadata;
    }

    /**
     * Whether a rejected candidate disagrees with the kept value in a way a
     * reviewer could act on.
     *
     * A secondary source restating the same site with a different scheme or
     * `www.`, or placing a campus a few hundred metres away, is agreement in
     * substance. Treating those as conflicts buries the genuine ones: on the
     * first production enrichment they accounted for 8,695 of 8,709 flags.
     */
    private static function materiallyDifferent(
        string $field,
        mixed $current,
        mixed $incoming
    ): bool {
        if ($current === null || $incoming === null) {
            return true;
        }
        if (SrpInstitutionFieldPolicy::valuesEqual($field, $current, $incoming)) {
            return false;
        }
        if (in_array($field, ['website', 'official_website', 'normalized_domain'], true)) {
            $currentDomain = SrpInstitutionNormalizer::domain($current);
            $incomingDomain = SrpInstitutionNormalizer::domain($incoming);
            if ($currentDomain !== null && $currentDomain === $incomingDomain) {
                return false;
            }
        }
        if (in_array($field, ['latitude', 'longitude'], true)
            && is_numeric($current)
            && is_numeric($incoming)
        ) {
            // ~1.1km: two directories pointing at different buildings on one
            // campus agree for review purposes. The stored value is unchanged.
            return abs((float)$current - (float)$incoming) > 0.01;
        }
        return true;
    }

    private static function identityReviewReason(
        string $field,
        mixed $current,
        mixed $incoming
    ): ?string {
        if (!in_array($field, self::IDENTITY_CHANGE_FIELDS, true)) {
            return null;
        }
        if ($field === 'operating_status') {
            $status = strtolower((string)$incoming);
            if (
                str_contains($status, 'closed')
                || str_contains($status, 'merge')
                || str_contains($status, 'inactive')
            ) {
                return 'operating_status_change_requires_review';
            }
        }
        if ($field === 'pipeline_active' && $current === true && $incoming === false) {
            return 'institution_deactivation_requires_review';
        }
        return match ($field) {
            'official_name' => 'official_name_change_requires_review',
            'normalized_domain' => 'official_domain_change_requires_review',
            'city', 'state' => 'institution_relocation_requires_review',
            'ipeds_unitid', 'ope_id', 'wikidata_id' =>
                'external_identifier_change_requires_review',
            default => null,
        };
    }

    /**
     * @param array<string, array<string, mixed>> $metadata
     */
    private static function clearFieldReviewReasons(array &$metadata, string $field): void
    {
        $reasons = $metadata['pipeline_metadata_json']['review_reasons'] ?? [];
        if (!is_array($reasons)) {
            return;
        }
        $prefix = $field . ':';
        $metadata['pipeline_metadata_json']['review_reasons'] = array_values(
            array_filter(
                $reasons,
                static fn (mixed $reason): bool =>
                    !is_string($reason) || !str_starts_with($reason, $prefix)
            )
        );
    }

    /**
     * @param array<string, array<string, mixed>> $metadata
     * @return array<string, mixed>
     */
    private static function result(
        bool $selected,
        bool $changed,
        mixed $value,
        ?array $source,
        ?float $confidence,
        string $field,
        array $metadata,
        bool $reviewRequired,
        ?string $reviewReason,
        string $reason
    ): array {
        if ($reviewRequired && $reviewReason !== null) {
            $reviewEntry = "{$field}:{$reviewReason}";
            $reasons = $metadata['pipeline_metadata_json']['review_reasons'] ?? [];
            if (!is_array($reasons)) {
                $reasons = [];
            }
            if (!in_array($reviewEntry, $reasons, true)) {
                $reasons[] = $reviewEntry;
            }
            $metadata['pipeline_metadata_json']['review_reasons'] = $reasons;
        }
        foreach (self::JSON_COLUMNS as $column) {
            $metadata[$column] = SrpInstitutionJson::validateColumn(
                $column,
                $metadata[$column]
            );
        }
        return [
            'selected' => $selected,
            'changed' => $changed,
            'value' => $value,
            'source' => $source,
            'confidence' => $confidence !== null ? round($confidence, 4) : null,
            'candidates' => $metadata['data_candidates_json'][$field] ?? [],
            'review_required' => $reviewRequired,
            'review_reason' => $reviewReason,
            'reason' => $reason,
            'metadata' => $metadata,
        ];
    }
}

/**
 * @param array<string, mixed> $incomingCandidate
 * @param array<string, mixed> $rowMetadata
 * @return array<string, mixed>
 */
function srp_institution_resolve_field(
    string $field,
    mixed $currentValue,
    array $incomingCandidate,
    array $rowMetadata = []
): array {
    return SrpInstitutionResolver::resolveField(
        $field,
        $currentValue,
        $incomingCandidate,
        $rowMetadata
    );
}
