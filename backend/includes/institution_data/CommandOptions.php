<?php

declare(strict_types=1);

final class SrpInstitutionCommandOptions
{
    private const COMMANDS = [
        'refresh', 'validate', 'resolve', 'export', 'status', 'retry-failures',
    ];

    private const VALUE_OPTIONS = [
        'source', 'state', 'unitid', 'format', 'file', 'limit', 'run-id',
    ];

    private const FLAG_OPTIONS = [
        'branding-only', 'dry-run', 'include-inactive', 'force',
    ];

    /**
     * @param list<string> $argv
     * @return array{command: string, options: array<string, mixed>}
     */
    public static function parse(array $argv): array
    {
        array_shift($argv);
        $command = strtolower(trim((string)(array_shift($argv) ?? '')));
        if (!in_array($command, self::COMMANDS, true)) {
            throw new InvalidArgumentException(
                'Command must be one of: ' . implode(', ', self::COMMANDS) . '.'
            );
        }

        $options = [
            'sources' => [],
            'state' => null,
            'unitid' => null,
            'format' => 'csv',
            'file' => null,
            'limit' => null,
            'run_id' => null,
            'branding_only' => false,
            'dry_run' => false,
            'include_inactive' => false,
            'force' => false,
        ];

        for ($index = 0, $count = count($argv); $index < $count; $index++) {
            $argument = (string)$argv[$index];
            if (strncmp($argument, '--', 2) !== 0) {
                throw new InvalidArgumentException("Unexpected argument: {$argument}");
            }
            $body = substr($argument, 2);
            $value = null;
            if (strpos($body, '=') !== false) {
                [$body, $value] = explode('=', $body, 2);
            }
            $name = strtolower(trim($body));

            if (in_array($name, self::FLAG_OPTIONS, true)) {
                if ($value !== null) {
                    throw new InvalidArgumentException("--{$name} does not accept a value.");
                }
                $options[str_replace('-', '_', $name)] = true;
                continue;
            }
            if (!in_array($name, self::VALUE_OPTIONS, true)) {
                throw new InvalidArgumentException("Unknown option: --{$name}");
            }
            if ($value === null) {
                $index++;
                if ($index >= $count || strncmp((string)$argv[$index], '--', 2) === 0) {
                    throw new InvalidArgumentException("--{$name} requires a value.");
                }
                $value = (string)$argv[$index];
            }
            $value = trim((string)$value);
            if ($value === '') {
                throw new InvalidArgumentException("--{$name} cannot be empty.");
            }

            switch ($name) {
                case 'source':
                    foreach (preg_split('/\s*,\s*/', strtolower($value)) ?: [] as $source) {
                        if ($source !== '') {
                            $options['sources'][] = $source;
                        }
                    }
                    break;
                case 'state':
                    $state = strtoupper($value);
                    if (!preg_match('/^[A-Z]{2}$/', $state)) {
                        throw new InvalidArgumentException('--state must be a two-letter postal abbreviation.');
                    }
                    $options['state'] = $state;
                    break;
                case 'unitid':
                    if (!preg_match('/^\d{4,12}$/', $value)) {
                        throw new InvalidArgumentException('--unitid must contain only digits.');
                    }
                    $options['unitid'] = ltrim($value, '0') ?: '0';
                    break;
                case 'format':
                    $format = strtolower($value);
                    if (!in_array($format, ['csv', 'json'], true)) {
                        throw new InvalidArgumentException('--format must be csv or json.');
                    }
                    $options['format'] = $format;
                    break;
                case 'limit':
                    $limit = filter_var($value, FILTER_VALIDATE_INT);
                    if ($limit === false || $limit < 1) {
                        throw new InvalidArgumentException('--limit must be a positive integer.');
                    }
                    $options['limit'] = (int)$limit;
                    break;
                case 'run-id':
                    if (!preg_match('/^[A-Za-z0-9._-]+$/', $value)) {
                        throw new InvalidArgumentException('--run-id contains unsafe characters.');
                    }
                    $options['run_id'] = $value;
                    break;
                default:
                    $options[$name] = $value;
                    break;
            }
        }

        $options['sources'] = array_values(array_unique($options['sources']));
        $allowedSources = [
            'ipeds',
            'scorecard',
            'wikidata',
            'wikimedia',
            'college-color',
            'official-site',
        ];
        foreach ($options['sources'] as $source) {
            if (!in_array($source, $allowedSources, true)) {
                throw new InvalidArgumentException(
                    "Unknown source '{$source}'. Allowed sources: " . implode(', ', $allowedSources) . '.'
                );
            }
        }

        if ($options['branding_only'] && $options['sources']) {
            throw new InvalidArgumentException('--branding-only cannot be combined with --source.');
        }

        return ['command' => $command, 'options' => $options];
    }
}
