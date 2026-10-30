<?php

declare(strict_types=1);

/**
 * Environment-backed configuration for the institution data pipeline.
 *
 * Reading configuration has no filesystem side effects. Commands create the
 * configured private directories only when they actually need them.
 */
final class SrpInstitutionConfig
{
    public const PIPELINE_VERSION = '1.0.0';

    /** @var array<string, float> */
    private const SOURCE_PRIORITIES = [
        'manual_verified' => 1.00,
        'platform_approved' => 1.00,
        'official_brand_guide' => 1.00,
        'platform_existing' => 0.97,
        'official_institution_page' => 0.95,
        'ipeds' => 0.95,
        'college_scorecard' => 0.90,
        'official_site_css' => 0.85,
        'official_site_svg' => 0.85,
        'wikidata_referenced' => 0.80,
        'wikimedia_commons' => 0.80,
        'official_logo_extraction' => 0.70,
        'wikidata_unreferenced' => 0.65,
        'third_party_dataset' => 0.50,
        'inferred' => 0.40,
        'unknown' => 0.25,
    ];

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    public static function load(array $overrides = []): array
    {
        $backendPath = dirname(__DIR__, 2);
        $runtimePath = $backendPath . DIRECTORY_SEPARATOR . 'runtime'
            . DIRECTORY_SEPARATOR . 'institution_pipeline';

        $timeout = self::environmentInteger(
            'INSTITUTION_PIPELINE_REQUEST_TIMEOUT',
            30,
            1,
            120
        );
        $connectTimeout = self::environmentInteger(
            'INSTITUTION_PIPELINE_CONNECT_TIMEOUT',
            min(10, $timeout),
            1,
            60
        );
        $maxRetries = self::environmentInteger(
            'INSTITUTION_PIPELINE_MAX_RETRIES',
            3,
            0,
            10
        );
        $maxResponseBytes = self::environmentInteger(
            'INSTITUTION_PIPELINE_MAX_RESPONSE_BYTES',
            50_000_000,
            1_024,
            500_000_000
        );
        $candidateLimit = self::environmentInteger(
            'INSTITUTION_PIPELINE_CANDIDATE_LIMIT',
            5,
            1,
            20
        );
        $maxJsonBytes = self::environmentInteger(
            'INSTITUTION_PIPELINE_MAX_JSON_BYTES',
            262_144,
            4_096,
            4_194_304
        );
        $maxRequestsPerDomain = self::environmentInteger(
            'INSTITUTION_PIPELINE_MAX_REQUESTS_PER_DOMAIN',
            10,
            1,
            100
        );

        $contactEmail = self::environmentString(
            'INSTITUTION_PIPELINE_CONTACT_EMAIL',
            ''
        );
        if ($contactEmail !== '' && filter_var($contactEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException(
                'INSTITUTION_PIPELINE_CONTACT_EMAIL must contain a valid email address.'
            );
        }

        $userAgent = self::environmentString(
            'INSTITUTION_PIPELINE_USER_AGENT',
            'StudentSphere-InstitutionData/1.0 (+https://studentsphere.app)'
        );
        if (
            $userAgent === ''
            || strlen($userAgent) > 512
            || str_contains($userAgent, "\r")
            || str_contains($userAgent, "\n")
        ) {
            throw new InvalidArgumentException(
                'INSTITUTION_PIPELINE_USER_AGENT must be a non-empty single-line value.'
            );
        }

        $cachePath = self::environmentPath(
            'INSTITUTION_PIPELINE_CACHE_PATH',
            $runtimePath . DIRECTORY_SEPARATOR . 'cache',
            $backendPath
        );
        $rawDataPath = self::environmentPath(
            'INSTITUTION_PIPELINE_RAW_DATA_PATH',
            $runtimePath . DIRECTORY_SEPARATOR . 'raw',
            $backendPath
        );
        $reportPath = self::environmentPath(
            'INSTITUTION_PIPELINE_REPORT_PATH',
            $runtimePath . DIRECTORY_SEPARATOR . 'reports',
            $backendPath
        );

        $config = [
            'pipeline_version' => self::PIPELINE_VERSION,
            'data_gov_api_key' => self::environmentString('DATA_GOV_API_KEY', ''),
            'user_agent' => $userAgent,
            'contact_email' => $contactEmail,
            'cache_path' => $cachePath,
            'raw_data_path' => $rawDataPath,
            'report_path' => $reportPath,
            'runtime_path' => $runtimePath,
            'request_timeout' => $timeout,
            'connect_timeout' => min($connectTimeout, $timeout),
            'max_retries' => $maxRetries,
            'max_response_bytes' => $maxResponseBytes,
            'crawler_enabled' => self::environmentBoolean(
                'INSTITUTION_PIPELINE_CRAWLER_ENABLED',
                false
            ),
            'max_requests_per_domain' => $maxRequestsPerDomain,
            'candidate_limit' => $candidateLimit,
            'max_json_bytes' => $maxJsonBytes,
            'paths' => [
                'runtime' => $runtimePath,
                'cache' => $cachePath,
                'raw_data' => $rawDataPath,
                'reports' => $reportPath,
            ],
            'http' => [
                'timeout' => $timeout,
                'connect_timeout' => min($connectTimeout, $timeout),
                'max_retries' => $maxRetries,
                'max_response_bytes' => $maxResponseBytes,
                'user_agent' => $userAgent,
                'contact_email' => $contactEmail,
            ],
            'crawler' => [
                'enabled' => self::environmentBoolean(
                    'INSTITUTION_PIPELINE_CRAWLER_ENABLED',
                    false
                ),
                'max_requests_per_domain' => $maxRequestsPerDomain,
                'max_depth' => self::environmentInteger(
                    'INSTITUTION_PIPELINE_CRAWLER_MAX_DEPTH',
                    2,
                    0,
                    5
                ),
                'max_file_bytes' => self::environmentInteger(
                    'INSTITUTION_PIPELINE_CRAWLER_MAX_FILE_BYTES',
                    10_000_000,
                    1_024,
                    100_000_000
                ),
            ],
            'matching' => [
                'fuzzy_threshold' => 0.93,
                'fuzzy_margin' => 0.04,
                'review_threshold' => 0.80,
            ],
            'candidate_limit_per_field' => $candidateLimit,
            'source_priorities' => self::SOURCE_PRIORITIES,
        ];

        if ($overrides !== []) {
            $config = array_replace_recursive($config, $overrides);
        }

        return $config;
    }

    /**
     * @return array<string, float>
     */
    public static function sourcePriorities(): array
    {
        return self::SOURCE_PRIORITIES;
    }

    public static function sourcePriority(string $sourceType): float
    {
        $sourceType = strtolower(trim($sourceType));
        return self::SOURCE_PRIORITIES[$sourceType]
            ?? self::SOURCE_PRIORITIES['unknown'];
    }

    private static function environmentString(string $name, string $default): string
    {
        $value = getenv($name);
        return $value === false ? $default : trim((string)$value);
    }

    private static function environmentBoolean(string $name, bool $default): bool
    {
        $value = getenv($name);
        if ($value === false || trim((string)$value) === '') {
            return $default;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($parsed === null) {
            throw new InvalidArgumentException("{$name} must be true or false.");
        }
        return $parsed;
    }

    private static function environmentInteger(
        string $name,
        int $default,
        int $minimum,
        int $maximum
    ): int {
        $value = getenv($name);
        if ($value === false || trim((string)$value) === '') {
            return $default;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_INT);
        if ($parsed === false || $parsed < $minimum || $parsed > $maximum) {
            throw new InvalidArgumentException(
                "{$name} must be an integer between {$minimum} and {$maximum}."
            );
        }
        return $parsed;
    }

    private static function environmentPath(
        string $name,
        string $default,
        string $relativeBase
    ): string {
        $path = self::environmentString($name, $default);
        if ($path === '' || str_contains($path, "\0")) {
            throw new InvalidArgumentException("{$name} must contain a valid filesystem path.");
        }
        if (!self::isAbsolutePath($path)) {
            $path = $relativeBase . DIRECTORY_SEPARATOR . $path;
        }
        return rtrim($path, DIRECTORY_SEPARATOR);
    }

    private static function isAbsolutePath(string $path): bool
    {
        return str_starts_with($path, DIRECTORY_SEPARATOR)
            || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1;
    }
}

/**
 * @param array<string, mixed> $overrides
 * @return array<string, mixed>
 */
function srp_institution_config(array $overrides = []): array
{
    return SrpInstitutionConfig::load($overrides);
}

function srp_institution_source_priority(string $sourceType): float
{
    return SrpInstitutionConfig::sourcePriority($sourceType);
}
