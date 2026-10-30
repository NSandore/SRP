<?php

declare(strict_types=1);

/**
 * File-backed run history. Institution pipeline history is deliberately not
 * stored in another database table.
 */
final class SrpInstitutionReportWriter
{
    private const CSV_REPORTS = [
        'inserted-institutions.csv' => [
            'community_id', 'ipeds_unitid', 'official_name', 'display_name',
            'city', 'state', 'match_method', 'match_confidence',
        ],
        'updated-institutions.csv' => [
            'community_id', 'ipeds_unitid', 'name', 'changed_fields', 'source',
        ],
        'unmatched-source-records.csv' => [
            'source', 'source_record_id', 'name', 'city', 'state', 'reason',
        ],
        'conflicting-values.csv' => [
            'community_id', 'field', 'current_value', 'candidate_value',
            'current_source', 'candidate_source', 'reason',
        ],
        'potential-duplicates.csv' => [
            'source', 'source_record_id', 'candidate_community_id',
            'name', 'city', 'state', 'match_method', 'match_score', 'reason',
        ],
        'inactive-institutions.csv' => [
            'community_id', 'ipeds_unitid', 'name', 'operating_status', 'reason',
        ],
        'missing-branding.csv' => [
            'community_id', 'ipeds_unitid', 'name', 'missing_fields',
        ],
        'logo-license-issues.csv' => [
            'community_id', 'wikidata_id', 'name', 'logo_candidate', 'reason',
        ],
        'failed-requests.csv' => [
            'source', 'url', 'category', 'http_status', 'attempts', 'message',
        ],
    ];

    private string $runId;
    private string $runDirectory;
    /** @var array<string, resource> */
    private array $handles = [];
    /** @var array<string, int> */
    private array $counts = [];
    /** @var array<string, mixed> */
    private array $summary;
    private bool $finalized = false;

    public function __construct(string $reportRoot, ?string $runId = null)
    {
        $reportRoot = rtrim($reportRoot, DIRECTORY_SEPARATOR);
        if ($reportRoot === '') {
            throw new InvalidArgumentException('The institution report path cannot be empty.');
        }

        $this->runId = $runId ?: gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(4));
        if (!preg_match('/^[A-Za-z0-9._-]+$/', $this->runId)) {
            throw new InvalidArgumentException('The institution run ID contains unsafe characters.');
        }
        $this->ensurePrivateDirectory($reportRoot);
        $this->runDirectory = $reportRoot . DIRECTORY_SEPARATOR . $this->runId;
        $this->ensurePrivateDirectory($this->runDirectory);

        $this->summary = [
            'run_id' => $this->runId,
            'started_at' => gmdate(DATE_ATOM),
            'finished_at' => null,
            'status' => 'running',
            'dry_run' => false,
            'filters' => [],
            'sources' => [],
            'counts' => [],
            'warnings' => [],
            'errors' => [],
            'pipeline_version' => null,
        ];
        foreach (self::CSV_REPORTS as $filename => $headers) {
            $path = $this->runDirectory . DIRECTORY_SEPARATOR . $filename;
            $handle = fopen($path, 'xb');
            if ($handle === false) {
                throw new RuntimeException("Unable to create institution report {$filename}.");
            }
            if (!flock($handle, LOCK_EX)) {
                fclose($handle);
                throw new RuntimeException("Unable to lock institution report {$filename}.");
            }
            fputcsv($handle, $headers);
            fflush($handle);
            $this->handles[$filename] = $handle;
            $this->counts[$filename] = 0;
        }
        $this->writeJsonAtomic('pipeline-run-summary.json', $this->summary);
    }

    public function runId(): string
    {
        return $this->runId;
    }

    public function directory(): string
    {
        return $this->runDirectory;
    }

    /**
     * @param array<string, scalar|null> $row
     */
    public function row(string $filename, array $row): void
    {
        if (!isset(self::CSV_REPORTS[$filename], $this->handles[$filename])) {
            throw new InvalidArgumentException("Unknown institution report: {$filename}");
        }
        $values = [];
        foreach (self::CSV_REPORTS[$filename] as $column) {
            $value = $row[$column] ?? null;
            if (is_bool($value)) {
                $value = $value ? '1' : '0';
            } elseif (is_array($value) || is_object($value)) {
                $value = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }
            $values[] = $value;
        }
        fputcsv($this->handles[$filename], $values);
        fflush($this->handles[$filename]);
        $this->counts[$filename]++;
    }

    public function increment(string $key, int $amount = 1): void
    {
        $current = (int)($this->summary['counts'][$key] ?? 0);
        $this->summary['counts'][$key] = $current + $amount;
    }

    /**
     * @param array<string, mixed> $metadata
     */
    public function source(string $source, string $status, array $metadata = []): void
    {
        $this->summary['sources'][$source] = array_merge(
            ['status' => $status],
            $metadata
        );
    }

    /**
     * @param array<string, mixed> $filters
     */
    public function configure(bool $dryRun, array $filters, string $pipelineVersion): void
    {
        $this->summary['dry_run'] = $dryRun;
        $this->summary['filters'] = $filters;
        $this->summary['pipeline_version'] = $pipelineVersion;
    }

    public function warning(string $message): void
    {
        $message = trim($message);
        if ($message !== '' && !in_array($message, $this->summary['warnings'], true)) {
            $this->summary['warnings'][] = $message;
        }
    }

    public function error(string $source, string $category, string $message): void
    {
        $entry = [
            'source' => $source,
            'category' => $category,
            'message' => $message,
            'at' => gmdate(DATE_ATOM),
        ];
        $this->summary['errors'][] = $entry;
    }

    /**
     * @param array<string, mixed> $extra
     */
    public function finalize(string $status, array $extra = []): string
    {
        if ($this->finalized) {
            return $this->runDirectory . DIRECTORY_SEPARATOR . 'pipeline-run-summary.json';
        }
        foreach ($this->handles as $handle) {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
        $this->handles = [];

        foreach ($this->counts as $filename => $count) {
            $key = substr($filename, 0, -4);
            $this->summary['counts'][$key] = $count;
        }
        $this->summary = array_merge($this->summary, $extra);
        $this->summary['status'] = $status;
        $this->summary['finished_at'] = gmdate(DATE_ATOM);
        $this->writeJsonAtomic('pipeline-run-summary.json', $this->summary);
        $this->finalized = true;
        return $this->runDirectory . DIRECTORY_SEPARATOR . 'pipeline-run-summary.json';
    }

    public function __destruct()
    {
        if (!$this->finalized) {
            try {
                $this->finalize('aborted');
            } catch (Throwable $ignored) {
                // Destructors must not mask the original pipeline failure.
            }
        }
    }

    private function ensurePrivateDirectory(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0770, true) && !is_dir($path)) {
            throw new RuntimeException("Unable to create private institution runtime path: {$path}");
        }
        if (!is_writable($path)) {
            throw new RuntimeException("Institution runtime path is not writable: {$path}");
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function writeJsonAtomic(string $filename, array $payload): void
    {
        $path = $this->runDirectory . DIRECTORY_SEPARATOR . $filename;
        $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
        $encoded = json_encode(
            $payload,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        ) . PHP_EOL;
        if (file_put_contents($temporary, $encoded, LOCK_EX) === false) {
            throw new RuntimeException("Unable to write institution report {$filename}.");
        }
        @chmod($temporary, 0660);
        if (!rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException("Unable to publish institution report {$filename}.");
        }
    }
}
