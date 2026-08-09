<?php

declare(strict_types=1);

require_once __DIR__ . '/Json.php';
require_once __DIR__ . '/ReportWriter.php';

/**
 * The only write gateway used by automated institution sources.
 *
 * It updates the existing communities row field-by-field and never writes a
 * DELETE, changes an internal ID, changes community_type, reparents a row, or
 * touches platform content relationships.
 */
final class SrpInstitutionRepository
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
    private const VALUE_JSON_COLUMNS = [
        'aliases',
        'former_names',
    ];

    /** @var list<string> */
    private const PIPELINE_STATE_COLUMNS = [
        'last_seen_at',
        'last_directory_refresh_at',
        'last_branding_refresh_at',
        'last_logo_check_at',
        'pipeline_active',
        'pipeline_review_required',
        'pipeline_match_method',
        'pipeline_match_confidence',
        'pipeline_data_confidence',
        'pipeline_last_error',
        'pipeline_last_error_at',
        'pipeline_version',
    ];

    private PDO $db;
    /** @var array<string, mixed> */
    private array $config;
    private SrpInstitutionReportWriter $reporter;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(
        PDO $db,
        array $config,
        SrpInstitutionReportWriter $reporter
    ) {
        $this->db = $db;
        $this->config = $config;
        $this->reporter = $reporter;
    }

    /**
     * Internal reads intentionally include pipeline metadata. They never leave
     * the backend process.
     *
     * @return list<array<string, mixed>>
     */
    public function allUniversities(): array
    {
        return $this->db->query(
            "SELECT * FROM communities
             WHERE community_type = 'university'
             ORDER BY id"
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array<string, mixed> $sourceRecord
     * @param array<string, mixed> $match
     * @return array<string, mixed>
     */
    public function plan(array $sourceRecord, array $match): array
    {
        $this->validateSourceRecord($sourceRecord);
        $row = isset($match['row']) && is_array($match['row']) ? $match['row'] : null;
        if ($row === null) {
            if (!$this->safeToInsert($sourceRecord)) {
                return [
                    'action' => 'unmatched',
                    'source_record' => $sourceRecord,
                    'match' => $match,
                    'reason' => 'Source identity is not strong enough for an automatic insert.',
                ];
            }
            return $this->planInsert($sourceRecord, $match);
        }
        if (($row['community_type'] ?? null) !== 'university') {
            return [
                'action' => 'unmatched',
                'source_record' => $sourceRecord,
                'match' => $match,
                'reason' => 'The best candidate is not a university row.',
            ];
        }
        return $this->planUpdate($row, $sourceRecord, $match);
    }

    /**
     * @param array<string, mixed> $plan
     * @return array<string, mixed>
     */
    public function apply(array $plan): array
    {
        $action = (string)($plan['action'] ?? '');
        if ($action === 'noop' || $action === 'unmatched' || $action === 'duplicate_match') {
            return $plan;
        }
        if ($action === 'insert') {
            return $this->applyInsert($plan);
        }
        if ($action === 'update') {
            return $this->applyUpdate($plan);
        }
        throw new InvalidArgumentException("Unknown institution plan action: {$action}");
    }

    /**
     * A disappearance from one directory release is review evidence, not
     * permission to delete or merge a row. Explicit IPEDS operating-status
     * fields are handled through normal source resolution.
     *
     * @param array<string, mixed> $row
     */
    public function flagMissingFromDirectory(array $row, bool $dryRun): bool
    {
        if (($row['community_type'] ?? null) !== 'university' || empty($row['ipeds_unitid'])) {
            return false;
        }
        $metadata = SrpInstitutionJson::decodeColumn(
            'pipeline_metadata_json',
            $row['pipeline_metadata_json'] ?? null
        );
        $reasons = $this->reviewReasons($metadata);
        $reasons[] = 'missing_from_current_ipeds_release';
        $reasons = $this->boundedUniqueStrings($reasons, 100, 500);
        if (($metadata['review_reasons'] ?? []) === $reasons
            && (int)($row['pipeline_review_required'] ?? 0) === 1
        ) {
            return false;
        }
        $metadata['review_reasons'] = $reasons;
        $this->reporter->row('inactive-institutions.csv', [
            'community_id' => (string)$row['id'],
            'ipeds_unitid' => (string)$row['ipeds_unitid'],
            'name' => (string)$row['name'],
            'operating_status' => (string)($row['operating_status'] ?? ''),
            'reason' => 'missing_from_current_ipeds_release',
        ]);
        if ($dryRun) {
            return true;
        }
        $statement = $this->db->prepare(
            "UPDATE communities
             SET pipeline_review_required = 1,
                 pipeline_metadata_json = :metadata,
                 pipeline_version = :version
             WHERE id = :id AND community_type = 'university'"
        );
        $statement->execute([
            ':metadata' => SrpInstitutionJson::encodeColumn(
                'pipeline_metadata_json',
                $metadata
            ),
            ':version' => (string)($this->config['pipeline_version'] ?? '1.0.0'),
            ':id' => (string)$row['id'],
        ]);
        return $statement->rowCount() > 0;
    }

    /**
     * Persist a row-scoped apply failure without discarding successful rows in
     * the same source transaction. Fetch/batch failures remain run reports
     * because they cannot safely be attributed to one institution.
     */
    public function recordRowError(
        string $communityId,
        string $source,
        string $stage,
        string $message
    ): void {
        $select = $this->db->prepare(
            "SELECT pipeline_metadata_json
             FROM communities
             WHERE id = :id AND community_type = 'university'
             LIMIT 1"
        );
        $select->execute([':id' => $communityId]);
        $rawMetadata = $select->fetchColumn();
        if ($rawMetadata === false) {
            return;
        }
        $metadata = SrpInstitutionJson::decodeColumn(
            'pipeline_metadata_json',
            $rawMetadata
        );
        $reason = 'source_error:' . $this->truncate(
            preg_replace('/[^a-z0-9_-]+/i', '_', strtolower($source . ':' . $stage))
                ?? 'unknown',
            120
        );
        $metadata['review_reasons'] = $this->boundedUniqueStrings(
            array_merge($this->reviewReasons($metadata), [$reason]),
            100,
            500
        );
        $metadata['last_error_source'] = $this->truncate($source, 64);
        $metadata['last_error_stage'] = $this->truncate($stage, 64);

        $update = $this->db->prepare(
            "UPDATE communities
             SET pipeline_last_error = :message,
                 pipeline_last_error_at = UTC_TIMESTAMP(),
                 pipeline_review_required = 1,
                 pipeline_metadata_json = :metadata,
                 pipeline_version = :version
             WHERE id = :id AND community_type = 'university'"
        );
        $update->execute([
            ':message' => $this->truncate($message, 4_000),
            ':metadata' => SrpInstitutionJson::encodeColumn(
                'pipeline_metadata_json',
                $metadata
            ),
            ':version' => (string)($this->config['pipeline_version'] ?? '1.0.0'),
            ':id' => $communityId,
        ]);
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $sourceRecord
     * @param array<string, mixed> $match
     * @return array<string, mixed>
     */
    private function planUpdate(array $row, array $sourceRecord, array $match): array
    {
        $metadata = SrpInstitutionJson::metadataFromRow($row);
        $metadata['candidate_limit'] = (int)($this->config['candidate_limit'] ?? 5);
        $metadata['match_confidence'] = (float)($match['score'] ?? 0.0);
        $changes = [];
        $changedFields = [];
        $reviewReasons = $this->staleReasonsRemoved(
            $this->reviewReasons($metadata['pipeline_metadata_json']),
            $sourceRecord
        );
        $fieldResults = [];
        $source = (string)$sourceRecord['source'];

        foreach ($sourceRecord['fields'] as $field => $candidate) {
            if (!is_string($field) || !is_array($candidate)) {
                continue;
            }
            $sourceType = (string)($candidate['source_type'] ?? $source);
            // The existing display identity is intentionally stable. A trusted
            // official rename is stored in official_name and offered for review
            // rather than silently changing legacy exact-name consumers.
            if ($field === 'name') {
                $incomingName = SrpInstitutionFieldPolicy::normalize('name', $candidate['value'] ?? null);
                $currentName = (string)($row['name'] ?? '');
                if ($incomingName !== null
                    && SrpInstitutionNormalizer::name((string)$incomingName)
                        !== SrpInstitutionNormalizer::name($currentName)
                ) {
                    $candidate['value'] = $incomingName;
                    $candidate['selected'] = false;
                    $metadata['data_candidates_json'] = SrpInstitutionJson::addCandidate(
                        $metadata['data_candidates_json'],
                        'name',
                        $candidate,
                        (int)$metadata['candidate_limit']
                    );
                    $reviewReasons[] = 'official_name_differs_from_display_name';
                }
                continue;
            }
            if (!SrpInstitutionFieldPolicy::allowsSource($field, $sourceType)) {
                continue;
            }

            $currentValue = $row[$field] ?? null;
            if ($this->isLegacyPlaceholder($field, $currentValue)) {
                $currentValue = null;
            }
            $resolved = SrpInstitutionResolver::resolveField(
                $field,
                $currentValue,
                $candidate,
                $metadata
            );
            $fieldResults[$field] = $resolved;
            $metadata = array_merge($metadata, $resolved['metadata']);
            if (($resolved['changed'] ?? false) === true) {
                $changes[$field] = $resolved['value'];
                $changedFields[] = $field;
            }
            if (($resolved['review_required'] ?? false) === true) {
                $reason = trim((string)($resolved['review_reason'] ?? 'field_conflict'));
                $reviewReasons[] = $field . ':' . ($reason !== '' ? $reason : 'field_conflict');
                $this->reporter->row('conflicting-values.csv', [
                    'community_id' => (string)$row['id'],
                    'field' => $field,
                    'current_value' => $this->reportValue($row[$field] ?? null),
                    'candidate_value' => $this->reportValue($candidate['value'] ?? null),
                    'current_source' => (string)($metadata['data_sources_json'][$field]['source_type'] ?? ''),
                    'candidate_source' => $sourceType,
                    'reason' => $reason,
                ]);
                // A logo the pipeline may not redistribute is an operator
                // question, not just a value conflict, so it also gets its own
                // report rather than being buried among thousands of rows.
                if (str_contains($reason, 'license')
                    && str_starts_with($field, 'logo')
                ) {
                    $this->reporter->row('logo-license-issues.csv', [
                        'community_id' => (string)$row['id'],
                        'wikidata_id' => (string)($row['wikidata_id'] ?? ''),
                        'name' => (string)$row['name'],
                        'logo_candidate' => $this->reportValue($candidate['value'] ?? null),
                        'reason' => $reason,
                    ]);
                }
            }
        }

        foreach ((array)($match['reasons'] ?? []) as $reason) {
            $reviewReasons[] = 'match:' . trim((string)$reason);
        }
        if (($match['review'] ?? false) === true) {
            $reviewReasons[] = 'institution_match_requires_review';
        }

        $reviewReasons = $this->boundedUniqueStrings($reviewReasons, 100, 500);
        $pipelineMetadata = $metadata['pipeline_metadata_json'];
        $pipelineMetadata['match_method'] = (string)($match['method'] ?? 'unknown');
        $pipelineMetadata['match_score'] = $this->confidence($match['score'] ?? 0.0);
        $pipelineMetadata['review_reasons'] = $reviewReasons;
        $pipelineMetadata['last_source_record_ids'][$source] =
            (string)$sourceRecord['source_record_id'];
        if (isset($sourceRecord['source_version'])) {
            $pipelineMetadata['source_versions'][$source] = (string)$sourceRecord['source_version'];
        }
        $fingerprint = $this->recordFingerprint($sourceRecord);
        $previousFingerprint = (string)($pipelineMetadata['source_fingerprints'][$source] ?? '');
        $pipelineMetadata['source_fingerprints'][$source] = $fingerprint;
        $importKey = $this->sourceImportMetadataKey($source);
        if ($importKey !== null && $previousFingerprint !== $fingerprint) {
            $pipelineMetadata[$importKey] = $this->mysqlDate($sourceRecord['retrieved_at']);
        }
        $clearsPriorSourceError =
            (string)($pipelineMetadata['last_error_source'] ?? '') === $source;
        if ($clearsPriorSourceError) {
            unset(
                $pipelineMetadata['last_error_source'],
                $pipelineMetadata['last_error_stage']
            );
            $reviewReasons = array_values(array_filter(
                $reviewReasons,
                static fn(string $reason): bool =>
                    !str_starts_with($reason, 'source_error:' . strtolower($source))
            ));
            $pipelineMetadata['review_reasons'] = $reviewReasons;
        }
        $metadata['pipeline_metadata_json'] = $pipelineMetadata;

        foreach (self::JSON_COLUMNS as $column) {
            $newEncoded = SrpInstitutionJson::encodeColumn($column, $metadata[$column]);
            $oldEncoded = SrpInstitutionJson::encodeColumn(
                $column,
                SrpInstitutionJson::decodeColumn($column, $row[$column] ?? null)
            );
            if ($newEncoded !== $oldEncoded) {
                $changes[$column] = $newEncoded;
            }
        }

        $changes['pipeline_match_method'] = (string)($match['method'] ?? 'unknown');
        $changes['pipeline_match_confidence'] = $this->confidence($match['score'] ?? 0.0);
        $changes['pipeline_review_required'] = $reviewReasons !== [] ? 1 : 0;
        $changes['pipeline_data_confidence'] = $this->overallConfidence(
            $metadata['data_confidence_json']
        );
        $changes['pipeline_version'] = (string)($this->config['pipeline_version'] ?? '1.0.0');
        if ($clearsPriorSourceError) {
            $changes['pipeline_last_error'] = null;
            $changes['pipeline_last_error_at'] = null;
        }

        if ($previousFingerprint !== $fingerprint) {
            $now = $this->mysqlDate($sourceRecord['retrieved_at']);
            $changes['last_seen_at'] = $now;
            if ($source === 'ipeds') {
                $changes['last_directory_refresh_at'] = $now;
            } elseif (in_array($source, ['wikidata', 'wikimedia', 'official-site'], true)) {
                $changes['last_branding_refresh_at'] = $now;
            }
            if ($source === 'wikimedia') {
                $changes['last_logo_check_at'] = $now;
            }
        }

        $changes = $this->removeUnchangedValues($row, $changes);
        if ($changes === []) {
            return [
                'action' => 'noop',
                'community_id' => (string)$row['id'],
                'source_record' => $sourceRecord,
                'match' => $match,
                'changed_fields' => [],
            ];
        }

        return [
            'action' => 'update',
            'community_id' => (string)$row['id'],
            'source_record' => $sourceRecord,
            'match' => $match,
            'changes' => $changes,
            'changed_fields' => array_values(array_unique($changedFields)),
            'review_reasons' => $reviewReasons,
            'field_results' => $fieldResults,
        ];
    }

    /**
     * @param array<string, mixed> $sourceRecord
     * @param array<string, mixed> $match
     * @return array<string, mixed>
     */
    private function planInsert(array $sourceRecord, array $match): array
    {
        $metadata = [
            'data_sources_json' => [],
            'data_confidence_json' => [],
            'data_verified_json' => [],
            'data_candidates_json' => [],
            'pipeline_metadata_json' => [],
            'manual_overrides_json' => [],
            'candidate_limit' => (int)($this->config['candidate_limit'] ?? 5),
            'match_confidence' => 1.0,
        ];
        $values = [];
        $source = (string)$sourceRecord['source'];
        foreach ($sourceRecord['fields'] as $field => $candidate) {
            if (!is_string($field) || !is_array($candidate) || $field === 'name') {
                continue;
            }
            $sourceType = (string)($candidate['source_type'] ?? $source);
            if (!SrpInstitutionFieldPolicy::allowsSource($field, $sourceType)) {
                continue;
            }
            $resolved = SrpInstitutionResolver::resolveField($field, null, $candidate, $metadata);
            $metadata = array_merge($metadata, $resolved['metadata']);
            if (($resolved['selected'] ?? false) === true && ($resolved['value'] ?? null) !== null) {
                $values[$field] = $resolved['value'];
            }
        }

        $officialName = trim((string)(
            $values['official_name']
            ?? $sourceRecord['match']['name']
            ?? $sourceRecord['fields']['official_name']['value']
            ?? ''
        ));
        if ($officialName === '') {
            throw new InvalidArgumentException('A new institution requires an official name.');
        }
        $values['official_name'] = $officialName;
        $values['name'] = $this->availableDisplayName(
            $officialName,
            (string)($values['city'] ?? $sourceRecord['match']['city'] ?? ''),
            (string)($values['state'] ?? $sourceRecord['match']['state'] ?? ''),
            (string)($values['ipeds_unitid'] ?? $sourceRecord['match']['ipeds_unitid'] ?? '')
        );
        $now = $this->mysqlDate($sourceRecord['retrieved_at']);
        $values['first_seen_at'] = $now;
        $values['last_seen_at'] = $now;
        $values['pipeline_match_method'] = 'new_' . $source;
        $values['pipeline_match_confidence'] = 1.0;
        $values['pipeline_active'] = array_key_exists('pipeline_active', $values)
            ? $values['pipeline_active']
            : 1;

        $reviewReasons = [];
        foreach ((array)($match['reasons'] ?? []) as $reason) {
            $reviewReasons[] = 'match:' . trim((string)$reason);
        }
        if (($match['review'] ?? false) === true) {
            $reviewReasons[] = 'new_institution_requires_review';
        }
        $reviewReasons = $this->boundedUniqueStrings($reviewReasons, 100, 500);
        $metadata['pipeline_metadata_json'] = [
            'match_method' => 'new_' . $source,
            'match_score' => 1.0,
            'review_reasons' => $reviewReasons,
            'last_source_record_ids' => [
                $source => (string)$sourceRecord['source_record_id'],
            ],
            'source_fingerprints' => [
                $source => $this->recordFingerprint($sourceRecord),
            ],
        ];
        if (isset($sourceRecord['source_version'])) {
            $metadata['pipeline_metadata_json']['source_versions'][$source] =
                (string)$sourceRecord['source_version'];
        }
        $importKey = $this->sourceImportMetadataKey($source);
        if ($importKey !== null) {
            $metadata['pipeline_metadata_json'][$importKey] = $now;
        }
        foreach (self::JSON_COLUMNS as $column) {
            $values[$column] = SrpInstitutionJson::encodeColumn($column, $metadata[$column]);
        }
        $values['pipeline_review_required'] = $reviewReasons !== [] ? 1 : 0;
        $values['pipeline_data_confidence'] = $this->overallConfidence(
            $metadata['data_confidence_json']
        );
        $values['pipeline_version'] = (string)($this->config['pipeline_version'] ?? '1.0.0');
        if ($source === 'ipeds') {
            $values['last_directory_refresh_at'] = $now;
        } elseif (in_array($source, ['wikidata', 'wikimedia', 'official-site'], true)) {
            $values['last_branding_refresh_at'] = $now;
        }

        return [
            'action' => 'insert',
            'source_record' => $sourceRecord,
            'match' => $match,
            'values' => $values,
            'changed_fields' => array_keys($values),
            'review_reasons' => $reviewReasons,
        ];
    }

    /**
     * @param array<string, mixed> $plan
     * @return array<string, mixed>
     */
    private function applyInsert(array $plan): array
    {
        $id = generateUniqueId($this->db, 'communities');
        $values = $plan['values'];
        $values['id'] = $id;
        $values['community_type'] = 'university';
        $columns = array_keys($values);
        $this->assertWritableColumns($columns, true);
        $placeholders = array_map(
            static fn(string $column): string => ':' . $column,
            $columns
        );
        $sql = sprintf(
            'INSERT INTO communities (%s) VALUES (%s)',
            implode(', ', array_map(static fn(string $column): string => "`{$column}`", $columns)),
            implode(', ', $placeholders)
        );
        $parameters = [];
        foreach ($values as $column => $value) {
            $parameters[':' . $column] = $this->databaseValue($column, $value);
        }
        $statement = $this->db->prepare($sql);
        $statement->execute($parameters);

        $record = $plan['source_record'];
        $this->reporter->row('inserted-institutions.csv', [
            'community_id' => $id,
            'ipeds_unitid' => $values['ipeds_unitid'] ?? null,
            'official_name' => $values['official_name'] ?? null,
            'display_name' => $values['name'] ?? null,
            'city' => $values['city'] ?? null,
            'state' => $values['state'] ?? null,
            'match_method' => $values['pipeline_match_method'] ?? null,
            'match_confidence' => $values['pipeline_match_confidence'] ?? null,
        ]);
        $plan['community_id'] = $id;
        $plan['applied'] = true;
        return $plan;
    }

    /**
     * @param array<string, mixed> $plan
     * @return array<string, mixed>
     */
    private function applyUpdate(array $plan): array
    {
        $changes = $plan['changes'];
        $columns = array_keys($changes);
        $this->assertWritableColumns($columns, false);
        $assignments = array_map(
            static fn(string $column): string => "`{$column}` = :{$column}",
            $columns
        );
        $sql = sprintf(
            "UPDATE communities SET %s
             WHERE id = :community_id AND community_type = 'university'",
            implode(', ', $assignments)
        );
        $parameters = [':community_id' => (string)$plan['community_id']];
        foreach ($changes as $column => $value) {
            $parameters[':' . $column] = $this->databaseValue($column, $value);
        }
        $statement = $this->db->prepare($sql);
        $statement->execute($parameters);
        if ($statement->rowCount() > 0) {
            $record = $plan['source_record'];
            $this->reporter->row('updated-institutions.csv', [
                'community_id' => (string)$plan['community_id'],
                'ipeds_unitid' => $record['match']['ipeds_unitid'] ?? null,
                'name' => $record['match']['name'] ?? null,
                'changed_fields' => implode('|', (array)$plan['changed_fields']),
                'source' => (string)$record['source'],
            ]);
        }
        $plan['applied'] = $statement->rowCount() > 0;
        return $plan;
    }

    /**
     * @param array<string, mixed> $sourceRecord
     */
    private function validateSourceRecord(array $sourceRecord): void
    {
        foreach (['source', 'source_record_id', 'retrieved_at', 'match', 'fields'] as $required) {
            if (!array_key_exists($required, $sourceRecord)) {
                throw new InvalidArgumentException("Source record is missing {$required}.");
            }
        }
        if (!is_array($sourceRecord['match']) || !is_array($sourceRecord['fields'])) {
            throw new InvalidArgumentException('Source record match and fields must be arrays.');
        }
        if (trim((string)$sourceRecord['source']) === ''
            || trim((string)$sourceRecord['source_record_id']) === ''
        ) {
            throw new InvalidArgumentException('Source record identity cannot be empty.');
        }
        $this->mysqlDate($sourceRecord['retrieved_at']);
    }

    /**
     * @param array<string, mixed> $sourceRecord
     */
    private function safeToInsert(array $sourceRecord): bool
    {
        if ((string)$sourceRecord['source'] !== 'ipeds') {
            return false;
        }
        $match = $sourceRecord['match'];
        $unitId = SrpInstitutionNormalizer::unitId($match['ipeds_unitid'] ?? null);
        $name = trim((string)($match['name'] ?? ''));
        $state = SrpInstitutionNormalizer::state($match['state'] ?? null);
        return $unitId !== null && $name !== '' && $state !== null;
    }

    private function availableDisplayName(
        string $officialName,
        string $city,
        string $state,
        string $unitId
    ): string {
        $base = $this->truncate($officialName, 100);
        if ($this->displayNameAvailable($base)) {
            return $base;
        }
        $location = implode(', ', array_values(array_filter([
            trim($city),
            trim($state),
        ], static fn(string $part): bool => $part !== '')));
        $suffixes = [];
        if ($location !== '') {
            $suffixes[] = ' (' . $location . ')';
        }
        if ($unitId !== '') {
            $suffixes[] = ' (' . $unitId . ')';
        }
        foreach ($suffixes as $suffix) {
            $candidate = $this->truncateWithSuffix($officialName, $suffix, 100);
            if ($this->displayNameAvailable($candidate)) {
                return $candidate;
            }
        }
        throw new RuntimeException(
            "No unique display name is available for '{$officialName}'. Administrative review is required."
        );
    }

    private function displayNameAvailable(string $name): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM communities WHERE name = :name LIMIT 1');
        $statement->execute([':name' => $name]);
        return !$statement->fetchColumn();
    }

    /**
     * @param list<string> $columns
     */
    private function assertWritableColumns(array $columns, bool $insert): void
    {
        $allowed = array_fill_keys(array_merge(
            SrpInstitutionFieldPolicy::managedFields(),
            self::JSON_COLUMNS,
            self::PIPELINE_STATE_COLUMNS,
            ['official_name', 'name', 'first_seen_at']
        ), true);
        if ($insert) {
            $allowed['id'] = true;
            $allowed['community_type'] = true;
        }
        foreach ($columns as $column) {
            if (!isset($allowed[$column]) || !preg_match('/^[a-z][a-z0-9_]*$/', $column)) {
                throw new LogicException("Attempted unsafe institution column write: {$column}");
            }
        }
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $changes
     * @return array<string, mixed>
     */
    private function removeUnchangedValues(array $row, array $changes): array
    {
        foreach ($changes as $column => $value) {
            $current = $row[$column] ?? null;
            if (in_array($column, self::VALUE_JSON_COLUMNS, true)) {
                if (SrpInstitutionFieldPolicy::valuesEqual($column, $current, $value)) {
                    unset($changes[$column]);
                }
                continue;
            }
            if ($current === null && $value === null) {
                unset($changes[$column]);
                continue;
            }
            // A boolean must be compared as the 0/1 the column stores. Casting
            // it to a string turns false into '', which is indistinguishable
            // from a NULL current value and silently drops every false update
            // (no HBCU flag, no closed institution ever marked inactive).
            if (is_bool($current) || is_bool($value)) {
                $currentFlag = $current === null ? null : (int)(bool)$current;
                $valueFlag = $value === null ? null : (int)(bool)$value;
                if ($currentFlag === $valueFlag) {
                    unset($changes[$column]);
                }
                continue;
            }
            if (is_numeric($current) && is_numeric($value)) {
                if (abs((float)$current - (float)$value) < 0.000001) {
                    unset($changes[$column]);
                }
                continue;
            }
            if ((string)$current === (string)$value) {
                unset($changes[$column]);
            }
        }
        return $changes;
    }

    private function databaseValue(string $column, mixed $value): mixed
    {
        // PDO binds a PHP bool as '' for false, which MySQL rejects for the
        // TINYINT(1) pipeline flags. Send the integer the column expects.
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (!in_array($column, self::VALUE_JSON_COLUMNS, true)
            || $value === null
            || is_string($value)
        ) {
            return $value;
        }
        if (!is_array($value)) {
            throw new InvalidArgumentException(
                "Institution JSON value {$column} must be an array, string, or null."
            );
        }
        return json_encode(
            $value,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }

    private function isLegacyPlaceholder(string $field, mixed $value): bool
    {
        $normalized = strtoupper(trim((string)$value));
        if ($field === 'primary_color' && $normalized === '#0077B5') {
            return true;
        }
        if ($field === 'secondary_color' && $normalized === '#005F8D') {
            return true;
        }
        return false;
    }

    /**
     * Drop the review reasons this run is about to recompute.
     *
     * Reasons are seeded from the row so an administrator's outstanding items
     * survive, but a field conflict or match concern that no longer occurs must
     * not keep the row queued forever. Anything this run does not re-evaluate
     * (another source's fields, source errors, directory-disappearance notes)
     * is left untouched and is re-added below when it still applies.
     *
     * @param list<string> $reasons
     * @param array<string, mixed> $sourceRecord
     * @return list<string>
     */
    private function staleReasonsRemoved(array $reasons, array $sourceRecord): array
    {
        $recomputed = [];
        foreach (array_keys((array)($sourceRecord['fields'] ?? [])) as $field) {
            if (is_string($field)) {
                $recomputed[$field] = true;
            }
        }
        return array_values(array_filter(
            $reasons,
            static function (string $reason) use ($recomputed): bool {
                if ($reason === 'institution_match_requires_review'
                    || str_starts_with($reason, 'match:')
                ) {
                    return false;
                }
                $separator = strpos($reason, ':');
                if ($separator === false) {
                    return true;
                }
                return !isset($recomputed[substr($reason, 0, $separator)]);
            }
        ));
    }

    /**
     * @param array<string, mixed> $pipelineMetadata
     * @return list<string>
     */
    private function reviewReasons(array $pipelineMetadata): array
    {
        $reasons = $pipelineMetadata['review_reasons'] ?? [];
        return is_array($reasons) ? array_values(array_map('strval', $reasons)) : [];
    }

    /**
     * @param list<string> $values
     * @return list<string>
     */
    private function boundedUniqueStrings(array $values, int $limit, int $maximumLength): array
    {
        $result = [];
        foreach ($values as $value) {
            $value = trim($value);
            if ($value === '') {
                continue;
            }
            $value = $this->truncate($value, $maximumLength);
            if (!in_array($value, $result, true)) {
                $result[] = $value;
            }
            if (count($result) >= $limit) {
                break;
            }
        }
        return $result;
    }

    /**
     * @param array<string, mixed> $confidences
     */
    private function overallConfidence(array $confidences): ?float
    {
        $values = array_values(array_filter(
            $confidences,
            static fn(mixed $value): bool => is_numeric($value)
        ));
        if ($values === []) {
            return null;
        }
        $sum = array_sum(array_map('floatval', $values));
        return round($sum / count($values), 4);
    }

    private function confidence(mixed $value): float
    {
        return round(max(0.0, min(1.0, (float)$value)), 4);
    }

    /**
     * @param array<string, mixed> $sourceRecord
     */
    private function recordFingerprint(array $sourceRecord): string
    {
        $identity = [
            'source' => $sourceRecord['source'],
            'source_record_id' => $sourceRecord['source_record_id'],
            'match' => $sourceRecord['match'],
            'fields' => $sourceRecord['fields'],
            'source_version' => $sourceRecord['source_version'] ?? null,
        ];
        foreach ($identity['fields'] as &$candidate) {
            if (is_array($candidate)) {
                unset($candidate['retrieved_at']);
                ksort($candidate);
            }
        }
        unset($candidate);
        ksort($identity);
        return hash(
            'sha256',
            json_encode(
                $identity,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            )
        );
    }

    private function sourceImportMetadataKey(string $source): ?string
    {
        return match ($source) {
            'ipeds' => 'last_ipeds_import',
            'scorecard' => 'last_scorecard_import',
            'wikidata', 'wikimedia' => 'last_wikidata_import',
            'official-site' => 'last_official_site_crawl',
            default => null,
        };
    }

    private function mysqlDate(mixed $value): string
    {
        try {
            return (new DateTimeImmutable((string)$value))
                ->setTimezone(new DateTimeZone('UTC'))
                ->format('Y-m-d H:i:s');
        } catch (Throwable $error) {
            throw new InvalidArgumentException('Invalid source retrieval date.', 0, $error);
        }
    }

    private function truncate(string $value, int $maximum): string
    {
        return function_exists('mb_substr')
            ? mb_substr($value, 0, $maximum, 'UTF-8')
            : substr($value, 0, $maximum);
    }

    private function truncateWithSuffix(string $value, string $suffix, int $maximum): string
    {
        $suffixLength = function_exists('mb_strlen')
            ? mb_strlen($suffix, 'UTF-8')
            : strlen($suffix);
        return $this->truncate($value, max(1, $maximum - $suffixLength)) . $suffix;
    }

    private function reportValue(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return (string)json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        return (string)$value;
    }
}
