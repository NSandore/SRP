<?php

declare(strict_types=1);

/**
 * Institution colours from the English Wikipedia module
 * `Module:College_color/data`, matched to institutions by exact IPEDS UNITID.
 *
 * The module is keyed by athletics team name ("Alabama Crimson Tide"), not by
 * institution, so a name comparison against the directory would be guesswork.
 * Instead each team is resolved through Wikidata: the team item carries P1268
 * ("represents") pointing at its university, and that university carries P1771
 * (IPEDS UNITID). The result is an exact identifier match, never a fuzzy one.
 *
 * Values are classified `third_party_dataset`. Roughly 98% of the module's
 * entries cite an official brand guide, but this pipeline is trusting
 * Wikipedia's transcription rather than reading those guides, so the lower
 * confidence is the honest label: it fills empty colours without ever
 * displacing IPEDS, an official page, or a manual override.
 *
 * Athletics palettes and institutional palettes usually agree, but not always.
 * Every value therefore records its team of origin in candidate metadata so a
 * reviewer can see where a colour came from.
 */
final class SrpInstitutionCollegeColorSource implements SrpInstitutionSourceInterface
{
    private const MODULE_URL =
        'https://en.wikipedia.org/wiki/Module:College_color/data?action=raw';
    private const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
    private const SOURCE_TYPE = 'third_party_dataset';
    private const CONFIDENCE = 0.50;

    private SrpInstitutionHttpClient $http;
    /** @var array<string, mixed> */
    private array $config;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(SrpInstitutionHttpClient $http, array $config = [])
    {
        $this->http = $http;
        $this->config = $config;
    }

    public function name(): string
    {
        return 'college-color';
    }

    /**
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        $warnings = [];
        $errors = [];

        try {
            $raw = $this->loadModule($context);
            $entries = $this->parseModule($raw);
            if ($entries === []) {
                throw new RuntimeException('No colour entries were parsed from the module.');
            }

            $batchSize = (int)SrpInstitutionSourceSupport::config(
                $this->config,
                ['college_color.batch_size', 'college_color_batch_size'],
                100
            );
            $batchSize = max(10, min(200, $batchSize));

            $teamNames = array_keys($entries);
            $unitIds = [];
            $batchesCompleted = 0;
            $batchesRequested = (int)ceil(count($teamNames) / $batchSize);

            foreach (array_chunk($teamNames, $batchSize) as $batch) {
                try {
                    foreach ($this->resolveUnitIds($batch) as $team => $unitId) {
                        $unitIds[$team] = $unitId;
                    }
                    $batchesCompleted++;
                } catch (Throwable $error) {
                    // One rate-limited batch must not discard the rest.
                    $warnings[] = 'A Wikidata batch failed; other batches were retained.';
                }
            }

            if ($unitIds === []) {
                throw new RuntimeException(
                    'No teams could be resolved to an IPEDS UNITID through Wikidata.'
                );
            }

            $retrievedAt = $this->http->nowAtom();
            $records = [];
            $unmapped = 0;
            foreach ($entries as $team => $colors) {
                $unitId = SrpInstitutionNormalizer::unitId($unitIds[$team] ?? null);
                if ($unitId === null) {
                    $unmapped++;
                    continue;
                }
                $record = $this->buildRecord($team, $unitId, $colors, $retrievedAt);
                if ($record !== null) {
                    $records[] = $record;
                }
            }

            if ($unmapped > 0) {
                $warnings[] = $unmapped
                    . ' teams had no Wikidata link to an IPEDS institution and were skipped.';
            }

            return SrpInstitutionSourceResult::success(
                $this->name(),
                $records,
                [
                    'started_at' => $startedAt,
                    'finished_at' => $this->http->nowAtom(),
                    'source_url' => self::MODULE_URL,
                    'license' => 'CC BY-SA 4.0 (English Wikipedia)',
                    'module_entries' => count($entries),
                    'resolved_unitids' => count($unitIds),
                    'records' => count($records),
                    'batch_size' => $batchSize,
                    'batches_requested' => $batchesRequested,
                    'batches_completed' => $batchesCompleted,
                ],
                $warnings
            );
        } catch (Throwable $error) {
            $errors[] = [
                'category' => 'source_failure',
                'message' => $error->getMessage(),
            ];
            return new SrpInstitutionSourceResult(
                $this->name(),
                SrpInstitutionSourceResult::STATUS_FAILURE,
                [],
                [
                    'started_at' => $startedAt,
                    'finished_at' => $this->http->nowAtom(),
                    'source_url' => self::MODULE_URL,
                ],
                $errors,
                $warnings
            );
        }
    }

    /**
     * @param array<string, mixed> $context
     */
    private function loadModule(array $context): string
    {
        $file = trim((string)($context['file'] ?? ''));
        if ($file !== '') {
            if (!is_file($file) || !is_readable($file)) {
                throw new InvalidArgumentException("Colour module file is unreadable: {$file}");
            }
            $contents = file_get_contents($file);
            if ($contents === false) {
                throw new RuntimeException("Colour module file could not be read: {$file}");
            }
            return $contents;
        }

        $body = $this->http->get(self::MODULE_URL, [
            'headers' => ['Accept' => 'text/plain'],
        ])->body();
        if (trim($body) === '') {
            throw new RuntimeException('The colour module returned an empty body.');
        }
        return $body;
    }

    /**
     * Extract each primary entry's positional hex values.
     *
     * Alias rows map a string to another key and carry no colours of their own,
     * so the table-valued form is the only one read here.
     *
     * @return array<string, array{hexes: list<string>, cited: bool}>
     */
    private function parseModule(string $raw): array
    {
        $entries = [];
        if (preg_match_all('/^\["([^"]+)"\]\s*=\s*\{([^}]*)\}/m', $raw, $matches, PREG_SET_ORDER) === false) {
            return [];
        }
        foreach ($matches as $match) {
            $team = trim($match[1]);
            $body = $match[2];
            if ($team === '' || !preg_match_all('/"([0-9A-Fa-f]{6})"/', $body, $hexMatches)) {
                continue;
            }
            $entries[$team] = [
                'hexes' => array_values($hexMatches[1]),
                'cited' => str_contains($body, 'cite'),
            ];
        }
        return $entries;
    }

    /**
     * Resolve a batch of team names to IPEDS UNITIDs through Wikidata.
     *
     * @param list<string> $teams
     * @return array<string, string>
     */
    private function resolveUnitIds(array $teams): array
    {
        $values = [];
        foreach ($teams as $team) {
            $escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $team);
            $values[] = '"' . $escaped . '"@en';
        }
        $query = 'SELECT ?title ?unitid WHERE { VALUES ?title { '
            . implode(' ', $values)
            . ' } ?sitelink schema:about ?team ; schema:isPartOf <https://en.wikipedia.org/> ;'
            . ' schema:name ?title . ?team wdt:P1268 ?uni . ?uni wdt:P1771 ?unitid . }';

        $url = self::SPARQL_ENDPOINT . '?' . http_build_query([
            'query' => $query,
            'format' => 'json',
        ]);
        $payload = $this->http->get($url, [
            'headers' => ['Accept' => 'application/sparql-results+json'],
        ])->json();
        if (!is_array($payload)) {
            throw new RuntimeException('Wikidata returned an unreadable response.');
        }

        $resolved = [];
        foreach ($payload['results']['bindings'] ?? [] as $binding) {
            $title = trim((string)($binding['title']['value'] ?? ''));
            $unitId = trim((string)($binding['unitid']['value'] ?? ''));
            if ($title !== '' && $unitId !== '') {
                $resolved[$title] = $unitId;
            }
        }
        return $resolved;
    }

    /**
     * @param array{hexes: list<string>, cited: bool} $colors
     * @return array<string, mixed>|null
     */
    private function buildRecord(
        string $team,
        string $unitId,
        array $colors,
        string $retrievedAt
    ): ?array {
        $primary = SrpInstitutionColor::normalize('#' . ($colors['hexes'][0] ?? ''));
        // The module's second slot is very often plain white, which is a
        // contrast choice rather than a brand colour. Prefer the third slot as
        // the secondary when the second is white.
        $secondCandidate = $colors['hexes'][1] ?? null;
        $thirdCandidate = $colors['hexes'][2] ?? null;
        $second = $secondCandidate !== null
            ? SrpInstitutionColor::normalize('#' . $secondCandidate)
            : null;
        $third = $thirdCandidate !== null
            ? SrpInstitutionColor::normalize('#' . $thirdCandidate)
            : null;
        $secondary = ($second === '#FFFFFF' && $third !== null) ? $third : $second;

        if ($primary === null) {
            return null;
        }

        $metadata = [
            'team_name' => $team,
            'cited_brand_guide' => $colors['cited'],
            'palette' => 'athletics',
        ];

        $fields = [];
        SrpInstitutionSourceSupport::addCandidate(
            $fields,
            'primary_color',
            $primary,
            self::SOURCE_TYPE,
            self::MODULE_URL,
            $unitId,
            $retrievedAt,
            self::CONFIDENCE,
            $metadata
        );
        if ($secondary !== null && $secondary !== $primary) {
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                'secondary_color',
                $secondary,
                self::SOURCE_TYPE,
                self::MODULE_URL,
                $unitId,
                $retrievedAt,
                self::CONFIDENCE,
                $metadata
            );
        }
        if ($fields === []) {
            return null;
        }

        return SrpInstitutionSourceSupport::record(
            $this->name(),
            $unitId,
            $retrievedAt,
            ['ipeds_unitid' => $unitId],
            $fields,
            [
                'team_name' => $team,
                'source_version' => 'wikipedia-college-color',
                'license' => 'CC BY-SA 4.0',
            ]
        );
    }
}
