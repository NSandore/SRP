<?php

declare(strict_types=1);

final class SrpInstitutionSchema
{
    /** @var list<string> */
    private const REQUIRED_PIPELINE_COLUMNS = [
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

    /** @var list<string> */
    private const EXISTING_COLUMNS = [
        'id',
        'community_type',
        'parent_community_id',
        'name',
        'location',
        'website',
        'phone',
        'tagline',
        'aliases',
        'created_at',
        'updated_at',
        'logo_path',
        'primary_color',
        'secondary_color',
        'banner_path',
    ];

    /** @return list<string> */
    public static function requiredPipelineColumns(): array
    {
        return self::REQUIRED_PIPELINE_COLUMNS;
    }

    /** @return list<string> */
    public static function existingColumns(): array
    {
        return self::EXISTING_COLUMNS;
    }

    /**
     * @return array{
     *   ready: bool,
     *   missing_columns: list<string>,
     *   missing_existing_columns: list<string>,
     *   indexes: array<string, array<string, mixed>>,
     *   duplicate_unitids: list<array<string, mixed>>,
     *   counts: array<string, int>
     * }
     */
    public static function inspect(PDO $db): array
    {
        $columns = [];
        foreach ($db->query('SHOW FULL COLUMNS FROM `communities`')->fetchAll(PDO::FETCH_ASSOC) as $column) {
            $columns[(string)$column['Field']] = $column;
        }

        $indexes = [];
        foreach ($db->query('SHOW INDEXES FROM `communities`')->fetchAll(PDO::FETCH_ASSOC) as $index) {
            $name = (string)$index['Key_name'];
            if (!isset($indexes[$name])) {
                $indexes[$name] = [
                    'unique' => (int)$index['Non_unique'] === 0,
                    'columns' => [],
                ];
            }
            $indexes[$name]['columns'][] = (string)$index['Column_name'];
        }

        $missing = array_values(array_diff(self::REQUIRED_PIPELINE_COLUMNS, array_keys($columns)));
        $missingExisting = array_values(array_diff(self::EXISTING_COLUMNS, array_keys($columns)));
        $duplicates = [];
        if (isset($columns['ipeds_unitid'])) {
            $duplicates = $db->query(
                "SELECT ipeds_unitid, COUNT(*) AS row_count,
                        GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS community_ids
                 FROM communities
                 WHERE community_type = 'university' AND ipeds_unitid IS NOT NULL
                 GROUP BY ipeds_unitid
                 HAVING COUNT(*) > 1
                 ORDER BY row_count DESC, ipeds_unitid"
            )->fetchAll(PDO::FETCH_ASSOC);
        }

        $counts = [
            'communities' => (int)$db->query('SELECT COUNT(*) FROM communities')->fetchColumn(),
            'universities' => (int)$db->query(
                "SELECT COUNT(*) FROM communities WHERE community_type = 'university'"
            )->fetchColumn(),
            'groups' => (int)$db->query(
                "SELECT COUNT(*) FROM communities WHERE community_type = 'group'"
            )->fetchColumn(),
            'with_unitid' => 0,
            'active' => 0,
            'review_required' => 0,
            'pipeline_errors' => 0,
        ];
        // Before the additive migration, every existing university remains
        // selectable; the public projection applies the same compatibility
        // default while pipeline_active does not yet exist.
        $counts['active'] = $counts['universities'];
        if (isset($columns['ipeds_unitid'])) {
            $counts['with_unitid'] = (int)$db->query(
                "SELECT COUNT(*) FROM communities
                 WHERE community_type = 'university' AND ipeds_unitid IS NOT NULL"
            )->fetchColumn();
        }
        if (isset($columns['pipeline_active'])) {
            $counts['active'] = (int)$db->query(
                "SELECT COUNT(*) FROM communities
                 WHERE community_type = 'university' AND COALESCE(pipeline_active, 1) = 1"
            )->fetchColumn();
        }
        if (isset($columns['pipeline_review_required'])) {
            $counts['review_required'] = (int)$db->query(
                "SELECT COUNT(*) FROM communities
                 WHERE community_type = 'university' AND pipeline_review_required = 1"
            )->fetchColumn();
        }
        if (isset($columns['pipeline_last_error'])) {
            $counts['pipeline_errors'] = (int)$db->query(
                "SELECT COUNT(*) FROM communities
                 WHERE community_type = 'university' AND pipeline_last_error IS NOT NULL"
            )->fetchColumn();
        }

        return [
            'ready' => $missing === [] && $missingExisting === [] && $duplicates === [],
            'missing_columns' => $missing,
            'missing_existing_columns' => $missingExisting,
            'indexes' => $indexes,
            'duplicate_unitids' => $duplicates,
            'counts' => $counts,
        ];
    }

    public static function assertReady(PDO $db): void
    {
        $inspection = self::inspect($db);
        if ($inspection['missing_existing_columns']) {
            throw new RuntimeException(
                'The communities table is missing preexisting columns: '
                . implode(', ', $inspection['missing_existing_columns'])
            );
        }
        if ($inspection['missing_columns']) {
            throw new RuntimeException(
                'Institution pipeline migration has not been applied. Missing: '
                . implode(', ', $inspection['missing_columns'])
            );
        }
        if ($inspection['duplicate_unitids']) {
            throw new RuntimeException(
                'Duplicate IPEDS UNITIDs exist. Run institution-data validate and resolve them before refresh.'
            );
        }
    }

    /**
     * Application-level JSON validation for native JSON values and expected
     * top-level object shapes.
     *
     * @return list<array{community_id: string, column: string, error: string}>
     */
    public static function validateJsonRows(PDO $db, int $limit = 500): array
    {
        $jsonColumns = [
            'data_sources_json',
            'data_confidence_json',
            'data_verified_json',
            'data_candidates_json',
            'pipeline_metadata_json',
            'manual_overrides_json',
        ];
        $errors = [];
        $offset = 0;
        do {
            $sql = sprintf(
                'SELECT id, %s FROM communities
                 WHERE community_type = \'university\'
                 ORDER BY id LIMIT %d OFFSET %d',
                implode(', ', $jsonColumns),
                max(1, $limit),
                $offset
            );
            $rows = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                foreach ($jsonColumns as $column) {
                    if ($row[$column] === null || $row[$column] === '') {
                        continue;
                    }
                    $decoded = json_decode((string)$row[$column], true);
                    if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                        $errors[] = [
                            'community_id' => (string)$row['id'],
                            'column' => $column,
                            'error' => json_last_error_msg(),
                        ];
                    }
                }
            }
            $offset += count($rows);
        } while (count($rows) === max(1, $limit));

        return $errors;
    }
}
