<?php

declare(strict_types=1);

/**
 * Shared record-envelope and defensive configuration helpers for sources.
 */
final class SrpInstitutionSourceSupport
{
    /**
     * Read either a flat/dotted array key or a conventional configuration
     * object without requiring the configuration implementation at load time.
     *
     * @param array<string, mixed>|object $config
     * @param list<string> $keys
     * @param mixed $default
     * @return mixed
     */
    public static function config($config, array $keys, $default = null)
    {
        foreach ($keys as $key) {
            if (is_array($config)) {
                if (array_key_exists($key, $config)) {
                    return $config[$key];
                }
                $cursor = $config;
                $found = true;
                foreach (explode('.', $key) as $segment) {
                    if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                        $found = false;
                        break;
                    }
                    $cursor = $cursor[$segment];
                }
                if ($found) {
                    return $cursor;
                }
                continue;
            }
            if (!is_object($config)) {
                continue;
            }
            if (method_exists($config, 'get')) {
                try {
                    $sentinel = new stdClass();
                    $value = $config->get($key, $sentinel);
                    if ($value !== $sentinel) {
                        return $value;
                    }
                } catch (Throwable $ignored) {
                    // Try public properties and no-argument accessors.
                }
            }
            if (isset($config->{$key}) || property_exists($config, $key)) {
                try {
                    return $config->{$key};
                } catch (Throwable $ignored) {
                    // Continue to a compatible key.
                }
            }
            $method = lcfirst(str_replace(' ', '', ucwords(str_replace(['.', '_', '-'], ' ', $key))));
            if (method_exists($config, $method)) {
                try {
                    return $config->{$method}();
                } catch (Throwable $ignored) {
                    // Continue to a compatible key.
                }
            }
        }
        return $default;
    }

    /**
     * @param mixed $value
     * @return mixed
     */
    public static function normalizeField(string $field, $value)
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'field')
        ) {
            try {
                return SrpInstitutionNormalizer::field($field, $value);
            } catch (Throwable $ignored) {
                // Fall back so source fixtures can load without foundation files.
            }
        }
        if ($value === null || is_resource($value) || is_object($value)) {
            return null;
        }
        if (is_string($value)) {
            $value = trim($value);
            return $value === '' || in_array(strtoupper($value), ['NULL', 'NA', 'N/A', '-2', '-3'], true)
                ? null
                : $value;
        }
        return $value;
    }

    /**
     * @param mixed $value
     */
    public static function unitId($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'unitId')
        ) {
            try {
                return SrpInstitutionNormalizer::unitId($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (is_bool($value) || is_array($value) || is_object($value)) {
            return null;
        }
        $value = trim((string)$value);
        if (preg_match('/^\d{1,8}$/', $value) !== 1) {
            return null;
        }
        return strlen($value) < 6 ? str_pad($value, 6, '0', STR_PAD_LEFT) : $value;
    }

    /**
     * @param mixed $value
     */
    public static function opeId($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'opeId')
        ) {
            try {
                return SrpInstitutionNormalizer::opeId($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (is_bool($value) || is_array($value) || is_object($value)) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', trim((string)$value)) ?? '';
        return $digits !== '' && strlen($digits) <= 8
            ? str_pad($digits, 8, '0', STR_PAD_LEFT)
            : null;
    }

    /**
     * @param mixed $value
     */
    public static function domain($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'domain')
        ) {
            try {
                return SrpInstitutionNormalizer::domain($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (!is_scalar($value)) {
            return null;
        }
        $raw = trim((string)$value);
        $target = str_contains($raw, '://') ? $raw : '//' . $raw;
        $host = parse_url($target, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return null;
        }
        $host = strtolower(rtrim($host, '.'));
        return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
    }

    /**
     * @param mixed $value
     */
    public static function url($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'url')
        ) {
            try {
                return SrpInstitutionNormalizer::url($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (!is_scalar($value)) {
            return null;
        }
        $url = trim((string)$value);
        if ($url === '') {
            return null;
        }
        if (!preg_match('#^https?://#i', $url)) {
            $url = 'https://' . ltrim($url, '/');
        }
        return filter_var($url, FILTER_VALIDATE_URL) !== false ? $url : null;
    }

    /**
     * @param mixed $value
     */
    public static function state($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'state')
        ) {
            try {
                return SrpInstitutionNormalizer::state($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        $state = strtoupper(trim((string)$value));
        return preg_match('/^[A-Z]{2}$/', $state) === 1 ? $state : null;
    }

    /**
     * @param mixed $value
     */
    public static function wikidataId($value): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'wikidataId')
        ) {
            try {
                return SrpInstitutionNormalizer::wikidataId($value);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (!is_scalar($value)) {
            return null;
        }
        return preg_match('/(?:^|\\/)(Q[1-9]\d*)$/i', trim((string)$value), $matches) === 1
            ? strtoupper($matches[1])
            : null;
    }

    /**
     * @param mixed $value
     */
    public static function text($value, int $maxBytes = 0): ?string
    {
        if (class_exists('SrpInstitutionNormalizer')
            && method_exists('SrpInstitutionNormalizer', 'text')
        ) {
            try {
                return SrpInstitutionNormalizer::text($value, $maxBytes);
            } catch (Throwable $ignored) {
                // Use the source-only fallback.
            }
        }
        if (!is_scalar($value)) {
            return null;
        }
        $text = trim((string)$value);
        if ($text === '' || in_array(strtoupper($text), ['NULL', 'NA', 'N/A', '-2', '-3'], true)) {
            return null;
        }
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return $maxBytes > 0 && strlen($text) > $maxBytes
            ? mb_strcut($text, 0, $maxBytes, 'UTF-8')
            : $text;
    }

    /**
     * @param mixed $value
     */
    public static function boolFromYesCode($value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }
        $raw = strtoupper(trim((string)$value));
        return match ($raw) {
            '1', 'Y', 'YES', 'TRUE', 'T' => true,
            '0', '2', 'N', 'NO', 'FALSE', 'F' => false,
            default => null,
        };
    }

    /**
     * @param mixed $value
     */
    public static function float($value, float $minimum, float $maximum): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }
        $number = (float)$value;
        return is_finite($number) && $number >= $minimum && $number <= $maximum
            ? $number
            : null;
    }

    /**
     * @param mixed $value
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>|null
     */
    public static function candidate(
        string $field,
        $value,
        string $sourceType,
        ?string $sourceUrl,
        string $sourceRecordId,
        string $retrievedAt,
        float $confidence,
        array $metadata = []
    ): ?array {
        $normalized = self::normalizeField($field, $value);
        if ($normalized === null || $normalized === '' || $normalized === []) {
            return null;
        }
        $candidate = [
            'value' => $normalized,
            'source_type' => $sourceType,
            'source_url' => $sourceUrl,
            'source_record_id' => $sourceRecordId,
            'retrieved_at' => $retrievedAt,
            'confidence' => max(0.0, min(1.0, round($confidence, 4))),
            'metadata' => $metadata,
        ];
        // The resolver deliberately reads these security-sensitive logo facts
        // at candidate top level before it will select a remote image. Keep
        // them in metadata too for source diagnostics, but promote the bounded
        // allowlist here so adapters cannot accidentally bypass/drop the gate.
        foreach ([
            'logo_type',
            'logo_license_name',
            'logo_license_url',
            'logo_attribution',
            'license',
            'allow_athletics_logo',
            'approximation',
            'conversion_source',
            'original_value',
        ] as $key) {
            if (array_key_exists($key, $metadata)) {
                $candidate[$key] = $metadata[$key];
            }
        }
        return $candidate;
    }

    /**
     * @param array<string, mixed> $match
     * @param array<string, array<string, mixed>> $fields
     * @param array<string, mixed> $rawMetadata
     * @return array<string, mixed>
     */
    public static function record(
        string $source,
        string $sourceRecordId,
        string $retrievedAt,
        array $match,
        array $fields,
        array $rawMetadata = []
    ): array {
        $match = array_merge([
            'ipeds_unitid' => null,
            'ope_id' => null,
            'normalized_domain' => null,
            'name' => null,
            'city' => null,
            'state' => null,
        ], $match);
        $match['ipeds_unitid'] = self::unitId($match['ipeds_unitid']);
        $match['ope_id'] = self::opeId($match['ope_id']);
        $match['normalized_domain'] = self::domain($match['normalized_domain']);
        $match['name'] = self::text($match['name'], 255);
        $match['city'] = self::text($match['city'], 100);
        $match['state'] = self::state($match['state']);

        foreach ($fields as $field => $candidate) {
            if (!is_array($candidate)
                || !array_key_exists('value', $candidate)
                || $candidate['value'] === null
                || $candidate['value'] === ''
                || $candidate['value'] === []
            ) {
                unset($fields[$field]);
            }
        }

        return [
            'source' => $source,
            'source_record_id' => $sourceRecordId,
            'retrieved_at' => $retrievedAt,
            'match' => $match,
            'fields' => $fields,
            // Deliberately metadata only: source adapters never retain raw rows.
            'raw_metadata' => $rawMetadata,
        ];
    }

    /**
     * @param array<string, mixed> $fields
     * @param mixed $value
     * @param array<string, mixed> $metadata
     */
    public static function addCandidate(
        array &$fields,
        string $field,
        $value,
        string $sourceType,
        ?string $sourceUrl,
        string $sourceRecordId,
        string $retrievedAt,
        float $confidence,
        array $metadata = []
    ): void {
        $candidate = self::candidate(
            $field,
            $value,
            $sourceType,
            $sourceUrl,
            $sourceRecordId,
            $retrievedAt,
            $confidence,
            $metadata
        );
        if ($candidate !== null) {
            $fields[$field] = $candidate;
        }
    }
}
