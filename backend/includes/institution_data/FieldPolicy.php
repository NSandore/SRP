<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Normalizer.php';
require_once __DIR__ . '/Color.php';

/**
 * Central allowlist for every source-controlled scalar column.
 */
final class SrpInstitutionFieldPolicy
{
    /**
     * @var array<string, array{
     *   sources: list<string>,
     *   manual_override: bool,
     *   protect_untracked: bool,
     *   strategy: string,
     *   conflict_delta: float
     * }>
     */
    private const POLICIES = [
        'name' => [
            // Automated sources may suggest display-name candidates, but only
            // an administrator can select this legacy unique display identity.
            'sources' => ['manual_verified'],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'ipeds_unitid' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'wikidata_id' => [
            'sources' => ['manual_verified', 'wikidata_referenced', 'wikidata_unreferenced'],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'ope_id' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'official_name' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced', 'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'aliases' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'merge_list', 'conflict_delta' => 0.05,
        ],
        'former_names' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'merge_list', 'conflict_delta' => 0.05,
        ],
        'website' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced', 'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'normalized_domain' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced', 'wikidata_unreferenced',
                'inferred',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'phone' => [
            'sources' => ['manual_verified', 'official_institution_page', 'ipeds'],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'location' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'address' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'city' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'state' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard', 'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'zip' => [
            'sources' => [
                'manual_verified', 'official_institution_page', 'ipeds',
                'college_scorecard',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'county' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'latitude' => [
            'sources' => [
                'manual_verified', 'ipeds', 'college_scorecard',
                'wikidata_referenced', 'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.03,
        ],
        'longitude' => [
            'sources' => [
                'manual_verified', 'ipeds', 'college_scorecard',
                'wikidata_referenced', 'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.03,
        ],
        'institution_sector' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'institution_level' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'institution_control' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'accreditor' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'degree_granting' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'operating_status' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'is_hbcu' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'is_tribal_college' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'source_reporting_year' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => false, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.00,
        ],
        'pipeline_active' => [
            'sources' => ['manual_verified', 'ipeds', 'college_scorecard'],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'primary_color' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'official_site_css',
                'official_site_svg', 'wikidata_referenced',
                'official_logo_extraction', 'wikidata_unreferenced',
                'third_party_dataset', 'inferred',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'secondary_color' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'official_site_css',
                'official_site_svg', 'wikidata_referenced',
                'official_logo_extraction', 'wikidata_unreferenced',
                'third_party_dataset', 'inferred',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'motto' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'wikidata_referenced',
                'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'slogan' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'wikidata_referenced',
                'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'tagline' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'wikidata_referenced',
                'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => true,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'nickname' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikidata_referenced', 'wikidata_unreferenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_url' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'wikimedia_commons',
                'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_thumbnail_url' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons', 'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_type' => [
            'sources' => [
                'manual_verified', 'official_brand_guide',
                'official_institution_page', 'wikimedia_commons',
                'wikidata_referenced',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_mime_type' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_license_name' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_license_url' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_attribution' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => true, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_width' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => false, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
        'logo_height' => [
            'sources' => [
                'manual_verified', 'official_institution_page',
                'wikimedia_commons',
            ],
            'manual_override' => false, 'protect_untracked' => false,
            'strategy' => 'replace', 'conflict_delta' => 0.05,
        ],
    ];

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        return self::POLICIES;
    }

    /**
     * @return list<string>
     */
    public static function managedFields(): array
    {
        return array_keys(self::POLICIES);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function forField(string $field): ?array
    {
        return self::POLICIES[$field] ?? null;
    }

    public static function isManaged(string $field): bool
    {
        return isset(self::POLICIES[$field]);
    }

    public static function allowsSource(string $field, string $sourceType): bool
    {
        $policy = self::forField($field);
        if ($policy === null) {
            return false;
        }
        return in_array(
            self::canonicalSourceType($sourceType),
            $policy['sources'],
            true
        );
    }

    public static function sourcePriority(string $sourceType): float
    {
        return SrpInstitutionConfig::sourcePriority(
            self::canonicalSourceType($sourceType)
        );
    }

    public static function canonicalSourceType(string $sourceType): string
    {
        $sourceType = strtolower(trim($sourceType));
        return match ($sourceType) {
            'scorecard' => 'college_scorecard',
            'wikidata' => 'wikidata_unreferenced',
            'wikimedia', 'commons' => 'wikimedia_commons',
            'official_css' => 'official_site_css',
            'official_svg' => 'official_site_svg',
            'logo_extraction' => 'official_logo_extraction',
            'manual', 'admin' => 'manual_verified',
            default => $sourceType,
        };
    }

    public static function normalize(string $field, mixed $value): mixed
    {
        if (!self::isManaged($field)) {
            return null;
        }
        if (in_array($field, ['primary_color', 'secondary_color'], true)) {
            return SrpInstitutionColor::normalize($value);
        }
        if ($field === 'logo_type') {
            $type = SrpInstitutionNormalizer::field($field, $value);
            $type = match ($type) {
                'logo', 'institution_logo', 'institutional' => 'institutional_logo',
                'crest' => 'seal',
                'athletic', 'sports', 'athletics' => 'athletics_logo',
                default => $type,
            };
            return in_array(
                $type,
                [
                    'institutional_logo', 'seal', 'wordmark',
                    'combination_mark', 'athletics_logo', 'other',
                ],
                true
            ) ? $type : null;
        }
        return SrpInstitutionNormalizer::field($field, $value);
    }

    public static function valuesEqual(string $field, mixed $left, mixed $right): bool
    {
        $left = self::normalize($field, $left);
        $right = self::normalize($field, $right);
        if (is_array($left) || is_array($right)) {
            if (!is_array($left) || !is_array($right)) {
                return false;
            }
            return self::canonicalArray($left) === self::canonicalArray($right);
        }
        if (is_bool($left) || is_bool($right)) {
            return $left === $right;
        }
        if (
            in_array($field, ['latitude', 'longitude'], true)
            && is_numeric($left)
            && is_numeric($right)
        ) {
            return abs((float)$left - (float)$right) < 0.0000001;
        }
        // Formatting is not disagreement. Without this, every row whose stored
        // phone or address merely punctuates differently than the federal
        // directory is reported as a source conflict and queued for review.
        if ($field === 'phone') {
            $leftPhone = self::comparablePhone($left);
            $rightPhone = self::comparablePhone($right);
            if ($leftPhone !== null && $rightPhone !== null) {
                return $leftPhone === $rightPhone;
            }
        }
        if (
            in_array($field, ['location', 'address'], true)
            && is_string($left)
            && is_string($right)
        ) {
            $leftPlace = self::comparablePlace($left);
            $rightPlace = self::comparablePlace($right);
            if ($leftPlace === $rightPlace) {
                return true;
            }
            // Equal only when the sole difference is that one side carries the
            // ZIP+4 and the other the bare ZIP. Two different +4 extensions
            // remain a real difference.
            return self::zipReduced($leftPlace) === $rightPlace
                || self::zipReduced($rightPlace) === $leftPlace;
        }
        return $left === $right;
    }

    /**
     * Digits only, without a US country code, so that "(256) 372-5000",
     * "256-372-5000", and "+1 2563725000" all compare as one number.
     */
    private static function comparablePhone(mixed $value): ?string
    {
        if (!is_string($value) && !is_int($value)) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', (string)$value) ?? '';
        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            $digits = substr($digits, 1);
        }
        return $digits === '' ? null : $digits;
    }

    /**
     * Case- and punctuation-insensitive address form. A real change of street,
     * city, or postal code still compares as different.
     *
     */
    private static function comparablePlace(string $value): string
    {
        $collapsed = preg_replace('/[^a-z0-9]+/', ' ', strtolower($value)) ?? '';
        return trim(preg_replace('/\s+/', ' ', $collapsed) ?? '');
    }

    /**
     * Drop a trailing ZIP+4 extension. The federal directory routinely carries
     * the extended form where a stored display string does not, and that added
     * precision is not a disagreement about the address. The precise value is
     * kept in its own `zip` column regardless.
     */
    private static function zipReduced(string $place): string
    {
        return preg_replace('/\b(\d{5}) \d{4}$/', '$1', $place) ?? $place;
    }

    /**
     * @return list<string>|null
     */
    public static function mergeLists(mixed $current, mixed $incoming): ?array
    {
        $current = SrpInstitutionNormalizer::field('aliases', $current) ?? [];
        $incoming = SrpInstitutionNormalizer::field('aliases', $incoming) ?? [];
        $merged = [];
        $seen = [];
        foreach (array_merge($current, $incoming) as $name) {
            $identity = SrpInstitutionNormalizer::name($name);
            if ($identity === '' || isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;
            $merged[] = $name;
        }
        return $merged === [] ? null : $merged;
    }

    /**
     * @param list<mixed> $value
     */
    private static function canonicalArray(array $value): string
    {
        $copy = $value;
        sort($copy, SORT_STRING);
        return json_encode($copy, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }
}

/**
 * @return list<string>
 */
function srp_institution_managed_fields(): array
{
    return SrpInstitutionFieldPolicy::managedFields();
}

function srp_institution_source_allowed(string $field, string $sourceType): bool
{
    return SrpInstitutionFieldPolicy::allowsSource($field, $sourceType);
}
