<?php

declare(strict_types=1);

/**
 * Builds the only public projection of a community/institution row.
 *
 * The projection is intentionally allowlisted: pipeline provenance, review
 * notes, candidates, errors, reviewer identities, and external identifiers
 * must never be exposed by public community APIs.
 */
final class SrpInstitutionPublicProjection
{
    /** @var list<string> */
    private const EXISTING_PUBLIC_COLUMNS = [
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

    /** @var list<string> */
    private const PIPELINE_PUBLIC_COLUMNS = [
        'official_name',
        'former_names',
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

    /** @var array<string, array<string, bool>> */
    private static array $columnsByConnection = [];

    /**
     * Return an explicit SQL SELECT list.
     *
     * Optional pipeline columns are emitted as NULL during a rolling deploy
     * before the additive migration has run, keeping the public shape stable.
     *
     * @param array<string, string> $aliases Source column => result name.
     * @param list<string> $exclude
     */
    public static function selectList(
        PDO $db,
        string $tableAlias = 'c',
        array $aliases = [],
        array $exclude = []
    ): string {
        self::assertIdentifier($tableAlias);
        $excluded = array_fill_keys($exclude, true);
        $available = self::columns($db);
        $parts = [];

        foreach (array_merge(self::EXISTING_PUBLIC_COLUMNS, self::PIPELINE_PUBLIC_COLUMNS) as $column) {
            if (isset($excluded[$column])) {
                continue;
            }
            $resultName = $aliases[$column] ?? $column;
            self::assertIdentifier($resultName);
            if (isset($available[$column])) {
                $parts[] = sprintf(
                    '%s.`%s` AS `%s`',
                    $tableAlias,
                    $column,
                    $resultName
                );
            } else {
                $parts[] = sprintf('NULL AS `%s`', $resultName);
            }
        }

        $parts[] = self::selectedLogoExpression($available, $tableAlias)
            . ' AS `selected_logo_url`';
        $parts[] = self::institutionTypeExpression($available, $tableAlias)
            . ' AS `institution_type`';
        $parts[] = self::activeExpression($available, $tableAlias)
            . ' AS `is_active`';

        return implode(",\n            ", $parts);
    }

    /**
     * Filter used only by discovery/new-selection queries.
     *
     * Detail-by-ID endpoints deliberately do not use this predicate so an
     * inactive institution remains visible to existing related records.
     */
    public static function activeUniversityPredicate(PDO $db, string $tableAlias = 'c'): string
    {
        self::assertIdentifier($tableAlias);
        if (!self::hasColumn($db, 'pipeline_active')) {
            return '1 = 1';
        }

        return sprintf(
            "(%1\$s.`community_type` <> 'university' OR COALESCE(%1\$s.`pipeline_active`, 1) = 1)",
            $tableAlias
        );
    }

    public static function hasColumn(PDO $db, string $column): bool
    {
        return isset(self::columns($db)[$column]);
    }

    /** @return array<string, bool> */
    private static function columns(PDO $db): array
    {
        $connectionKey = (string)spl_object_id($db);
        if (isset(self::$columnsByConnection[$connectionKey])) {
            return self::$columnsByConnection[$connectionKey];
        }

        $columns = [];
        try {
            $statement = $db->query('SHOW COLUMNS FROM `communities`');
            foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                $name = (string)($row['Field'] ?? '');
                if ($name !== '') {
                    $columns[$name] = true;
                }
            }
        } catch (Throwable $error) {
            // Preserve compatibility with test doubles and rolling deploys.
            foreach (self::EXISTING_PUBLIC_COLUMNS as $column) {
                $columns[$column] = true;
            }
        }

        return self::$columnsByConnection[$connectionKey] = $columns;
    }

    /** @param array<string, bool> $available */
    private static function selectedLogoExpression(array $available, string $alias): string
    {
        $expressions = [];
        foreach (['logo_path', 'logo_thumbnail_url', 'logo_url'] as $column) {
            if (isset($available[$column])) {
                if ($column === 'logo_path') {
                    $expressions[] = sprintf(
                        "CASE
                            WHEN NULLIF(TRIM(%1\$s.`logo_path`), '') IS NULL THEN NULL
                            WHEN LOWER(SUBSTRING_INDEX(TRIM(%1\$s.`logo_path`), '/', -1)) = 'default-logo.png' THEN NULL
                            ELSE %1\$s.`logo_path`
                        END",
                        $alias
                    );
                } else {
                    $expressions[] = sprintf("NULLIF(TRIM(%s.`%s`), '')", $alias, $column);
                }
            }
        }
        $expressions[] = 'NULL';
        return 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    /** @param array<string, bool> $available */
    private static function institutionTypeExpression(array $available, string $alias): string
    {
        $expressions = [];
        foreach (['institution_level', 'institution_sector', 'institution_control'] as $column) {
            if (isset($available[$column])) {
                $expressions[] = sprintf("NULLIF(%s.`%s`, '')", $alias, $column);
            }
        }
        $expressions[] = 'NULL';
        return 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    /** @param array<string, bool> $available */
    private static function activeExpression(array $available, string $alias): string
    {
        if (!isset($available['pipeline_active'])) {
            return '1';
        }
        return sprintf('COALESCE(%s.`pipeline_active`, 1)', $alias);
    }

    private static function assertIdentifier(string $identifier): void
    {
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $identifier)) {
            throw new InvalidArgumentException('Unsafe SQL identifier.');
        }
    }
}
