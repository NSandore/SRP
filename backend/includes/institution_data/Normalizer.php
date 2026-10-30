<?php

declare(strict_types=1);

/**
 * Deterministic normalization used by source adapters, matching, and writes.
 */
final class SrpInstitutionNormalizer
{
    /** Keeps a malformed or unbounded source list from growing a row without limit. */
    private const MAXIMUM_NAME_LIST_ENTRIES = 50;

    /** @var array<string, string> */
    private const STATES = [
        'al' => 'AL', 'alabama' => 'AL',
        'ak' => 'AK', 'alaska' => 'AK',
        'az' => 'AZ', 'arizona' => 'AZ',
        'ar' => 'AR', 'arkansas' => 'AR',
        'ca' => 'CA', 'california' => 'CA',
        'co' => 'CO', 'colorado' => 'CO',
        'ct' => 'CT', 'connecticut' => 'CT',
        'de' => 'DE', 'delaware' => 'DE',
        'dc' => 'DC', 'district of columbia' => 'DC',
        'fl' => 'FL', 'florida' => 'FL',
        'ga' => 'GA', 'georgia' => 'GA',
        'hi' => 'HI', 'hawaii' => 'HI',
        'id' => 'ID', 'idaho' => 'ID',
        'il' => 'IL', 'illinois' => 'IL',
        'in' => 'IN', 'indiana' => 'IN',
        'ia' => 'IA', 'iowa' => 'IA',
        'ks' => 'KS', 'kansas' => 'KS',
        'ky' => 'KY', 'kentucky' => 'KY',
        'la' => 'LA', 'louisiana' => 'LA',
        'me' => 'ME', 'maine' => 'ME',
        'md' => 'MD', 'maryland' => 'MD',
        'ma' => 'MA', 'massachusetts' => 'MA',
        'mi' => 'MI', 'michigan' => 'MI',
        'mn' => 'MN', 'minnesota' => 'MN',
        'ms' => 'MS', 'mississippi' => 'MS',
        'mo' => 'MO', 'missouri' => 'MO',
        'mt' => 'MT', 'montana' => 'MT',
        'ne' => 'NE', 'nebraska' => 'NE',
        'nv' => 'NV', 'nevada' => 'NV',
        'nh' => 'NH', 'new hampshire' => 'NH',
        'nj' => 'NJ', 'new jersey' => 'NJ',
        'nm' => 'NM', 'new mexico' => 'NM',
        'ny' => 'NY', 'new york' => 'NY',
        'nc' => 'NC', 'north carolina' => 'NC',
        'nd' => 'ND', 'north dakota' => 'ND',
        'oh' => 'OH', 'ohio' => 'OH',
        'ok' => 'OK', 'oklahoma' => 'OK',
        'or' => 'OR', 'oregon' => 'OR',
        'pa' => 'PA', 'pennsylvania' => 'PA',
        'ri' => 'RI', 'rhode island' => 'RI',
        'sc' => 'SC', 'south carolina' => 'SC',
        'sd' => 'SD', 'south dakota' => 'SD',
        'tn' => 'TN', 'tennessee' => 'TN',
        'tx' => 'TX', 'texas' => 'TX',
        'ut' => 'UT', 'utah' => 'UT',
        'vt' => 'VT', 'vermont' => 'VT',
        'va' => 'VA', 'virginia' => 'VA',
        'wa' => 'WA', 'washington' => 'WA',
        'wv' => 'WV', 'west virginia' => 'WV',
        'wi' => 'WI', 'wisconsin' => 'WI',
        'wy' => 'WY', 'wyoming' => 'WY',
        'as' => 'AS', 'american samoa' => 'AS',
        'fm' => 'FM', 'federated states of micronesia' => 'FM',
        'gu' => 'GU', 'guam' => 'GU',
        'mh' => 'MH', 'marshall islands' => 'MH',
        'mp' => 'MP', 'northern mariana islands' => 'MP',
        'pw' => 'PW', 'palau' => 'PW',
        'pr' => 'PR', 'puerto rico' => 'PR',
        'vi' => 'VI', 'u s virgin islands' => 'VI', 'us virgin islands' => 'VI',
        'virgin islands' => 'VI',
    ];

    /** @var array<string, string> */
    private const NAME_TOKEN_EXPANSIONS = [
        'univ' => 'university',
        'univs' => 'universities',
        'coll' => 'college',
        'inst' => 'institute',
        'instituteof' => 'institute of',
        'tech' => 'technology',
        'technol' => 'technology',
        'polytech' => 'polytechnic',
        'sch' => 'school',
        'ctr' => 'center',
        'st' => 'saint',
        'mt' => 'mount',
    ];

    public static function text(mixed $value, int $maximumBytes = 0): ?string
    {
        if ($value === null || is_array($value) || is_object($value) || is_resource($value)) {
            return null;
        }
        $text = trim((string)$value);
        if ($text === '') {
            return null;
        }
        if (class_exists('Normalizer')) {
            $normalized = \Normalizer::normalize($text, \Normalizer::FORM_C);
            if (is_string($normalized)) {
                $text = $normalized;
            }
        }
        $text = strtr($text, [
            "\u{00A0}" => ' ',
            "\u{2007}" => ' ',
            "\u{202F}" => ' ',
            "\u{2018}" => "'",
            "\u{2019}" => "'",
            "\u{201C}" => '"',
            "\u{201D}" => '"',
            "\u{2013}" => '-',
            "\u{2014}" => '-',
        ]);
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        if ($maximumBytes > 0 && strlen($text) > $maximumBytes) {
            throw new LengthException("Institution value exceeds {$maximumBytes} bytes.");
        }
        return $text;
    }

    /**
     * A comparison key only. Never write this over a display or official name.
     */
    public static function name(mixed $value): string
    {
        $name = self::text($value);
        if ($name === null) {
            return '';
        }
        $name = self::asciiFold($name);
        $name = mb_strtolower($name, 'UTF-8');
        $name = preg_replace('/^\s*the\s+/u', '', $name) ?? $name;
        $name = str_replace('&', ' and ', $name);
        $name = preg_replace('/[\'"`’]/u', '', $name) ?? $name;
        $name = preg_replace('/[^a-z0-9]+/u', ' ', $name) ?? $name;
        $tokens = preg_split('/\s+/', trim($name)) ?: [];
        foreach ($tokens as &$token) {
            $token = self::NAME_TOKEN_EXPANSIONS[$token] ?? $token;
        }
        unset($token);
        $name = implode(' ', $tokens);
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
        return trim($name);
    }

    /**
     * @return list<string>
     */
    public static function nameTokens(mixed $value): array
    {
        $normalized = self::name($value);
        if ($normalized === '') {
            return [];
        }
        return array_values(array_unique(explode(' ', $normalized)));
    }

    public static function domain(mixed $value): ?string
    {
        $raw = self::text($value, 2_048);
        if ($raw === null) {
            return null;
        }
        $candidate = $raw;
        if (str_contains($candidate, '@') && !str_contains($candidate, '://')) {
            $candidate = substr($candidate, (int)strrpos($candidate, '@') + 1);
        }
        $parseTarget = str_contains($candidate, '://') ? $candidate : '//' . $candidate;
        $parts = parse_url($parseTarget);
        if (!is_array($parts) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }
        $host = $parts['host'] ?? null;
        if (!is_string($host) || $host === '') {
            return null;
        }
        $host = mb_strtolower(rtrim($host, '.'), 'UTF-8');
        while (str_starts_with($host, 'www.')) {
            $host = substr($host, 4);
        }
        if (function_exists('idn_to_ascii')) {
            $ascii = idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
            if (is_string($ascii) && $ascii !== '') {
                $host = strtolower($ascii);
            }
        }
        if (
            strlen($host) > 253
            || !str_contains($host, '.')
            || filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false
            || filter_var($host, FILTER_VALIDATE_IP) !== false
        ) {
            return null;
        }
        return $host;
    }

    public static function url(mixed $value): ?string
    {
        $raw = self::text($value, 2_048);
        if ($raw === null) {
            return null;
        }
        if (preg_match('/[\x00-\x20\x7F\\\\]/', $raw) === 1) {
            return null;
        }
        if (!preg_match('#^[a-z][a-z0-9+.-]*://#i', $raw)) {
            $raw = 'https://' . ltrim($raw, '/');
        }
        $parts = parse_url($raw);
        if (!is_array($parts)) {
            return null;
        }
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        if (
            !in_array($scheme, ['http', 'https'], true)
            || isset($parts['user'])
            || isset($parts['pass'])
        ) {
            return null;
        }
        $domain = self::domain($raw);
        if ($domain === null) {
            return null;
        }
        $port = isset($parts['port']) ? (int)$parts['port'] : null;
        if (
            $port !== null
            && $port !== 80
            && $port !== 443
            && ($port < 1 || $port > 65_535)
        ) {
            return null;
        }
        $authority = $domain;
        if (
            $port !== null
            && !(($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443))
        ) {
            $authority .= ':' . $port;
        }
        $path = (string)($parts['path'] ?? '');
        $path = preg_replace('#/{2,}#', '/', $path) ?? $path;
        if ($path === '/' || $path === '') {
            $path = '';
        } else {
            $path = '/' . ltrim(rtrim($path, '/'), '/');
        }
        $query = isset($parts['query']) && $parts['query'] !== ''
            ? '?' . $parts['query']
            : '';
        $url = "{$scheme}://{$authority}{$path}{$query}";
        return strlen($url) <= 2_048 && filter_var($url, FILTER_VALIDATE_URL) !== false
            ? $url
            : null;
    }

    public static function unitId(mixed $value): ?string
    {
        if ($value === null || is_bool($value) || is_array($value) || is_object($value)) {
            return null;
        }
        $raw = trim((string)$value);
        if (preg_match('/^\d{1,6}$/', $raw) !== 1) {
            return null;
        }
        $unitId = str_pad($raw, 6, '0', STR_PAD_LEFT);
        return $unitId === '000000' ? null : $unitId;
    }

    public static function opeId(mixed $value): ?string
    {
        if ($value === null || is_bool($value) || is_array($value) || is_object($value)) {
            return null;
        }
        $raw = strtoupper(trim((string)$value));
        $raw = preg_replace('/(?:OPEID|OPE)\s*[:#-]?\s*/i', '', $raw) ?? $raw;
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '' || strlen($digits) > 8) {
            return null;
        }
        if (strlen($digits) <= 6) {
            $digits = str_pad($digits, 6, '0', STR_PAD_LEFT) . '00';
        } else {
            $digits = str_pad($digits, 8, '0', STR_PAD_LEFT);
        }
        return $digits === '00000000' ? null : $digits;
    }

    public static function wikidataId(mixed $value): ?string
    {
        if ($value === null || is_array($value) || is_object($value)) {
            return null;
        }
        $raw = strtoupper(trim((string)$value));
        if (preg_match('/^(?:HTTPS?:\\/\\/WWW\\.WIKIDATA\\.ORG\\/ENTITY\\/)?(Q[1-9]\\d*)$/i', $raw, $matches) !== 1) {
            return null;
        }
        return strtoupper($matches[1]);
    }

    public static function state(mixed $value): ?string
    {
        $state = self::text($value, 100);
        if ($state === null) {
            return null;
        }
        $key = self::asciiFold(mb_strtolower($state, 'UTF-8'));
        $key = str_replace(['.', ',', '_', '-'], ' ', $key);
        $key = preg_replace('/\s+/', ' ', trim($key)) ?? trim($key);
        return self::STATES[$key] ?? null;
    }

    public static function postalCode(mixed $value): ?string
    {
        if ($value === null || is_array($value) || is_object($value)) {
            return null;
        }
        $raw = trim((string)$value);
        if (preg_match('/\b(\d{5})(?:[\s-]?(\d{4}))?\b/', $raw, $matches) !== 1) {
            return null;
        }
        return isset($matches[2]) && $matches[2] !== ''
            ? "{$matches[1]}-{$matches[2]}"
            : $matches[1];
    }

    public static function boolean(mixed $value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            if ((float)$value === 1.0) {
                return true;
            }
            if ((float)$value === 0.0) {
                return false;
            }
            return null;
        }
        $value = strtolower(trim((string)$value));
        return match ($value) {
            '1', 'true', 't', 'yes', 'y' => true,
            '0', 'false', 'f', 'no', 'n' => false,
            default => null,
        };
    }

    public static function decimal(
        mixed $value,
        float $minimum,
        float $maximum,
        int $scale = 7
    ): ?string {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        $number = (float)$value;
        if (!is_finite($number) || $number < $minimum || $number > $maximum) {
            return null;
        }
        return number_format($number, $scale, '.', '');
    }

    /**
     * Normalize a value for its destination column. Null means unusable or
     * missing; callers must not interpret it as an instruction to clear data.
     */
    public static function field(string $field, mixed $value): mixed
    {
        return match ($field) {
            'ipeds_unitid' => self::unitId($value),
            'ope_id' => self::opeId($value),
            'wikidata_id' => self::wikidataId($value),
            'website' => self::website($value),
            'logo_url', 'logo_thumbnail_url', 'logo_license_url' => self::url($value),
            'normalized_domain' => self::domain($value),
            'state' => self::state($value),
            'zip' => self::postalCode($value),
            'degree_granting', 'is_hbcu', 'is_tribal_college', 'pipeline_active' =>
                self::boolean($value),
            'latitude' => self::decimal($value, -90.0, 90.0),
            'longitude' => self::decimal($value, -180.0, 180.0),
            'source_reporting_year' => self::year($value),
            'logo_width', 'logo_height' => self::positiveInteger($value),
            'pipeline_match_confidence', 'pipeline_data_confidence' =>
                self::confidence($value),
            'aliases', 'former_names' => self::nameList($value),
            'name' => self::text($value, 100),
            'official_name' => self::text($value, 255),
            'address', 'location' => self::text($value, 255),
            'city' => self::text($value, 100),
            'county' => self::text($value, 120),
            'institution_sector' => self::text($value, 120),
            'institution_level', 'institution_control', 'operating_status' =>
                self::text($value, 80),
            'accreditor', 'slogan', 'nickname' => self::text($value, 255),
            'motto' => self::text($value, 500),
            'phone' => self::text($value, 50),
            'tagline' => self::text($value, 150),
            'logo_type' => self::token($value, 50),
            'logo_mime_type' => self::mimeType($value),
            'logo_license_name' => self::text($value, 255),
            'logo_attribution' => self::text($value, 20_000),
            'pipeline_match_method' => self::token($value, 64),
            'pipeline_version' => self::text($value, 64),
            default => self::text($value),
        };
    }

    /**
     * @return list<string>|null
     */
    private static function nameList(mixed $value): ?array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : preg_split('/[;|]/', $value);
        }
        if (!is_array($value)) {
            return null;
        }
        $names = [];
        $seen = [];
        foreach ($value as $candidate) {
            foreach (self::nameListEntries($candidate) as $name) {
                $identity = self::name($name);
                if ($identity === '' || isset($seen[$identity])) {
                    continue;
                }
                $seen[$identity] = true;
                $names[] = $name;
                if (count($names) >= self::MAXIMUM_NAME_LIST_ENTRIES) {
                    return $names;
                }
            }
        }
        return $names === [] ? null : $names;
    }

    /**
     * Return the usable names inside one raw alias-list entry.
     *
     * Earlier imports stored an entire delimited alias blob (IPEDS separates
     * aliases with "/") as a single entry, which is longer than any real name.
     * Splitting such an entry keeps the institution importable instead of
     * failing the whole record on one malformed legacy value.
     *
     * @return list<string>
     */
    private static function nameListEntries(mixed $candidate): array
    {
        try {
            $name = self::text($candidate, 255);
            return $name === null ? [] : [$name];
        } catch (LengthException $overlong) {
            // The entry is too long to be a single name; split it below.
        }

        $raw = self::text($candidate);
        if ($raw === null) {
            return [];
        }
        $entries = [];
        foreach (preg_split('#\s*[;|/]\s*#u', $raw) ?: [] as $part) {
            try {
                $name = self::text($part, 255);
            } catch (LengthException $stillTooLong) {
                continue;
            }
            if ($name !== null && mb_strlen($name, 'UTF-8') >= 2) {
                $entries[] = $name;
            }
        }
        return $entries;
    }

    private static function year(mixed $value): ?int
    {
        if (!is_numeric($value)) {
            return null;
        }
        $year = (int)$value;
        $maximum = (int)gmdate('Y') + 2;
        return $year >= 1900 && $year <= $maximum ? $year : null;
    }

    private static function positiveInteger(mixed $value): ?int
    {
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            return null;
        }
        $integer = (int)$value;
        return $integer > 0 && $integer <= 100_000 ? $integer : null;
    }

    private static function confidence(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }
        $confidence = (float)$value;
        return is_finite($confidence) && $confidence >= 0.0 && $confidence <= 1.0
            ? round($confidence, 4)
            : null;
    }

    private static function token(mixed $value, int $maximumBytes): ?string
    {
        $token = self::text($value, $maximumBytes);
        if ($token === null) {
            return null;
        }
        $token = strtolower(str_replace(['-', ' '], '_', $token));
        $token = preg_replace('/[^a-z0-9_]+/', '', $token) ?? '';
        return $token !== '' ? $token : null;
    }

    private static function mimeType(mixed $value): ?string
    {
        $mime = self::text($value, 100);
        if ($mime === null) {
            return null;
        }
        $mime = strtolower($mime);
        return preg_match('#^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$#', $mime) === 1
            ? $mime
            : null;
    }

    private static function website(mixed $value): ?string
    {
        $url = self::url($value);
        return $url !== null && strlen($url) <= 255 ? $url : null;
    }

    private static function asciiFold(string $value): string
    {
        if (function_exists('transliterator_transliterate')) {
            $folded = transliterator_transliterate('Any-Latin; Latin-ASCII', $value);
            if (is_string($folded)) {
                return $folded;
            }
        }
        $folded = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        return is_string($folded) ? $folded : $value;
    }
}

function srp_institution_normalize_name(mixed $value): string
{
    return SrpInstitutionNormalizer::name($value);
}

function srp_institution_normalize_domain(mixed $value): ?string
{
    return SrpInstitutionNormalizer::domain($value);
}

function srp_institution_normalize_url(mixed $value): ?string
{
    return SrpInstitutionNormalizer::url($value);
}

function srp_institution_normalize_unitid(mixed $value): ?string
{
    return SrpInstitutionNormalizer::unitId($value);
}

function srp_institution_normalize_field(string $field, mixed $value): mixed
{
    return SrpInstitutionNormalizer::field($field, $value);
}
