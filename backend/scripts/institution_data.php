#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/institution_data/bootstrap.php';
require_once __DIR__ . '/../includes/institution_data/CommandOptions.php';
require_once __DIR__ . '/../includes/institution_data/Exporter.php';
require_once __DIR__ . '/../includes/institution_data/HttpClient.php';
require_once __DIR__ . '/../includes/institution_data/Maintenance.php';
require_once __DIR__ . '/../includes/institution_data/Pipeline.php';
require_once __DIR__ . '/../includes/institution_data/Schema.php';
require_once __DIR__ . '/../includes/institution_data/SourceInterface.php';
require_once __DIR__ . '/../includes/institution_data/SourceResult.php';
require_once __DIR__ . '/../includes/institution_data/SourceSupport.php';

foreach (glob(__DIR__ . '/../includes/institution_data/Sources/*.php') ?: [] as $sourceFile) {
    require_once $sourceFile;
}

/**
 * @return never
 */
function srp_institution_cli_help(int $exitCode = 0): never
{
    $stream = $exitCode === 0 ? STDOUT : STDERR;
    fwrite(
        $stream,
        <<<'TEXT'
Institution data pipeline

Usage:
  php backend/scripts/institution_data.php refresh [options]
  php backend/scripts/institution_data.php validate
  php backend/scripts/institution_data.php resolve [--unitid ID] [--dry-run]
  php backend/scripts/institution_data.php export [--format csv|json] [--file PATH]
  php backend/scripts/institution_data.php status
  php backend/scripts/institution_data.php retry-failures [options]

Refresh options:
  --source ipeds|scorecard|wikidata|wikimedia|official-site
  --branding-only
  --state CT
  --unitid 100751
  --file /path/to/HD2024.zip   Local IPEDS fixture/archive
  --limit 100
  --dry-run
  --run-id safe-identifier

Export options:
  --format csv|json
  --file filename-or-path
  --include-inactive

The official-site source is disabled unless
INSTITUTION_PIPELINE_CRAWLER_ENABLED=true.

TEXT
    );
    exit($exitCode);
}

/**
 * @param mixed $payload
 */
function srp_institution_cli_output($payload): void
{
    fwrite(
        STDOUT,
        json_encode(
            $payload,
            JSON_PRETTY_PRINT
            | JSON_UNESCAPED_SLASHES
            | JSON_UNESCAPED_UNICODE
            | JSON_THROW_ON_ERROR
        ) . PHP_EOL
    );
}

/**
 * @param array<string, mixed> $config
 * @return array<string, SrpInstitutionSourceInterface>
 */
function srp_institution_cli_sources(
    SrpInstitutionHttpClient $http,
    array $config
): array {
    $classes = [
        'ipeds' => 'SrpInstitutionIpedsSource',
        'scorecard' => 'SrpInstitutionScorecardSource',
        'wikidata' => 'SrpInstitutionWikidataSource',
        'wikimedia' => 'SrpInstitutionWikimediaSource',
        'college-color' => 'SrpInstitutionCollegeColorSource',
        'official-site' => 'SrpInstitutionOfficialSiteSource',
    ];
    $sources = [];
    foreach ($classes as $name => $class) {
        if (!class_exists($class)) {
            continue;
        }
        $source = new $class($http, $config);
        if (!$source instanceof SrpInstitutionSourceInterface) {
            throw new LogicException("{$class} must implement the source interface.");
        }
        $sources[$name] = $source;
    }
    return $sources;
}

if (count($argv) < 2 || in_array($argv[1] ?? '', ['-h', '--help', 'help'], true)) {
    srp_institution_cli_help(count($argv) < 2 ? 1 : 0);
}

try {
    $parsed = SrpInstitutionCommandOptions::parse($argv);
    $command = $parsed['command'];
    $options = $parsed['options'];
    $config = SrpInstitutionConfig::load();
    $db = getDB();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $maintenance = new SrpInstitutionMaintenance($db, $config);

    if ($command === 'validate') {
        $result = $maintenance->validate();
        srp_institution_cli_output($result);
        exit(($result['valid'] ?? false) ? 0 : 2);
    }

    if ($command === 'status') {
        srp_institution_cli_output($maintenance->status());
        exit(0);
    }

    if ($command === 'resolve') {
        $result = $maintenance->resolve($options);
        srp_institution_cli_output($result);
        exit(0);
    }

    if ($command === 'export') {
        $path = SrpInstitutionExporter::export(
            $db,
            (string)$options['format'],
            rtrim((string)$config['report_path'], DIRECTORY_SEPARATOR)
                . DIRECTORY_SEPARATOR . 'exports',
            $options['file'] !== null ? (string)$options['file'] : null,
            (bool)$options['include_inactive']
        );
        srp_institution_cli_output([
            'status' => 'success',
            'format' => $options['format'],
            'path' => $path,
        ]);
        exit(0);
    }

    $httpLogger = static function (
        string $level,
        string $event,
        array $context
    ): void {
        error_log('[SRP institution-http] ' . json_encode(
            [
                'level' => $level,
                'event' => $event,
                'at' => gmdate(DATE_ATOM),
                'context' => $context,
            ],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        ));
    };
    $http = new SrpInstitutionHttpClient($config, null, null, $httpLogger);
    $sources = srp_institution_cli_sources($http, $config);

    if ($command === 'retry-failures') {
        $targets = $maintenance->retryTargets((int)($options['limit'] ?? 500));
        if ($targets['unitids'] === []) {
            srp_institution_cli_output([
                'status' => 'success',
                'message' => 'No retryable institution rows have a UNITID.',
                'rows_without_unitid' => $targets['rows_without_unitid'],
            ]);
            exit(0);
        }
        $options['unitids'] = $targets['unitids'];
        $options['unitid'] = null;
        $options['file'] = null;
    }

    $reporter = new SrpInstitutionReportWriter(
        (string)$config['report_path'],
        $options['run_id'] !== null ? (string)$options['run_id'] : null
    );
    $pipeline = new SrpInstitutionPipeline(
        $db,
        $config,
        $reporter,
        $sources
    );
    $result = $pipeline->refresh($options);

    if ($command === 'retry-failures'
        && ($result['status'] ?? '') === 'success'
    ) {
        $result['completed_refresh_requests'] =
            $maintenance->completeRefreshRequests(
                $options['unitids'],
                (string)$result['report_path']
            );
        $result['rows_without_unitid'] = $targets['rows_without_unitid'];
    }

    srp_institution_cli_output($result);
    exit(match ((string)($result['status'] ?? 'failed')) {
        'success' => 0,
        'partial' => 2,
        default => 1,
    });
} catch (InvalidArgumentException $error) {
    fwrite(STDERR, 'Invalid command: ' . $error->getMessage() . PHP_EOL);
    srp_institution_cli_help(64);
} catch (Throwable $error) {
    error_log('[SRP institution-data] ' . get_class($error) . ': ' . $error->getMessage());
    fwrite(
        STDERR,
        'Institution data command failed: ' . $error->getMessage() . PHP_EOL
    );
    exit(1);
}
