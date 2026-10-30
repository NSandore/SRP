<?php

declare(strict_types=1);

/**
 * Run with: php backend/tests/institution_sources_test.php
 *
 * Every HTTP interaction uses an injected transport. This suite never reaches
 * a live government or Wikidata endpoint.
 */

require_once __DIR__ . '/institution_test_helpers.php';
require_once __DIR__ . '/../includes/institution_data/bootstrap.php';
require_once __DIR__ . '/../includes/institution_data/HttpClient.php';
require_once __DIR__ . '/../includes/institution_data/SourceResult.php';
require_once __DIR__ . '/../includes/institution_data/SourceSupport.php';
require_once __DIR__ . '/../includes/institution_data/Sources/IpedsSource.php';
require_once __DIR__ . '/../includes/institution_data/Sources/ScorecardSource.php';
require_once __DIR__ . '/../includes/institution_data/Sources/WikidataSource.php';

$test = new SrpInstitutionTestHarness();

// HTTP retries use the injected sleeper, so the test has no wall-clock delay.
$retryAttempts = 0;
$retrySleeps = [];
$capturedRetryRequest = null;
$retryClient = new SrpInstitutionHttpClient(
    [
        'request_timeout' => 2,
        'connect_timeout' => 1,
        'max_retries' => 1,
        'retry_initial_delay' => 0.25,
        'retry_max_delay' => 1,
        'minimum_request_interval' => 0,
    ],
    static function (array $request) use (&$retryAttempts, &$capturedRetryRequest): array {
        $retryAttempts++;
        $capturedRetryRequest = $request;
        if ($retryAttempts === 1) {
            return [
                'status' => 503,
                'headers' => ['Retry-After' => '0'],
                'body' => 'temporarily unavailable',
                'effective_url' => $request['url'],
            ];
        }
        return [
            'status' => 200,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => '{"ok":true}',
            'effective_url' => $request['url'],
        ];
    },
    static function (float $seconds) use (&$retrySleeps): void {
        $retrySleeps[] = $seconds;
    },
    null,
    static fn (): float => 1_700_000_000.0
);
$retryResponse = $retryClient->get('https://source.example.test/retry', ['cache' => false]);
$test->same('retry mock succeeds on second attempt', 200, $retryResponse->statusCode());
$test->same('retry response records attempt count', 2, $retryResponse->attempts());
$test->same('retry transport was called twice', 2, $retryAttempts);
$test->same('retry uses injected sleeper once', 1, count($retrySleeps));
$test->same('request timeout reaches transport', 2.0, $capturedRetryRequest['timeout'] ?? null);
$test->same('connect timeout reaches transport', 1.0, $capturedRetryRequest['connect_timeout'] ?? null);

// Timeout failures are categorized and retried without a real wait.
$timeoutAttempts = 0;
$timeoutSleeps = [];
$timeoutClient = new SrpInstitutionHttpClient(
    [
        'max_retries' => 1,
        'retry_initial_delay' => 0.01,
        'minimum_request_interval' => 0,
    ],
    static function (array $_request) use (&$timeoutAttempts): never {
        $timeoutAttempts++;
        throw new RuntimeException('mock transport operation timed out');
    },
    static function (float $seconds) use (&$timeoutSleeps): void {
        $timeoutSleeps[] = $seconds;
    },
    null,
    static fn (): float => 1_700_000_000.0
);
$timeoutError = null;
try {
    $timeoutClient->get('https://source.example.test/timeout', ['cache' => false]);
} catch (SrpInstitutionHttpException $error) {
    $timeoutError = $error;
}
$test->check('timeout mock raises categorized HTTP exception', $timeoutError instanceof SrpInstitutionHttpException);
$test->same('timeout category is retained', 'timeout', $timeoutError?->category());
$test->same('timeout is attempted twice', 2, $timeoutAttempts);
$test->same('timeout retry uses injected sleeper', 1, count($timeoutSleeps));
$test->check(
    'API key is redacted from safe URLs',
    str_contains(
        SrpInstitutionHttpClient::sanitizeUrl(
            'https://api.example.test/data?api_key=secret-value&state=CT'
        ),
        'api_key=[REDACTED]'
    )
);

// SourceResult validates the common adapter envelope.
$retrievedAt = '2026-08-06T00:00:00Z';
$sourceFields = [];
SrpInstitutionSourceSupport::addCandidate(
    $sourceFields,
    'official_name',
    'Envelope University',
    'ipeds',
    'https://nces.ed.gov/example.zip',
    '123456',
    $retrievedAt,
    0.95
);
$envelope = SrpInstitutionSourceSupport::record(
    'ipeds',
    '123456',
    $retrievedAt,
    [
        'ipeds_unitid' => '123456',
        'name' => 'Envelope University',
        'city' => 'Hartford',
        'state' => 'CT',
    ],
    $sourceFields,
    ['reporting_year' => 2025]
);
$sourceResult = SrpInstitutionSourceResult::success(
    'ipeds',
    [$envelope],
    ['source_version' => '2025']
);
$test->same('source result validates and counts envelope', 1, count($sourceResult));
$test->same('source result exposes records', '123456', $sourceResult->records()[0]['source_record_id']);
$test->same('source result is iterable', 1, iterator_count($sourceResult->getIterator()));
$test->same('source result JSON reports record count', 1, $sourceResult->jsonSerialize()['record_count']);
$test->throws(
    'source result rejects an incomplete envelope',
    static fn () => SrpInstitutionSourceResult::success('ipeds', [['source' => 'ipeds']]),
    InvalidArgumentException::class,
    'missing source_record_id'
);

// Local CSV fixture import never invokes the injected HTTP transport.
$unexpectedNetworkCalls = 0;
$fixtureClock = static fn (): float => 1_754_438_400.0; // 2025-08-06T00:00:00Z
$fixtureHttp = new SrpInstitutionHttpClient(
    ['max_retries' => 0, 'minimum_request_interval' => 0],
    static function (array $_request) use (&$unexpectedNetworkCalls): never {
        $unexpectedNetworkCalls++;
        throw new RuntimeException('fixture import attempted a network request');
    },
    static function (float $_seconds): void {
    },
    null,
    $fixtureClock
);
$ipeds = new SrpInstitutionIpedsSource($fixtureHttp);
$ipedsResult = $ipeds->fetch([
    'file' => srp_institution_fixture('HD2025.csv'),
    'year' => 2025,
]);
$test->same('IPEDS fixture import succeeds', SrpInstitutionSourceResult::STATUS_SUCCESS, $ipedsResult->status());
$test->same('IPEDS fixture imports both institutions', 2, count($ipedsResult));
$test->same('IPEDS fixture import performs no network request', 0, $unexpectedNetworkCalls);
$test->same('IPEDS fixture reports its source version', 'HD2025', $ipedsResult->metadata()['source_version'] ?? null);
$test->same(
    'tiny IPEDS fixture is not a complete snapshot by default',
    false,
    $ipedsResult->metadata()['complete_snapshot'] ?? null
);
$firstIpeds = $ipedsResult->records()[0] ?? [];
$test->same('IPEDS UNITID is mapped', '100751', $firstIpeds['match']['ipeds_unitid']);
$test->same('IPEDS official domain is normalized', 'ua.edu', $firstIpeds['match']['normalized_domain']);
$test->same('IPEDS official name candidate is present', 'The University of Alabama', $firstIpeds['fields']['official_name']['value']);
$test->same('IPEDS HBCU code is mapped to boolean', true, $firstIpeds['fields']['is_hbcu']['value']);
$test->same('IPEDS reporting year is retained', 2025, $firstIpeds['fields']['source_reporting_year']['value']);
$test->check(
    'IPEDS record retains metadata rather than a raw source row',
    is_array($firstIpeds['raw_metadata'] ?? null)
        && !array_key_exists('raw_row', $firstIpeds['raw_metadata'])
);

$completeFixtureIpeds = new SrpInstitutionIpedsSource(
    $fixtureHttp,
    ['ipeds' => ['minimum_complete_snapshot_rows' => 2]]
);
$completeFixtureResult = $completeFixtureIpeds->fetch([
    'file' => srp_institution_fixture('HD2025.csv'),
    'year' => 2025,
]);
$test->same(
    'explicit fixture-sized safety threshold permits complete snapshot',
    true,
    $completeFixtureResult->metadata()['complete_snapshot'] ?? null
);

$filteredIpeds = $ipeds->fetch([
    'file' => srp_institution_fixture('HD2025.csv'),
    'year' => 2025,
    'state' => 'CT',
]);
$test->same('IPEDS state filter is deterministic', 1, count($filteredIpeds));
$test->same('filtered IPEDS fixture is not a complete snapshot', false, $filteredIpeds->metadata()['complete_snapshot'] ?? null);
$test->same(
    'IPEDS state filter selects Connecticut',
    'CT',
    $filteredIpeds->records()[0]['match']['state'] ?? null
);

$unitIdsIpeds = $ipeds->fetch([
    'file' => srp_institution_fixture('HD2025.csv'),
    'year' => 2025,
    'unitids' => ['130794'],
]);
$test->same('IPEDS UNITID-list filter selects one fixture row', 1, count($unitIdsIpeds));
$test->same(
    'IPEDS UNITID-list filter selects the requested row',
    '130794',
    $unitIdsIpeds->records()[0]['match']['ipeds_unitid'] ?? null
);

$strictIpeds = new SrpInstitutionIpedsSource(
    $fixtureHttp,
    ['ipeds' => ['max_malformed_rows' => 0]]
);
$malformedResult = $strictIpeds->fetch([
    'file' => srp_institution_fixture('HD2025_malformed.csv'),
    'year' => 2025,
]);
$test->same('malformed IPEDS fixture fails closed', SrpInstitutionSourceResult::STATUS_FAILURE, $malformedResult->status());
$test->check(
    'malformed IPEDS error is descriptive',
    str_contains(strtolower((string)($malformedResult->errors()[0]['message'] ?? '')), 'malformed')
);

$missingColumnsResult = $ipeds->fetch([
    'file' => srp_institution_fixture('HD2025_missing_columns.csv'),
    'year' => 2025,
]);
$test->same('IPEDS fixture missing required columns fails', SrpInstitutionSourceResult::STATUS_FAILURE, $missingColumnsResult->status());
$test->check(
    'missing-column error identifies required mapping',
    str_contains(
        strtolower((string)($missingColumnsResult->errors()[0]['message'] ?? '')),
        'missing required column mapping state'
    )
);

// College Scorecard uses a fully mocked JSON response.
$scorecardCalls = 0;
$scorecardUrl = '';
$scorecardBody = file_get_contents(srp_institution_fixture('scorecard_page.json'));
if (!is_string($scorecardBody)) {
    throw new RuntimeException('Unable to read Scorecard fixture.');
}
$scorecardHttp = new SrpInstitutionHttpClient(
    ['max_retries' => 0, 'minimum_request_interval' => 0],
    static function (array $request) use (&$scorecardCalls, &$scorecardUrl, $scorecardBody): array {
        $scorecardCalls++;
        $scorecardUrl = (string)$request['url'];
        return [
            'status' => 200,
            'headers' => ['Content-Type' => 'application/json'],
            'body' => $scorecardBody,
            'effective_url' => $request['url'],
        ];
    },
    static function (float $_seconds): void {
    },
    null,
    $fixtureClock
);
$scorecard = new SrpInstitutionScorecardSource(
    $scorecardHttp,
    ['scorecard' => ['per_page' => 100, 'max_pages' => 2]]
);
$scorecardResult = $scorecard->fetch(['api_key' => 'fixture-secret', 'limit' => 1]);
$test->same('mocked Scorecard fetch succeeds', SrpInstitutionSourceResult::STATUS_SUCCESS, $scorecardResult->status());
$test->same('mocked Scorecard returns one institution', 1, count($scorecardResult));
$test->same('mocked Scorecard makes one page request', 1, $scorecardCalls);
$scorecardRecord = $scorecardResult->records()[0] ?? [];
$test->same('Scorecard UNITID is normalized', '130794', $scorecardRecord['match']['ipeds_unitid']);
$test->same('Scorecard official website is normalized', 'https://yale.edu', $scorecardRecord['fields']['website']['value']);
$test->same('Scorecard ownership is mapped', 'private_nonprofit', $scorecardRecord['fields']['institution_control']['value']);
$test->check('Scorecard request includes the supplied API key', str_contains($scorecardUrl, 'api_key=fixture-secret'));
$test->check(
    'Scorecard safe URL does not expose API key',
    !str_contains(SrpInstitutionHttpClient::sanitizeUrl($scorecardUrl), 'fixture-secret')
);

$skippedCalls = 0;
$skippedHttp = new SrpInstitutionHttpClient(
    static function (array $_request) use (&$skippedCalls): never {
        $skippedCalls++;
        throw new RuntimeException('skipped source should not call transport');
    }
);
$skippedScorecard = new SrpInstitutionScorecardSource(
    $skippedHttp,
    ['data_gov_api_key' => '']
);
$skippedResult = $skippedScorecard->fetch(['api_key' => '']);
$test->same('Scorecard without API key is skipped', SrpInstitutionSourceResult::STATUS_SKIPPED, $skippedResult->status());
$test->same('skipped Scorecard makes no HTTP request', 0, $skippedCalls);

// Targeted Wikidata runs must not widen an explicit UNITID scope with the
// repository-wide institutions supplied for normal scheduled enrichment.
$wikidataQuery = '';
$wikidataHttp = new SrpInstitutionHttpClient(
    ['max_retries' => 0, 'minimum_request_interval' => 0],
    static function (array $request) use (&$wikidataQuery): array {
        parse_str((string)($request['body'] ?? ''), $form);
        $wikidataQuery = (string)($form['query'] ?? '');
        return [
            'status' => 200,
            'headers' => ['Content-Type' => 'application/sparql-results+json'],
            'body' => '{"head":{"vars":[]},"results":{"bindings":[]}}',
            'effective_url' => $request['url'],
        ];
    },
    static function (float $_seconds): void {
    },
    null,
    $fixtureClock
);
$wikidata = new SrpInstitutionWikidataSource(
    $wikidataHttp,
    ['wikidata' => ['minimum_request_interval' => 0]]
);
$targetedWikidata = $wikidata->fetch([
    'unitids' => ['130794'],
    'universities' => [
        ['ipeds_unitid' => '100751', 'state' => 'AL'],
        ['ipeds_unitid' => '130794', 'state' => 'CT'],
    ],
]);
$test->same(
    'targeted Wikidata run queries exactly one explicit UNITID',
    1,
    $targetedWikidata->metadata()['queried_unitids'] ?? null
);
$test->check(
    'targeted Wikidata query includes the requested UNITID',
    str_contains($wikidataQuery, '"130794"')
);
$test->check(
    'targeted Wikidata query excludes ambient repository UNITIDs',
    !str_contains($wikidataQuery, '"100751"')
);

$test->finish('Institution source tests');
