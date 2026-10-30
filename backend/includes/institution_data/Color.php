<?php

declare(strict_types=1);

require_once __DIR__ . '/Normalizer.php';

/**
 * CSS color parsing for selected scalar values. Pantone references are
 * recognized but intentionally never converted without a cited conversion.
 */
final class SrpInstitutionColor
{
    /** @var array<string, string> */
    private const NAMED = [
        'aliceblue' => 'F0F8FF', 'antiquewhite' => 'FAEBD7', 'aqua' => '00FFFF',
        'aquamarine' => '7FFFD4', 'azure' => 'F0FFFF', 'beige' => 'F5F5DC',
        'bisque' => 'FFE4C4', 'black' => '000000', 'blanchedalmond' => 'FFEBCD',
        'blue' => '0000FF', 'blueviolet' => '8A2BE2', 'brown' => 'A52A2A',
        'burlywood' => 'DEB887', 'cadetblue' => '5F9EA0', 'chartreuse' => '7FFF00',
        'chocolate' => 'D2691E', 'coral' => 'FF7F50', 'cornflowerblue' => '6495ED',
        'cornsilk' => 'FFF8DC', 'crimson' => 'DC143C', 'cyan' => '00FFFF',
        'darkblue' => '00008B', 'darkcyan' => '008B8B', 'darkgoldenrod' => 'B8860B',
        'darkgray' => 'A9A9A9', 'darkgrey' => 'A9A9A9', 'darkgreen' => '006400',
        'darkkhaki' => 'BDB76B', 'darkmagenta' => '8B008B',
        'darkolivegreen' => '556B2F', 'darkorange' => 'FF8C00',
        'darkorchid' => '9932CC', 'darkred' => '8B0000', 'darksalmon' => 'E9967A',
        'darkseagreen' => '8FBC8F', 'darkslateblue' => '483D8B',
        'darkslategray' => '2F4F4F', 'darkslategrey' => '2F4F4F',
        'darkturquoise' => '00CED1', 'darkviolet' => '9400D3',
        'deeppink' => 'FF1493', 'deepskyblue' => '00BFFF',
        'dimgray' => '696969', 'dimgrey' => '696969', 'dodgerblue' => '1E90FF',
        'firebrick' => 'B22222', 'floralwhite' => 'FFFAF0', 'forestgreen' => '228B22',
        'fuchsia' => 'FF00FF', 'gainsboro' => 'DCDCDC', 'ghostwhite' => 'F8F8FF',
        'gold' => 'FFD700', 'goldenrod' => 'DAA520', 'gray' => '808080',
        'grey' => '808080', 'green' => '008000', 'greenyellow' => 'ADFF2F',
        'honeydew' => 'F0FFF0', 'hotpink' => 'FF69B4', 'indianred' => 'CD5C5C',
        'indigo' => '4B0082', 'ivory' => 'FFFFF0', 'khaki' => 'F0E68C',
        'lavender' => 'E6E6FA', 'lavenderblush' => 'FFF0F5',
        'lawngreen' => '7CFC00', 'lemonchiffon' => 'FFFACD',
        'lightblue' => 'ADD8E6', 'lightcoral' => 'F08080',
        'lightcyan' => 'E0FFFF', 'lightgoldenrodyellow' => 'FAFAD2',
        'lightgray' => 'D3D3D3', 'lightgrey' => 'D3D3D3',
        'lightgreen' => '90EE90', 'lightpink' => 'FFB6C1',
        'lightsalmon' => 'FFA07A', 'lightseagreen' => '20B2AA',
        'lightskyblue' => '87CEFA', 'lightslategray' => '778899',
        'lightslategrey' => '778899', 'lightsteelblue' => 'B0C4DE',
        'lightyellow' => 'FFFFE0', 'lime' => '00FF00', 'limegreen' => '32CD32',
        'linen' => 'FAF0E6', 'magenta' => 'FF00FF', 'maroon' => '800000',
        'mediumaquamarine' => '66CDAA', 'mediumblue' => '0000CD',
        'mediumorchid' => 'BA55D3', 'mediumpurple' => '9370DB',
        'mediumseagreen' => '3CB371', 'mediumslateblue' => '7B68EE',
        'mediumspringgreen' => '00FA9A', 'mediumturquoise' => '48D1CC',
        'mediumvioletred' => 'C71585', 'midnightblue' => '191970',
        'mintcream' => 'F5FFFA', 'mistyrose' => 'FFE4E1',
        'moccasin' => 'FFE4B5', 'navajowhite' => 'FFDEAD', 'navy' => '000080',
        'oldlace' => 'FDF5E6', 'olive' => '808000', 'olivedrab' => '6B8E23',
        'orange' => 'FFA500', 'orangered' => 'FF4500', 'orchid' => 'DA70D6',
        'palegoldenrod' => 'EEE8AA', 'palegreen' => '98FB98',
        'paleturquoise' => 'AFEEEE', 'palevioletred' => 'DB7093',
        'papayawhip' => 'FFEFD5', 'peachpuff' => 'FFDAB9', 'peru' => 'CD853F',
        'pink' => 'FFC0CB', 'plum' => 'DDA0DD', 'powderblue' => 'B0E0E6',
        'purple' => '800080', 'rebeccapurple' => '663399', 'red' => 'FF0000',
        'rosybrown' => 'BC8F8F', 'royalblue' => '4169E1',
        'saddlebrown' => '8B4513', 'salmon' => 'FA8072',
        'sandybrown' => 'F4A460', 'seagreen' => '2E8B57',
        'seashell' => 'FFF5EE', 'sienna' => 'A0522D', 'silver' => 'C0C0C0',
        'skyblue' => '87CEEB', 'slateblue' => '6A5ACD', 'slategray' => '708090',
        'slategrey' => '708090', 'snow' => 'FFFAFA', 'springgreen' => '00FF7F',
        'steelblue' => '4682B4', 'tan' => 'D2B48C', 'teal' => '008080',
        'thistle' => 'D8BFD8', 'tomato' => 'FF6347', 'turquoise' => '40E0D0',
        'violet' => 'EE82EE', 'wheat' => 'F5DEB3', 'white' => 'FFFFFF',
        'whitesmoke' => 'F5F5F5', 'yellow' => 'FFFF00',
        'yellowgreen' => '9ACD32',
    ];

    /**
     * @return array{
     *   original: ?string,
     *   normalized: ?string,
     *   valid: bool,
     *   format: ?string,
     *   alpha: ?float,
     *   approximate: bool,
     *   reason: ?string
     * }
     */
    public static function parse(mixed $value): array
    {
        $original = SrpInstitutionNormalizer::text($value, 255);
        $result = [
            'original' => $original,
            'normalized' => null,
            'valid' => false,
            'format' => null,
            'alpha' => null,
            'approximate' => false,
            'reason' => null,
        ];
        if ($original === null) {
            $result['reason'] = 'missing';
            return $result;
        }
        $color = strtolower(trim($original));
        if (preg_match('/\b(?:pantone|pms)\b/i', $color) === 1) {
            $result['format'] = 'pantone';
            $result['reason'] = 'pantone_conversion_requires_a_cited_source';
            return $result;
        }
        if ($color === 'transparent') {
            $result['format'] = 'named';
            $result['alpha'] = 0.0;
            $result['reason'] = 'fully_transparent';
            return $result;
        }
        if (isset(self::NAMED[$color])) {
            return self::success($result, '#' . self::NAMED[$color], 'named', 1.0);
        }

        if (preg_match('/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color, $matches) === 1) {
            $hex = strtoupper($matches[1]);
            if (strlen($hex) === 3 || strlen($hex) === 4) {
                $hex = implode('', array_map(
                    static fn (string $character): string => $character . $character,
                    str_split($hex)
                ));
            }
            $alpha = 1.0;
            if (strlen($hex) === 8) {
                $alpha = hexdec(substr($hex, 6, 2)) / 255;
                $hex = substr($hex, 0, 6);
            }
            if ($alpha <= 0.0) {
                $result['format'] = 'hex';
                $result['alpha'] = 0.0;
                $result['reason'] = 'fully_transparent';
                return $result;
            }
            return self::success($result, '#' . $hex, 'hex', $alpha);
        }

        if (preg_match('/^rgba?\((.+)\)$/i', $color, $matches) === 1) {
            $parsed = self::parseRgbArguments($matches[1]);
            if ($parsed !== null) {
                [$red, $green, $blue, $alpha] = $parsed;
                if ($alpha <= 0.0) {
                    $result['format'] = 'rgb';
                    $result['alpha'] = 0.0;
                    $result['reason'] = 'fully_transparent';
                    return $result;
                }
                $hex = sprintf('#%02X%02X%02X', $red, $green, $blue);
                return self::success($result, $hex, 'rgb', $alpha);
            }
        }

        if (preg_match('/^hsla?\((.+)\)$/i', $color, $matches) === 1) {
            $parsed = self::parseHslArguments($matches[1]);
            if ($parsed !== null) {
                [$hue, $saturation, $lightness, $alpha] = $parsed;
                if ($alpha <= 0.0) {
                    $result['format'] = 'hsl';
                    $result['alpha'] = 0.0;
                    $result['reason'] = 'fully_transparent';
                    return $result;
                }
                [$red, $green, $blue] = self::hslToRgb($hue, $saturation, $lightness);
                $hex = sprintf('#%02X%02X%02X', $red, $green, $blue);
                return self::success($result, $hex, 'hsl', $alpha);
            }
        }

        $result['reason'] = 'unsupported_or_invalid_color';
        return $result;
    }

    public static function normalize(mixed $value): ?string
    {
        return self::parse($value)['normalized'];
    }

    public static function isPantone(mixed $value): bool
    {
        $text = SrpInstitutionNormalizer::text($value, 255);
        return $text !== null && preg_match('/\b(?:pantone|pms)\b/i', $text) === 1;
    }

    /**
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    private static function success(
        array $base,
        string $hex,
        string $format,
        float $alpha
    ): array {
        $base['normalized'] = $hex;
        $base['valid'] = true;
        $base['format'] = $format;
        $base['alpha'] = round($alpha, 4);
        $base['approximate'] = $alpha < 1.0;
        $base['reason'] = $alpha < 1.0 ? 'alpha_channel_not_stored' : null;
        return $base;
    }

    /**
     * @return array{int, int, int, float}|null
     */
    private static function parseRgbArguments(string $arguments): ?array
    {
        $arguments = trim($arguments);
        $alphaRaw = null;
        if (str_contains($arguments, ',')) {
            $parts = array_map('trim', explode(',', $arguments));
            if (count($parts) === 4) {
                $alphaRaw = array_pop($parts);
            }
        } else {
            $slashParts = array_map('trim', explode('/', $arguments, 2));
            $parts = preg_split('/\s+/', $slashParts[0]) ?: [];
            $alphaRaw = $slashParts[1] ?? null;
        }
        if (count($parts) !== 3) {
            return null;
        }
        $channels = [];
        foreach ($parts as $part) {
            $channel = self::rgbChannel($part);
            if ($channel === null) {
                return null;
            }
            $channels[] = $channel;
        }
        $alpha = self::alpha($alphaRaw);
        if ($alpha === null) {
            return null;
        }
        return [$channels[0], $channels[1], $channels[2], $alpha];
    }

    /**
     * @return array{float, float, float, float}|null
     */
    private static function parseHslArguments(string $arguments): ?array
    {
        $arguments = trim($arguments);
        $alphaRaw = null;
        if (str_contains($arguments, ',')) {
            $parts = array_map('trim', explode(',', $arguments));
            if (count($parts) === 4) {
                $alphaRaw = array_pop($parts);
            }
        } else {
            $slashParts = array_map('trim', explode('/', $arguments, 2));
            $parts = preg_split('/\s+/', $slashParts[0]) ?: [];
            $alphaRaw = $slashParts[1] ?? null;
        }
        if (count($parts) !== 3) {
            return null;
        }
        $hue = self::hue($parts[0]);
        $saturation = self::percentage($parts[1]);
        $lightness = self::percentage($parts[2]);
        $alpha = self::alpha($alphaRaw);
        if ($hue === null || $saturation === null || $lightness === null || $alpha === null) {
            return null;
        }
        return [$hue, $saturation, $lightness, $alpha];
    }

    private static function rgbChannel(string $value): ?int
    {
        $value = trim($value);
        if (str_ends_with($value, '%')) {
            $number = substr($value, 0, -1);
            if (!is_numeric($number) || (float)$number < 0 || (float)$number > 100) {
                return null;
            }
            return (int)round((float)$number * 2.55);
        }
        if (!is_numeric($value) || (float)$value < 0 || (float)$value > 255) {
            return null;
        }
        return (int)round((float)$value);
    }

    private static function alpha(?string $value): ?float
    {
        if ($value === null || trim($value) === '') {
            return 1.0;
        }
        $value = trim($value);
        if (str_ends_with($value, '%')) {
            $number = substr($value, 0, -1);
            if (!is_numeric($number) || (float)$number < 0 || (float)$number > 100) {
                return null;
            }
            return (float)$number / 100;
        }
        if (!is_numeric($value) || (float)$value < 0 || (float)$value > 1) {
            return null;
        }
        return (float)$value;
    }

    private static function percentage(string $value): ?float
    {
        $value = trim($value);
        if (!str_ends_with($value, '%')) {
            return null;
        }
        $number = substr($value, 0, -1);
        if (!is_numeric($number) || (float)$number < 0 || (float)$number > 100) {
            return null;
        }
        return (float)$number / 100;
    }

    private static function hue(string $value): ?float
    {
        $value = strtolower(trim($value));
        if (preg_match('/^(-?(?:\d+(?:\.\d+)?|\.\d+))(deg|grad|rad|turn)?$/', $value, $matches) !== 1) {
            return null;
        }
        $hue = (float)$matches[1];
        $unit = $matches[2] ?? 'deg';
        $hue = match ($unit) {
            'grad' => $hue * 0.9,
            'rad' => rad2deg($hue),
            'turn' => $hue * 360,
            default => $hue,
        };
        $hue = fmod($hue, 360.0);
        return $hue < 0 ? $hue + 360.0 : $hue;
    }

    /**
     * @return array{int, int, int}
     */
    private static function hslToRgb(float $hue, float $saturation, float $lightness): array
    {
        $chroma = (1 - abs(2 * $lightness - 1)) * $saturation;
        $section = $hue / 60;
        $x = $chroma * (1 - abs(fmod($section, 2) - 1));
        [$red, $green, $blue] = match (true) {
            $section < 1 => [$chroma, $x, 0.0],
            $section < 2 => [$x, $chroma, 0.0],
            $section < 3 => [0.0, $chroma, $x],
            $section < 4 => [0.0, $x, $chroma],
            $section < 5 => [$x, 0.0, $chroma],
            default => [$chroma, 0.0, $x],
        };
        $match = $lightness - ($chroma / 2);
        return [
            (int)round(($red + $match) * 255),
            (int)round(($green + $match) * 255),
            (int)round(($blue + $match) * 255),
        ];
    }
}

function srp_institution_normalize_color(mixed $value): ?string
{
    return SrpInstitutionColor::normalize($value);
}

/**
 * @return array<string, mixed>
 */
function srp_institution_parse_color(mixed $value): array
{
    return SrpInstitutionColor::parse($value);
}
