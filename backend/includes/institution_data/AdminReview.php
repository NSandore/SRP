<?php

declare(strict_types=1);

require_once __DIR__ . '/Resolver.php';
require_once __DIR__ . '/Json.php';
require_once __DIR__ . '/PublicProjection.php';

/**
 * Shared, transactional administrative workflow for institution row review.
 *
 * No review or audit table is introduced: all decisions remain on the
 * canonical communities row in the six bounded JSON documents.
 */
final class SrpInstitutionAdminReview
{
    private const JSON_COLUMNS = [
        'data_sources_json',
        'data_confidence_json',
        'data_verified_json',
        'data_candidates_json',
        'pipeline_metadata_json',
        'manual_overrides_json',
    ];

    private const MUTABLE_FIELDS = [
        'name',
        'location',
        'website',
        'phone',
        'tagline',
        'aliases',
        'logo_path',
        'banner_path',
        'primary_color',
        'secondary_color',
        'ipeds_unitid',
        'wikidata_id',
        'ope_id',
        'official_name',
        'former_names',
        'normalized_domain',
        'address',
        'city',
        'state',
        'zip',
        'county',
        'latitude',
        'longitude',
        'institution_sector',
        'institution_level',
        'institution_control',
        'accreditor',
        'degree_granting',
        'operating_status',
        'is_hbcu',
        'is_tribal_college',
        'source_reporting_year',
        'pipeline_active',
        'motto',
        'slogan',
        'nickname',
        'logo_url',
        'logo_thumbnail_url',
        'logo_type',
        'logo_mime_type',
        'logo_license_name',
        'logo_license_url',
        'logo_attribution',
        'logo_width',
        'logo_height',
    ];

    private const ROW_COLUMNS = [
        'id',
        'community_type',
        'name',
        'location',
        'website',
        'phone',
        'tagline',
        'aliases',
        'logo_path',
        'primary_color',
        'secondary_color',
        'banner_path',
        'ipeds_unitid',
        'wikidata_id',
        'ope_id',
        'official_name',
        'former_names',
        'normalized_domain',
        'address',
        'city',
        'state',
        'zip',
        'county',
        'latitude',
        'longitude',
        'institution_sector',
        'institution_level',
        'institution_control',
        'accreditor',
        'degree_granting',
        'operating_status',
        'is_hbcu',
        'is_tribal_college',
        'source_reporting_year',
        'motto',
        'slogan',
        'nickname',
        'logo_url',
        'logo_thumbnail_url',
        'logo_type',
        'logo_mime_type',
        'logo_license_name',
        'logo_license_url',
        'logo_attribution',
        'logo_width',
        'logo_height',
        'first_seen_at',
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
        'data_sources_json',
        'data_confidence_json',
        'data_verified_json',
        'data_candidates_json',
        'pipeline_metadata_json',
        'manual_overrides_json',
    ];

    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->assertSchemaReady();
    }

    /**
     * Never trust a role cached in the session for these endpoints.
     */
    public static function isFreshSuperAdmin(PDO $db, string $userId): bool
    {
        if ($userId === '') {
            return false;
        }
        $statement = $db->prepare(
            'SELECT role_id FROM users WHERE user_id = :user_id LIMIT 1'
        );
        $statement->execute([':user_id' => $userId]);
        $roleId = $statement->fetchColumn();
        $requiredRole = defined('ROLE_SUPER_ADMIN') ? (int)ROLE_SUPER_ADMIN : 5;
        return $roleId !== false && (int)$roleId === $requiredRole;
    }

    /**
     * @return array{reviews: list<array<string, mixed>>, pagination: array<string, int>}
     */
    public function list(array $filters = []): array
    {
        $status = strtolower(trim((string)($filters['status'] ?? 'needs_review')));
        if (!in_array($status, ['needs_review', 'failed', 'missing', 'refresh_requested', 'all'], true)) {
            throw new InvalidArgumentException('Unknown institution review status.');
        }
        $query = trim((string)($filters['q'] ?? ''));
        if (strlen($query) > 200) {
            throw new InvalidArgumentException('Search terms must be 200 characters or fewer.');
        }
        $page = max(1, (int)($filters['page'] ?? 1));
        $limit = min(100, max(1, (int)($filters['limit'] ?? 30)));
        $offset = ($page - 1) * $limit;

        $where = ["c.community_type = 'university'"];
        $params = [];
        if ($status === 'needs_review') {
            $where[] = "(
                c.pipeline_review_required = 1
                OR COALESCE(
                    JSON_LENGTH(JSON_EXTRACT(c.pipeline_metadata_json, '$.review_reasons')),
                    0
                ) > 0
            )";
        } elseif ($status === 'failed') {
            $where[] = "NULLIF(TRIM(c.pipeline_last_error), '') IS NOT NULL";
        } elseif ($status === 'missing') {
            $where[] = $this->missingSql();
        } elseif ($status === 'refresh_requested') {
            $where[] = "JSON_EXTRACT(c.pipeline_metadata_json, '$.refresh_requested_at') IS NOT NULL";
        }
        if ($query !== '') {
            $where[] = "(
                c.name LIKE :query
                OR c.official_name LIKE :query
                OR c.ipeds_unitid LIKE :query
                OR c.city LIKE :query
                OR c.state LIKE :query
                OR c.normalized_domain LIKE :query
                OR (
                    c.aliases IS NOT NULL
                    AND JSON_SEARCH(c.aliases, 'one', :alias_query) IS NOT NULL
                )
            )";
            $params[':query'] = '%' . $query . '%';
            $params[':alias_query'] = '%' . $query . '%';
        }
        $whereSql = implode(' AND ', $where);

        $countStatement = $this->db->prepare(
            "SELECT COUNT(*) FROM communities c WHERE {$whereSql}"
        );
        $countStatement->execute($params);
        $total = (int)$countStatement->fetchColumn();

        $select = $this->rowSelectList('c');
        $statement = $this->db->prepare(
            "SELECT {$select}
             FROM communities c
             WHERE {$whereSql}
             ORDER BY
                c.pipeline_review_required DESC,
                (c.pipeline_last_error IS NOT NULL) DESC,
                c.pipeline_last_error_at DESC,
                c.name ASC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return [
            'reviews' => array_map(fn (array $row): array => $this->present($row), $rows),
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => max(1, (int)ceil($total / $limit)),
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public function find(string $communityId): ?array
    {
        $statement = $this->db->prepare(
            'SELECT ' . $this->rowSelectList('c') . "
             FROM communities c
             WHERE c.id = :id AND c.community_type = 'university'
             LIMIT 1"
        );
        $statement->execute([':id' => $communityId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->present($row) : null;
    }

    /**
     * Execute one review decision atomically.
     *
     * @return array<string, mixed>
     */
    public function act(
        string $communityId,
        string $action,
        array $payload,
        string $actorId
    ): array {
        $communityId = trim($communityId);
        $action = strtolower(trim($action));
        if ($communityId === '' || $actorId === '') {
            throw new InvalidArgumentException('Institution and reviewer are required.');
        }
        if (!in_array(
            $action,
            [
                'approve_candidate',
                'reject_candidate',
                'set_manual_override',
                'clear_manual_override',
                'mark_verified',
                'request_refresh',
                'resolve_duplicate',
            ],
            true
        )) {
            throw new InvalidArgumentException('Unknown institution review action.');
        }

        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $row = $this->lockRow($communityId);
            if (!$row) {
                throw new OutOfBoundsException('Institution not found.');
            }
            $documents = SrpInstitutionJson::metadataFromRow($row);
            $scalarChanges = [];

            if (in_array($action, ['approve_candidate', 'reject_candidate'], true)) {
                $field = $this->fieldFromPayload(
                    $payload,
                    $action === 'approve_candidate'
                );
                $candidateIndex = filter_var(
                    $payload['candidate_index'] ?? null,
                    FILTER_VALIDATE_INT
                );
                $candidateList = $documents['data_candidates_json'][$field] ?? [];
                if (
                    $candidateIndex === false
                    || $candidateIndex === null
                    || !is_array($candidateList)
                    || !isset($candidateList[$candidateIndex])
                    || !is_array($candidateList[$candidateIndex])
                ) {
                    throw new InvalidArgumentException('Choose a valid stored candidate.');
                }

                if ($action === 'approve_candidate') {
                    $candidate = $candidateList[$candidateIndex];
                    $resolved = $this->resolveManualValue(
                        $field,
                        $row[$field] ?? null,
                        $candidate['value'] ?? null,
                        (string)($candidate['source_url'] ?? ''),
                        trim((string)($payload['notes'] ?? '')),
                        $actorId,
                        $documents
                    );
                    $documents = $resolved['documents'];
                    $scalarChanges[$field] = $resolved['value'];
                    $candidateList = $documents['data_candidates_json'][$field] ?? $candidateList;
                    foreach ($candidateList as $index => &$entry) {
                        if (!is_array($entry)) {
                            continue;
                        }
                        $sameValue = $this->valuesEqual(
                            $entry['value'] ?? null,
                            $candidate['value'] ?? null
                        );
                        $sameSource = (string)($entry['source_type'] ?? '')
                            === (string)($candidate['source_type'] ?? '');
                        $entry['selected'] = $sameValue && $sameSource;
                        if ($sameValue && $sameSource) {
                            $entry['status'] = 'approved';
                            $entry['reviewed_by'] = $actorId;
                            $entry['reviewed_at'] = gmdate(DATE_ATOM);
                        } elseif (!in_array(
                            strtolower((string)($entry['status'] ?? 'pending')),
                            ['approved', 'rejected', 'manual_rejected'],
                            true
                        )) {
                            $entry['status'] = 'superseded';
                        }
                    }
                    unset($entry);
                    $documents['data_candidates_json'][$field] = $candidateList;
                    $documents['pipeline_metadata_json']['review_reasons'] =
                        $this->removeFieldReasons(
                            $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                            $field
                        );
                } else {
                    $candidateList[$candidateIndex]['selected'] = false;
                    $candidateList[$candidateIndex]['status'] = 'rejected';
                    $candidateList[$candidateIndex]['reviewed_by'] = $actorId;
                    $candidateList[$candidateIndex]['reviewed_at'] = gmdate(DATE_ATOM);
                    $notes = trim((string)($payload['notes'] ?? ''));
                    if ($notes !== '') {
                        $candidateList[$candidateIndex]['reason'] = substr($notes, 0, 500);
                    }
                    $documents['data_candidates_json'][$field] = $candidateList;
                    if (!$this->hasPendingCandidates($candidateList)) {
                        $documents['pipeline_metadata_json']['review_reasons'] =
                            $this->removeFieldReasons(
                                $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                                $field
                            );
                    }
                }
            } elseif ($action === 'set_manual_override') {
                $field = $this->fieldFromPayload($payload, true);
                if (!array_key_exists('value', $payload)) {
                    throw new InvalidArgumentException('A manual value is required.');
                }
                $resolved = $this->resolveManualValue(
                    $field,
                    $row[$field] ?? null,
                    $payload['value'],
                    trim((string)($payload['source_url'] ?? '')),
                    trim((string)($payload['notes'] ?? '')),
                    $actorId,
                    $documents
                );
                $documents = $resolved['documents'];
                $scalarChanges[$field] = $resolved['value'];
                $documents['pipeline_metadata_json']['review_reasons'] =
                    $this->removeFieldReasons(
                        $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                        $field
                    );
            } elseif ($action === 'clear_manual_override') {
                $field = strtolower(trim((string)($payload['field'] ?? '')));
                $this->assertMutableField($field);
                unset($documents['manual_overrides_json'][$field]);
                unset($documents['data_verified_json'][$field]);
                if (
                    ($documents['data_sources_json'][$field]['source_type'] ?? '')
                    === 'manual_verified'
                ) {
                    unset($documents['data_sources_json'][$field]);
                    unset($documents['data_confidence_json'][$field]);
                }
                $documents['pipeline_metadata_json']['review_reasons'] =
                    $this->addReason(
                        $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                        "manual_override_cleared:{$field}"
                    );
            } elseif ($action === 'mark_verified') {
                $field = $this->fieldFromPayload($payload);
                $verified = filter_var(
                    $payload['verified'] ?? true,
                    FILTER_VALIDATE_BOOLEAN,
                    FILTER_NULL_ON_FAILURE
                );
                if ($verified === null) {
                    throw new InvalidArgumentException('Verified must be true or false.');
                }
                $documents['data_verified_json'][$field] = $verified
                    ? [
                        'verified' => true,
                        'verified_by' => $actorId,
                        'verified_at' => gmdate(DATE_ATOM),
                    ]
                    : ['verified' => false];
                if ($verified) {
                    $documents['pipeline_metadata_json']['review_reasons'] =
                        $this->removeFieldReasons(
                            $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                            $field
                        );
                }
            } elseif ($action === 'request_refresh') {
                // A normal web request may only queue intent in row metadata.
                $now = gmdate(DATE_ATOM);
                $documents['pipeline_metadata_json']['refresh_requested_at'] = $now;
                $documents['pipeline_metadata_json']['refresh_requested_by'] = $actorId;
                $documents['pipeline_metadata_json']['refresh_request'] = [
                    'requested_at' => $now,
                    'requested_by' => $actorId,
                    'branding_only' => (bool)($payload['branding_only'] ?? false),
                    'status' => 'pending',
                ];
            } elseif ($action === 'resolve_duplicate') {
                $resolution = strtolower(trim((string)($payload['duplicate_resolution'] ?? '')));
                if (!in_array($resolution, ['not_duplicate', 'defer', 'duplicate_of'], true)) {
                    throw new InvalidArgumentException('Choose a valid duplicate resolution.');
                }
                $targetId = null;
                if ($resolution === 'duplicate_of') {
                    $targetId = trim((string)($payload['value'] ?? ''));
                    if ($targetId === '' || $targetId === $communityId) {
                        throw new InvalidArgumentException('Choose a different canonical institution.');
                    }
                    $targetStatement = $this->db->prepare(
                        "SELECT 1 FROM communities
                         WHERE id = :id AND community_type = 'university'
                         LIMIT 1"
                    );
                    $targetStatement->execute([':id' => $targetId]);
                    if (!$targetStatement->fetchColumn()) {
                        throw new InvalidArgumentException('Canonical institution not found.');
                    }
                }
                $documents['pipeline_metadata_json']['duplicate_review'] = [
                    'resolution' => $resolution,
                    'canonical_community_id' => $targetId,
                    'reviewed_by' => $actorId,
                    'reviewed_at' => gmdate(DATE_ATOM),
                    'notes' => substr(trim((string)($payload['notes'] ?? '')), 0, 2_000),
                ];
                if ($resolution === 'defer') {
                    $documents['pipeline_metadata_json']['review_reasons'] =
                        $this->addReason(
                            $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                            'potential_duplicate:deferred'
                        );
                } else {
                    $documents['pipeline_metadata_json']['review_reasons'] =
                        $this->removeDuplicateReasons(
                            $documents['pipeline_metadata_json']['review_reasons'] ?? []
                        );
                }
            }

            $this->persist($communityId, $row, $documents, $scalarChanges);
            if ($ownsTransaction) {
                $this->db->commit();
            }
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }

        $review = $this->find($communityId);
        if (!$review) {
            throw new RuntimeException('Institution review disappeared after update.');
        }
        return $review;
    }

    /**
     * Record ordinary university settings edits so a later pipeline run cannot
     * silently replace administrator-maintained values. Groups never call this.
     *
     * @param array<string, mixed> $values
     */
    public function recordManualEdits(
        string $communityId,
        array $values,
        string $actorId,
        string $notes = 'Updated through community settings.'
    ): void {
        if ($values === []) {
            return;
        }
        $row = $this->lockRow($communityId);
        if (!$row) {
            throw new OutOfBoundsException('Institution not found.');
        }
        $documents = SrpInstitutionJson::metadataFromRow($row);
        $now = gmdate(DATE_ATOM);
        foreach ($values as $field => $value) {
            $this->assertMutableField((string)$field);
            $documents['manual_overrides_json'][$field] = [
                'value' => $value,
                'source_url' => null,
                'notes' => substr($notes, 0, 4_000),
                'verified_by' => $actorId,
                'verified_at' => $now,
                'expires_at' => null,
            ];
            $documents['data_sources_json'][$field] = [
                'source_type' => 'manual_verified',
                'retrieved_at' => $now,
            ];
            $documents['data_confidence_json'][$field] = 1.0;
            $documents['data_verified_json'][$field] = [
                'verified' => true,
                'verified_by' => $actorId,
                'verified_at' => $now,
                'notes' => substr($notes, 0, 2_000),
            ];
            $documents['pipeline_metadata_json']['review_reasons'] =
                $this->removeFieldReasons(
                    $documents['pipeline_metadata_json']['review_reasons'] ?? [],
                    (string)$field
                );
        }
        $this->persist($communityId, $row, $documents, []);
    }

    /**
     * @param array<string, mixed> $documents
     * @return array{documents: array<string, mixed>, value: mixed}
     */
    private function resolveManualValue(
        string $field,
        mixed $currentValue,
        mixed $incomingValue,
        string $sourceUrl,
        string $notes,
        string $actorId,
        array $documents
    ): array {
        if ($sourceUrl !== '' && (
            filter_var($sourceUrl, FILTER_VALIDATE_URL) === false
            || !in_array(strtolower((string)parse_url($sourceUrl, PHP_URL_SCHEME)), ['http', 'https'], true)
        )) {
            throw new InvalidArgumentException('Source URL must be a valid HTTP or HTTPS URL.');
        }
        $normalizedIncoming = SrpInstitutionFieldPolicy::normalize($field, $incomingValue);
        if ($normalizedIncoming === null) {
            throw new InvalidArgumentException(
                'The proposed value is not valid for ' . str_replace('_', ' ', $field) . '.'
            );
        }
        $now = gmdate(DATE_ATOM);
        $candidate = [
            'value' => $incomingValue,
            'source_type' => 'manual_verified',
            'confidence' => 1.0,
            'match_confidence' => 1.0,
            'retrieved_at' => $now,
            'verified' => true,
            'verified_by' => $actorId,
        ];
        if ($sourceUrl !== '') {
            $candidate['source_url'] = $sourceUrl;
        }
        if ($notes !== '') {
            $candidate['notes'] = substr($notes, 0, 2_000);
        }

        // The resolver treats a stored override as authoritative, so make it
        // visible in row metadata before asking it to select/normalize.
        $documents['manual_overrides_json'][$field] = [
            'value' => $normalizedIncoming,
            'source_url' => $sourceUrl !== '' ? $sourceUrl : null,
            'notes' => substr($notes, 0, 4_000),
            'verified_by' => $actorId,
            'verified_at' => $now,
            'expires_at' => null,
        ];
        $documents['data_verified_json'][$field] = [
            'verified' => true,
            'verified_by' => $actorId,
            'verified_at' => $now,
            'notes' => $notes !== '' ? substr($notes, 0, 2_000) : null,
        ];

        $resolution = SrpInstitutionResolver::resolveField(
            $field,
            $currentValue,
            $candidate,
            $documents
        );
        $selectedValue = $resolution['value'] ?? $incomingValue;
        $resolvedMetadata = $resolution['metadata'] ?? [];

        foreach (self::JSON_COLUMNS as $column) {
            if (isset($resolvedMetadata[$column]) && is_array($resolvedMetadata[$column])) {
                $documents[$column] = $resolvedMetadata[$column];
            }
        }
        if (isset($resolution['source']) && is_array($resolution['source'])) {
            $documents['data_sources_json'][$field] = $resolution['source'];
        } else {
            $documents['data_sources_json'][$field] = [
                'source_type' => 'manual_verified',
                'source_url' => $sourceUrl !== '' ? $sourceUrl : null,
                'retrieved_at' => $now,
            ];
        }
        $documents['data_confidence_json'][$field] =
            isset($resolution['confidence']) ? (float)$resolution['confidence'] : 1.0;
        if (isset($resolution['candidates']) && is_array($resolution['candidates'])) {
            $documents['data_candidates_json'][$field] = $resolution['candidates'];
        }
        $documents['manual_overrides_json'][$field] = [
            'value' => $selectedValue,
            'source_url' => $sourceUrl !== '' ? $sourceUrl : null,
            'notes' => substr($notes, 0, 4_000),
            'verified_by' => $actorId,
            'verified_at' => $now,
            'expires_at' => null,
        ];
        $documents['data_verified_json'][$field] = [
            'verified' => true,
            'verified_by' => $actorId,
            'verified_at' => $now,
            'notes' => $notes !== '' ? substr($notes, 0, 2_000) : null,
        ];

        return ['documents' => $documents, 'value' => $selectedValue];
    }

    /** @return array<string, mixed>|null */
    private function lockRow(string $communityId): ?array
    {
        $statement = $this->db->prepare(
            'SELECT ' . $this->rowSelectList('c') . "
             FROM communities c
             WHERE c.id = :id AND c.community_type = 'university'
             LIMIT 1
             FOR UPDATE"
        );
        $statement->execute([':id' => $communityId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $documents
     * @param array<string, mixed> $scalarChanges
     */
    private function persist(
        string $communityId,
        array $row,
        array $documents,
        array $scalarChanges
    ): void {
        $set = [];
        $params = [':id' => $communityId];
        foreach ($scalarChanges as $field => $value) {
            $this->assertMutableField((string)$field);
            $set[] = "`{$field}` = :scalar_{$field}";
            if (is_array($value) || is_object($value)) {
                $value = json_encode(
                    $value,
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                );
            }
            $params[":scalar_{$field}"] = $value;
        }
        foreach (self::JSON_COLUMNS as $column) {
            $set[] = "`{$column}` = :{$column}";
            $params[":{$column}"] = SrpInstitutionJson::encodeColumn(
                $column,
                $documents[$column] ?? []
            );
        }
        $reviewReasons = $documents['pipeline_metadata_json']['review_reasons'] ?? [];
        $hasReview = $this->hasPendingCandidatesDocument(
            $documents['data_candidates_json'] ?? []
        ) || (is_array($reviewReasons) && $reviewReasons !== [])
            || trim((string)($row['pipeline_last_error'] ?? '')) !== '';
        $set[] = 'pipeline_review_required = :review_required';
        $params[':review_required'] = $hasReview ? 1 : 0;

        $statement = $this->db->prepare(
            'UPDATE communities SET ' . implode(', ', $set) . ' WHERE id = :id'
        );
        $statement->execute($params);
    }

    /** @return array<string, mixed> */
    private function present(array $row): array
    {
        $documents = SrpInstitutionJson::metadataFromRow($row);
        foreach (self::JSON_COLUMNS as $column) {
            unset($row[$column]);
        }
        $row['pipeline_active'] = $row['pipeline_active'] === null
            ? null
            : (bool)$row['pipeline_active'];
        $row['pipeline_review_required'] = (bool)$row['pipeline_review_required'];
        $row['is_active'] = $row['pipeline_active'] !== false;
        $row['selected_logo_url'] = $this->selectedLogo($row);
        $row['data_sources'] = $documents['data_sources_json'];
        $row['data_confidence'] = $documents['data_confidence_json'];
        $row['data_verified'] = $documents['data_verified_json'];
        $row['data_candidates'] = $documents['data_candidates_json'];
        $row['pipeline_metadata'] = $documents['pipeline_metadata_json'];
        $row['manual_overrides'] = $documents['manual_overrides_json'];
        $row['review_reasons'] = array_values(array_filter(
            $documents['pipeline_metadata_json']['review_reasons'] ?? [],
            'is_string'
        ));
        $row['missing_fields'] = $this->missingFields($row);
        return $row;
    }

    /** @return list<string> */
    private function missingFields(array $row): array
    {
        $required = [
            'official_name' => $row['official_name'] ?: $row['name'],
            'website' => $row['website'],
            'city' => $row['city'],
            'state' => $row['state'],
            'primary_color' => $row['primary_color'],
            'logo' => $row['selected_logo_url'] ?? $this->selectedLogo($row),
        ];
        $missing = [];
        foreach ($required as $field => $value) {
            if ($value === null || trim((string)$value) === '') {
                $missing[] = $field;
            }
        }
        return $missing;
    }

    private function selectedLogo(array $row): ?string
    {
        $local = trim((string)($row['logo_path'] ?? ''));
        if (
            $local !== ''
            && strtolower(basename(str_replace('\\', '/', $local))) !== 'default-logo.png'
        ) {
            return $local;
        }
        foreach (['logo_thumbnail_url', 'logo_url'] as $field) {
            $value = trim((string)($row[$field] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }
        return null;
    }

    private function missingSql(): string
    {
        return "(
            NULLIF(TRIM(COALESCE(c.official_name, c.name)), '') IS NULL
            OR NULLIF(TRIM(c.website), '') IS NULL
            OR NULLIF(TRIM(c.city), '') IS NULL
            OR NULLIF(TRIM(c.state), '') IS NULL
            OR NULLIF(TRIM(c.primary_color), '') IS NULL
            OR (
                (
                    NULLIF(TRIM(c.logo_path), '') IS NULL
                    OR LOWER(SUBSTRING_INDEX(TRIM(c.logo_path), '/', -1)) = 'default-logo.png'
                )
                AND NULLIF(TRIM(c.logo_thumbnail_url), '') IS NULL
                AND NULLIF(TRIM(c.logo_url), '') IS NULL
            )
        )";
    }

    private function fieldFromPayload(array $payload, bool $requireManualOverride = false): string
    {
        $field = strtolower(trim((string)($payload['field'] ?? '')));
        $this->assertMutableField($field);
        $policy = SrpInstitutionFieldPolicy::forField($field);
        if ($policy === null) {
            throw new InvalidArgumentException('That field is platform-managed and has no source resolver.');
        }
        if ($requireManualOverride && !($policy['manual_override'] ?? false)) {
            throw new InvalidArgumentException('That field does not support a manual override.');
        }
        return $field;
    }

    private function assertMutableField(string $field): void
    {
        if (!in_array($field, self::MUTABLE_FIELDS, true)) {
            throw new InvalidArgumentException('That institution field cannot be changed here.');
        }
    }

    private function assertSchemaReady(): void
    {
        foreach (self::JSON_COLUMNS as $column) {
            if (!SrpInstitutionPublicProjection::hasColumn($this->db, $column)) {
                throw new RuntimeException(
                    'Institution pipeline migration must be applied before using review tools.'
                );
            }
        }
    }

    private function rowSelectList(string $alias): string
    {
        return implode(
            ', ',
            array_map(
                static fn (string $column): string => "{$alias}.`{$column}` AS `{$column}`",
                self::ROW_COLUMNS
            )
        );
    }

    /** @param list<mixed> $reasons @return list<string> */
    private function removeFieldReasons(array $reasons, string $field): array
    {
        $needle = strtolower(str_replace('_', ' ', $field));
        return array_values(array_filter(
            $reasons,
            static function (mixed $reason) use ($field, $needle): bool {
                if (!is_string($reason)) {
                    return false;
                }
                $normalized = strtolower(str_replace(['_', '-'], ' ', $reason));
                return !str_contains($normalized, $needle)
                    && !str_contains(strtolower($reason), strtolower($field));
            }
        ));
    }

    /** @param list<mixed> $reasons @return list<string> */
    private function removeDuplicateReasons(array $reasons): array
    {
        return array_values(array_filter(
            $reasons,
            static fn (mixed $reason): bool =>
                is_string($reason) && !str_contains(strtolower($reason), 'duplicate')
        ));
    }

    /** @param list<mixed> $reasons @return list<string> */
    private function addReason(array $reasons, string $reason): array
    {
        $reasons = array_values(array_filter($reasons, 'is_string'));
        if (!in_array($reason, $reasons, true)) {
            $reasons[] = $reason;
        }
        return array_slice($reasons, -100);
    }

    private function hasPendingCandidates(array $candidates): bool
    {
        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }
            $status = strtolower((string)($candidate['status'] ?? 'pending'));
            if (!in_array(
                $status,
                ['approved', 'rejected', 'manual_rejected', 'selected', 'superseded'],
                true
            )) {
                return true;
            }
        }
        return false;
    }

    private function hasPendingCandidatesDocument(array $document): bool
    {
        foreach ($document as $candidates) {
            if (is_array($candidates) && $this->hasPendingCandidates($candidates)) {
                return true;
            }
        }
        return false;
    }

    private function valuesEqual(mixed $left, mixed $right): bool
    {
        return json_encode($left, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            === json_encode($right, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
