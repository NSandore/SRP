<?php

declare(strict_types=1);

/**
 * Tiny dependency-free test harness matching the repository's existing
 * executable `*_test.php` convention.
 */
final class SrpInstitutionTestHarness
{
    private int $failures = 0;
    private int $checks = 0;

    public function check(string $label, bool $condition, string $detail = ''): void
    {
        $this->checks++;
        if ($condition) {
            echo "  ok  - {$label}\n";
            return;
        }
        $this->failures++;
        echo "FAIL  - {$label}";
        if ($detail !== '') {
            echo ": {$detail}";
        }
        echo "\n";
    }

    public function same(string $label, mixed $expected, mixed $actual): void
    {
        $this->check(
            $label,
            $expected === $actual,
            'expected ' . $this->render($expected) . ', got ' . $this->render($actual)
        );
    }

    /**
     * @param class-string<Throwable>|null $class
     */
    public function throws(
        string $label,
        callable $operation,
        ?string $class = null,
        ?string $messageContains = null
    ): void {
        try {
            $operation();
        } catch (Throwable $error) {
            $classMatches = $class === null || $error instanceof $class;
            $messageMatches = $messageContains === null
                || str_contains($error->getMessage(), $messageContains);
            $this->check(
                $label,
                $classMatches && $messageMatches,
                get_class($error) . ': ' . $error->getMessage()
            );
            return;
        }
        $this->check($label, false, 'no exception was thrown');
    }

    public function finish(string $suite): never
    {
        echo "\n";
        if ($this->failures > 0) {
            echo "{$suite}: {$this->failures} of {$this->checks} checks FAILED\n";
            exit(1);
        }
        echo "{$suite}: all {$this->checks} checks passed.\n";
        exit(0);
    }

    private function render(mixed $value): string
    {
        $encoded = json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        return $encoded === false ? get_debug_type($value) : $encoded;
    }
}

function srp_institution_fixture(string $filename): string
{
    $path = __DIR__ . '/fixtures/institution_data/' . $filename;
    if (!is_file($path)) {
        throw new RuntimeException("Missing institution test fixture: {$filename}");
    }
    return $path;
}
