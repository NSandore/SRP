<?php

declare(strict_types=1);

require_once __DIR__ . '/SourceResult.php';

interface SrpInstitutionSourceInterface
{
    public function name(): string;

    /**
     * Context contains pipeline filters and source-specific bulk inputs.
     *
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult;
}
