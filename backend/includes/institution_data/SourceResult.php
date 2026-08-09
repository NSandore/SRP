<?php

declare(strict_types=1);

/**
 * Immutable, serializable outcome from one institution-data source.
 */
final class SrpInstitutionSourceResult implements Countable, IteratorAggregate, JsonSerializable
{
    public const STATUS_SUCCESS = 'success';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_SKIPPED = 'skipped';
    public const STATUS_FAILURE = 'failure';

    private string $source;
    private string $status;
    /** @var list<array<string, mixed>> */
    private array $records;
    /** @var array<string, mixed> */
    private array $metadata;
    /** @var list<array<string, mixed>> */
    private array $errors;
    /** @var list<string> */
    private array $warnings;

    /**
     * @param list<array<string, mixed>> $records
     * @param array<string, mixed> $metadata
     * @param list<array<string, mixed>|string|Throwable> $errors
     * @param list<string> $warnings
     */
    public function __construct(
        string $source,
        string $status,
        array $records = [],
        array $metadata = [],
        array $errors = [],
        array $warnings = []
    ) {
        $source = strtolower(trim($source));
        if ($source === '' || preg_match('/^[a-z0-9][a-z0-9_-]{0,63}$/', $source) !== 1) {
            throw new InvalidArgumentException('Invalid institution source name.');
        }
        if (!in_array($status, [
            self::STATUS_SUCCESS,
            self::STATUS_PARTIAL,
            self::STATUS_SKIPPED,
            self::STATUS_FAILURE,
        ], true)) {
            throw new InvalidArgumentException('Invalid institution source result status.');
        }

        $normalizedRecords = [];
        foreach ($records as $record) {
            if (!is_array($record)) {
                throw new InvalidArgumentException('Every source record must be an array.');
            }
            self::validateRecordEnvelope($record, $source);
            $normalizedRecords[] = $record;
        }

        $normalizedErrors = [];
        foreach ($errors as $error) {
            $normalizedErrors[] = self::normalizeError($error);
        }
        $normalizedWarnings = [];
        foreach ($warnings as $warning) {
            $warning = trim((string)$warning);
            if ($warning !== '' && !in_array($warning, $normalizedWarnings, true)) {
                $normalizedWarnings[] = $warning;
            }
        }

        if ($status === self::STATUS_FAILURE && $normalizedErrors === []) {
            $normalizedErrors[] = [
                'category' => 'source_failure',
                'message' => 'The source failed without an error description.',
            ];
        }
        if ($status === self::STATUS_SKIPPED && $normalizedRecords !== []) {
            throw new InvalidArgumentException('A skipped source result cannot contain records.');
        }

        $this->source = $source;
        $this->status = $status;
        $this->records = $normalizedRecords;
        $this->metadata = $metadata;
        $this->errors = $normalizedErrors;
        $this->warnings = $normalizedWarnings;
    }

    /**
     * @param list<array<string, mixed>> $records
     * @param array<string, mixed> $metadata
     * @param list<string> $warnings
     * @param list<array<string, mixed>|string|Throwable> $errors
     */
    public static function success(
        string $source,
        array $records,
        array $metadata = [],
        array $warnings = [],
        array $errors = []
    ): self {
        return new self(
            $source,
            $errors === [] ? self::STATUS_SUCCESS : self::STATUS_PARTIAL,
            $records,
            $metadata,
            $errors,
            $warnings
        );
    }

    /**
     * @param list<array<string, mixed>> $records
     * @param list<array<string, mixed>|string|Throwable> $errors
     * @param array<string, mixed> $metadata
     * @param list<string> $warnings
     */
    public static function partial(
        string $source,
        array $records,
        array $errors,
        array $metadata = [],
        array $warnings = []
    ): self {
        return new self(
            $source,
            self::STATUS_PARTIAL,
            $records,
            $metadata,
            $errors,
            $warnings
        );
    }

    /**
     * @param array<string, mixed> $metadata
     */
    public static function skipped(string $source, string $reason, array $metadata = []): self
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw new InvalidArgumentException('A skipped source must include a reason.');
        }
        $metadata['skip_reason'] = $reason;
        return new self($source, self::STATUS_SKIPPED, [], $metadata, [], [$reason]);
    }

    /**
     * @param array<string, mixed>|string|Throwable $error
     * @param array<string, mixed> $metadata
     */
    public static function failure(string $source, $error, array $metadata = []): self
    {
        return new self($source, self::STATUS_FAILURE, [], $metadata, [$error], []);
    }

    public function source(): string
    {
        return $this->source;
    }

    public function status(): string
    {
        return $this->status;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function records(): array
    {
        return $this->records;
    }

    /**
     * @return array<string, mixed>
     */
    public function metadata(): array
    {
        return $this->metadata;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * @return list<string>
     */
    public function warnings(): array
    {
        return $this->warnings;
    }

    public function isSuccess(): bool
    {
        return in_array($this->status, [self::STATUS_SUCCESS, self::STATUS_PARTIAL], true);
    }

    public function isSkipped(): bool
    {
        return $this->status === self::STATUS_SKIPPED;
    }

    public function hasErrors(): bool
    {
        return $this->errors !== [];
    }

    public function count(): int
    {
        return count($this->records);
    }

    /**
     * @return Traversable<int, array<string, mixed>>
     */
    public function getIterator(): Traversable
    {
        yield from $this->records;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'source' => $this->source,
            'status' => $this->status,
            'record_count' => count($this->records),
            'records' => $this->records,
            'metadata' => $this->metadata,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * @param array<string, mixed> $record
     */
    private static function validateRecordEnvelope(array $record, string $source): void
    {
        foreach (['source', 'source_record_id', 'retrieved_at', 'match', 'fields', 'raw_metadata'] as $required) {
            if (!array_key_exists($required, $record)) {
                throw new InvalidArgumentException("Source record is missing {$required}.");
            }
        }
        if ((string)$record['source'] !== $source) {
            throw new InvalidArgumentException('Source record name does not match its result.');
        }
        if (trim((string)$record['source_record_id']) === '') {
            throw new InvalidArgumentException('Source record ID cannot be empty.');
        }
        if (!is_array($record['match']) || !is_array($record['fields']) || !is_array($record['raw_metadata'])) {
            throw new InvalidArgumentException('Source match, fields, and raw metadata must be arrays.');
        }
        foreach (['ipeds_unitid', 'ope_id', 'normalized_domain', 'name', 'city', 'state'] as $matchKey) {
            if (!array_key_exists($matchKey, $record['match'])) {
                throw new InvalidArgumentException("Source match is missing {$matchKey}.");
            }
        }
        try {
            new DateTimeImmutable((string)$record['retrieved_at']);
        } catch (Throwable $error) {
            throw new InvalidArgumentException('Source retrieved_at must be an ISO-8601 date.', 0, $error);
        }
        foreach ($record['fields'] as $field => $candidate) {
            if (!is_string($field) || $field === '' || !is_array($candidate)) {
                throw new InvalidArgumentException('Every source field must contain a candidate array.');
            }
            foreach ([
                'value', 'source_type', 'source_url', 'source_record_id',
                'retrieved_at', 'confidence', 'metadata',
            ] as $candidateKey) {
                if (!array_key_exists($candidateKey, $candidate)) {
                    throw new InvalidArgumentException(
                        "Source field {$field} is missing candidate key {$candidateKey}."
                    );
                }
            }
            if (!is_numeric($candidate['confidence'])
                || (float)$candidate['confidence'] < 0.0
                || (float)$candidate['confidence'] > 1.0
            ) {
                throw new InvalidArgumentException("Source field {$field} has invalid confidence.");
            }
            if (!is_array($candidate['metadata'])) {
                throw new InvalidArgumentException("Source field {$field} metadata must be an array.");
            }
        }
    }

    /**
     * @param array<string, mixed>|string|Throwable $error
     * @return array<string, mixed>
     */
    private static function normalizeError($error): array
    {
        if ($error instanceof SrpInstitutionHttpException) {
            return $error->toArray();
        }
        if ($error instanceof Throwable) {
            return [
                'category' => 'source_failure',
                'message' => mb_substr($error->getMessage(), 0, 1000),
                'exception' => get_class($error),
            ];
        }
        if (is_string($error)) {
            return [
                'category' => 'source_failure',
                'message' => mb_substr(trim($error), 0, 1000),
            ];
        }
        if (!is_array($error)) {
            throw new InvalidArgumentException('Unsupported source error value.');
        }
        $error['category'] = trim((string)($error['category'] ?? 'source_failure'));
        $error['message'] = mb_substr(trim((string)($error['message'] ?? 'Source request failed.')), 0, 1000);
        return $error;
    }
}
