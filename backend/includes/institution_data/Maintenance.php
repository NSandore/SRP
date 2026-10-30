<?php

declare(strict_types=1);

require_once __DIR__ . '/Json.php';
require_once __DIR__ . '/Schema.php';

/**
 * Non-source maintenance operations for the institution-data command.
 *
 * Run history remains file-backed. These operations only inspect or update the
 * canonical communities row; they never create a history/review table and
 * never merge or delete institutions.
 */
final class SrpInstitutionMaintenance
{
    /** @var list<string> */
    private const TERMINAL_CANDIDATE_STATUSES = [
        'approved',
        'rejected',
        'manual_rejected',
        'selected',
        'superseded',
    ];

    private PDO $db;
    /** @var array<string, mixed> */
    private array $config;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(PDO $db, array $config)
    {
        $this->db = $db;
        $this->config = $config;
    }

    /**
     * @return array<string, mixed>
     */
    public function validate(): array
    {
        $inspection = SrpInstitutionSchema::inspect($this->db);
        $jsonErrors = [];
        if ($inspection['missing_columns'] === []
            && $inspection['missing_existing_columns'] === []
        ) {
            $jsonErrors = SrpInstitutionSchema::validateJsonRows($this->db);
        }

        $requiredIndexes = [
            'PRIMARY',
            'uq_communities_name',
            'idx_parent_community_id',
            'uq_communities_ipeds_unitid',
        ];
        $missingIndexes = array_values(array_diff(
            $requiredIndexes,
            array_keys($inspection['indexes'])
        ));

        return [
            'valid' => $inspection['ready']
                && $jsonErrors === []
                && $missingIndexes === [],
            'schema' => $inspection,
            'missing_required_indexes' => $missingIndexes,
            'json_errors' => $jsonErrors,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function status(): array
    {
        $inspection = SrpInstitutionSchema::inspect($this->db);
        $status = [
            'schema_ready' => $inspection['ready'],
            'pipeline_version' => (string)($this->config['pipeline_version'] ?? 'unknown'),
            'counts' => $inspection['counts'],
            'missing_columns' => $inspection['missing_columns'],
            'duplicate_unitids' => $inspection['duplicate_unitids'],
            'pending_refresh_requests' => 0,
            'latest_run' => $this->latestRunSummary(),
        ];

        if ($inspection['ready']) {
            $status['pending_refresh_requests'] = (int)$this->db->query(
                "SELECT COUNT(*)
                 FROM communities
                 WHERE community_type = 'university'
                   AND JSON_UNQUOTE(
                       JSON_EXTRACT(pipeline_metadata_json, '$.refresh_request.status')
                   ) = 'pending'"
            )->fetchColumn();
            $status['missing_branding'] = (int)$this->db->query(
                "SELECT COUNT(*)
                 FROM communities
                 WHERE community_type = 'university'
                   AND (
                       NULLIF(TRIM(primary_color), '') IS NULL
                       OR (
                           (
                               NULLIF(TRIM(logo_path), '') IS NULL
                               OR LOWER(SUBSTRING_INDEX(TRIM(logo_path), '/', -1))
                                  = 'default-logo.png'
                           )
                           AND NULLIF(TRIM(logo_thumbnail_url), '') IS NULL
                           AND NULLIF(TRIM(logo_url), '') IS NULL
                       )
                   )"
            )->fetchColumn();
        }

        return $status;
    }

    /**
     * Recalculate bounded review state after candidate/admin decisions.
     *
     * Automated source selection already happens during refresh. This command
     * deliberately does not guess duplicate merges or approve candidates.
     *
     * @param array<string, mixed> $options
     * @return array<string, int|bool>
     */
    public function resolve(array $options = []): array
    {
        SrpInstitutionSchema::assertReady($this->db);
        $unitId = isset($options['unitid']) && $options['unitid'] !== null
            ? (string)$options['unitid']
            : null;
        $limit = min(100_000, max(1, (int)($options['limit'] ?? 10_000)));
        $dryRun = (bool)($options['dry_run'] ?? false);

        $where = ["community_type = 'university'"];
        $parameters = [];
        if ($unitId !== null) {
            $where[] = 'ipeds_unitid = :unitid';
            $parameters[':unitid'] = $unitId;
        } else {
            $where[] = "(
                pipeline_review_required = 1
                OR pipeline_last_error IS NOT NULL
                OR COALESCE(
                    JSON_LENGTH(JSON_EXTRACT(pipeline_metadata_json, '$.review_reasons')),
                    0
                ) > 0
                OR COALESCE(JSON_LENGTH(data_candidates_json), 0) > 0
            )";
        }

        $statement = $this->db->prepare(
            'SELECT id, pipeline_review_required, pipeline_last_error,
                    data_candidates_json, pipeline_metadata_json
             FROM communities
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY id
             LIMIT :limit'
        );
        foreach ($parameters as $key => $value) {
            $statement->bindValue($key, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        $scanned = 0;
        $changed = 0;
        $stillRequiresReview = 0;
        $plans = [];
        while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
            $scanned++;
            $metadata = SrpInstitutionJson::decodeColumn(
                'pipeline_metadata_json',
                $row['pipeline_metadata_json'] ?? null
            );
            $candidates = SrpInstitutionJson::decodeColumn(
                'data_candidates_json',
                $row['data_candidates_json'] ?? null
            );
            $reasons = $this->boundedReasons($metadata['review_reasons'] ?? []);
            $metadata['review_reasons'] = $reasons;
            $requiresReview = $reasons !== []
                || trim((string)($row['pipeline_last_error'] ?? '')) !== ''
                || $this->hasPendingCandidate($candidates);
            if ($requiresReview) {
                $stillRequiresReview++;
            }

            $encodedMetadata = SrpInstitutionJson::encodeColumn(
                'pipeline_metadata_json',
                $metadata
            );
            $oldMetadata = SrpInstitutionJson::encodeColumn(
                'pipeline_metadata_json',
                SrpInstitutionJson::decodeColumn(
                    'pipeline_metadata_json',
                    $row['pipeline_metadata_json'] ?? null
                )
            );
            if ((int)$row['pipeline_review_required'] !== ($requiresReview ? 1 : 0)
                || $encodedMetadata !== $oldMetadata
            ) {
                $plans[] = [
                    'id' => (string)$row['id'],
                    'review' => $requiresReview ? 1 : 0,
                    'metadata' => $encodedMetadata,
                ];
                $changed++;
            }
        }

        if (!$dryRun && $plans !== []) {
            $this->db->beginTransaction();
            try {
                $update = $this->db->prepare(
                    "UPDATE communities
                     SET pipeline_review_required = :review,
                         pipeline_metadata_json = :metadata,
                         pipeline_version = :version
                     WHERE id = :id AND community_type = 'university'"
                );
                foreach ($plans as $plan) {
                    $update->execute([
                        ':review' => $plan['review'],
                        ':metadata' => $plan['metadata'],
                        ':version' => (string)($this->config['pipeline_version'] ?? '1.0.0'),
                        ':id' => $plan['id'],
                    ]);
                }
                $this->db->commit();
            } catch (Throwable $error) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $error;
            }
        }

        return [
            'dry_run' => $dryRun,
            'scanned' => $scanned,
            'changed' => $changed,
            'still_requires_review' => $stillRequiresReview,
        ];
    }

    /**
     * @return array{unitids: list<string>, rows_without_unitid: int}
     */
    public function retryTargets(int $limit = 500): array
    {
        SrpInstitutionSchema::assertReady($this->db);
        $limit = min(5_000, max(1, $limit));
        $statement = $this->db->prepare(
            "SELECT ipeds_unitid
             FROM communities
             WHERE community_type = 'university'
               AND (
                   pipeline_last_error IS NOT NULL
                   OR JSON_UNQUOTE(
                       JSON_EXTRACT(pipeline_metadata_json, '$.refresh_request.status')
                   ) = 'pending'
               )
             ORDER BY COALESCE(pipeline_last_error_at, updated_at), id
             LIMIT :limit"
        );
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();
        $unitIds = [];
        $withoutUnitId = 0;
        while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
            $unitId = trim((string)($row['ipeds_unitid'] ?? ''));
            if ($unitId === '') {
                $withoutUnitId++;
                continue;
            }
            $unitIds[$unitId] = true;
        }
        return [
            'unitids' => array_keys($unitIds),
            'rows_without_unitid' => $withoutUnitId,
        ];
    }

    /**
     * Mark web-requested refresh intents complete only after an entirely
     * successful retry run.
     *
     * @param list<string> $unitIds
     */
    public function completeRefreshRequests(array $unitIds, string $reportPath): int
    {
        if ($unitIds === []) {
            return 0;
        }
        $unitIds = array_values(array_unique(array_filter(
            array_map('strval', $unitIds),
            static fn(string $value): bool => preg_match('/^\d{4,12}$/', $value) === 1
        )));
        if ($unitIds === []) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($unitIds), '?'));
        $select = $this->db->prepare(
            "SELECT id, pipeline_metadata_json
             FROM communities
             WHERE community_type = 'university'
               AND ipeds_unitid IN ({$placeholders})
             FOR UPDATE"
        );

        $this->db->beginTransaction();
        try {
            $select->execute($unitIds);
            $update = $this->db->prepare(
                "UPDATE communities
                 SET pipeline_metadata_json = :metadata,
                     pipeline_last_error = NULL,
                     pipeline_last_error_at = NULL
                 WHERE id = :id AND community_type = 'university'"
            );
            $count = 0;
            while ($row = $select->fetch(PDO::FETCH_ASSOC)) {
                $metadata = SrpInstitutionJson::decodeColumn(
                    'pipeline_metadata_json',
                    $row['pipeline_metadata_json'] ?? null
                );
                if (!isset($metadata['refresh_request'])
                    && !isset($metadata['refresh_requested_at'])
                ) {
                    continue;
                }
                $metadata['refresh_request'] = array_merge(
                    is_array($metadata['refresh_request'] ?? null)
                        ? $metadata['refresh_request']
                        : [],
                    [
                        'status' => 'complete',
                        'completed_at' => gmdate(DATE_ATOM),
                        'report_path' => $reportPath,
                    ]
                );
                unset($metadata['refresh_requested_at'], $metadata['refresh_requested_by']);
                $update->execute([
                    ':metadata' => SrpInstitutionJson::encodeColumn(
                        'pipeline_metadata_json',
                        $metadata
                    ),
                    ':id' => (string)$row['id'],
                ]);
                $count += $update->rowCount();
            }
            $this->db->commit();
            return $count;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestRunSummary(): ?array
    {
        $root = rtrim((string)($this->config['report_path'] ?? ''), DIRECTORY_SEPARATOR);
        if ($root === '' || !is_dir($root)) {
            return null;
        }
        $paths = glob($root . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR
            . 'pipeline-run-summary.json') ?: [];
        usort(
            $paths,
            static fn(string $left, string $right): int =>
                ((int)filemtime($right)) <=> ((int)filemtime($left))
        );
        foreach ($paths as $path) {
            $size = filesize($path);
            if ($size === false || $size < 2 || $size > 2_000_000) {
                continue;
            }
            try {
                $decoded = json_decode(
                    (string)file_get_contents($path),
                    true,
                    64,
                    JSON_THROW_ON_ERROR
                );
            } catch (Throwable $ignored) {
                continue;
            }
            if (is_array($decoded)) {
                $decoded['summary_path'] = $path;
                return $decoded;
            }
        }
        return null;
    }

    /**
     * @param mixed $raw
     * @return list<string>
     */
    private function boundedReasons(mixed $raw): array
    {
        if (!is_array($raw)) {
            return [];
        }
        $reasons = [];
        foreach ($raw as $reason) {
            if (!is_string($reason)) {
                continue;
            }
            $reason = trim($reason);
            if ($reason !== '' && !in_array($reason, $reasons, true)) {
                $reasons[] = mb_substr($reason, 0, 500);
            }
            if (count($reasons) >= 100) {
                break;
            }
        }
        return $reasons;
    }

    /**
     * @param array<string, mixed> $document
     */
    private function hasPendingCandidate(array $document): bool
    {
        foreach ($document as $candidateList) {
            if (!is_array($candidateList)) {
                continue;
            }
            foreach ($candidateList as $candidate) {
                if (!is_array($candidate)) {
                    continue;
                }
                $status = strtolower(trim((string)($candidate['status'] ?? 'pending')));
                if (!in_array($status, self::TERMINAL_CANDIDATE_STATUSES, true)) {
                    return true;
                }
            }
        }
        return false;
    }
}
