<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/HttpClient.php';
require_once dirname(__DIR__) . '/SourceInterface.php';
require_once dirname(__DIR__) . '/SourceSupport.php';

/**
 * Disabled-by-default, official-domain-only conservative branding crawler.
 */
final class SrpInstitutionOfficialSiteSource implements SrpInstitutionSourceInterface
{
    /** @var list<string> */
    private const BRAND_TERMS = [
        'brand', 'branding', 'brand-guide', 'brand-standards', 'identity',
        'visual-identity', 'graphic-standards', 'style-guide', 'logo', 'colors',
        'communications', 'marketing', 'media-resources',
    ];

    private SrpInstitutionHttpClient $http;
    /** @var array<string, mixed>|object */
    private $config;
    /** @var callable(string): list<string> */
    private $hostResolver;
    /** @var array<string, bool> */
    private array $hostSafetyCache = [];

    /**
     * @param array<string, mixed>|object $config
     * @param callable(string): list<string>|null $hostResolver
     */
    public function __construct(
        SrpInstitutionHttpClient $http,
        $config = [],
        ?callable $hostResolver = null
    ) {
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('Official-site configuration must be an array or object.');
        }
        $this->http = $http;
        $this->config = $config;
        $this->hostResolver = $hostResolver ?? static function (string $host): array {
            $addresses = [];
            if (function_exists('dns_get_record')) {
                $records = @dns_get_record($host, DNS_A | DNS_AAAA);
                if (is_array($records)) {
                    foreach ($records as $record) {
                        $address = $record['ip'] ?? $record['ipv6'] ?? null;
                        if (is_string($address)) {
                            $addresses[] = $address;
                        }
                    }
                }
            }
            if ($addresses === []) {
                $ipv4 = @gethostbynamel($host);
                if (is_array($ipv4)) {
                    array_push($addresses, ...$ipv4);
                }
            }
            return array_values(array_unique($addresses));
        };
    }

    public function name(): string
    {
        return 'official-site';
    }

    /**
     * @param array<string, mixed> $context
     */
    public function fetch(array $context = []): SrpInstitutionSourceResult
    {
        $startedAt = $this->http->nowAtom();
        $enabled = $this->booleanConfig(
            ['crawler.enabled', 'crawler_enabled', 'INSTITUTION_PIPELINE_CRAWLER_ENABLED'],
            false
        );
        if (!$enabled || (isset($context['enabled']) && !$this->toBool($context['enabled']))) {
            return SrpInstitutionSourceResult::skipped(
                $this->name(),
                'Official-site crawling is disabled. Set INSTITUTION_PIPELINE_CRAWLER_ENABLED=true to enable it.',
                [
                    'started_at' => $startedAt,
                    'finished_at' => $this->http->nowAtom(),
                    'crawler_enabled' => false,
                ]
            );
        }

        try {
            $institutions = $this->institutionsFromContext($context);
            if ($institutions === []) {
                return SrpInstitutionSourceResult::skipped(
                    $this->name(),
                    'No verified official institution domains were supplied to the crawler.',
                    [
                        'started_at' => $startedAt,
                        'finished_at' => $this->http->nowAtom(),
                        'crawler_enabled' => true,
                    ]
                );
            }

            $records = [];
            $errors = [];
            $warnings = [];
            $requests = 0;
            foreach ($institutions as $institution) {
                try {
                    $crawl = $this->crawlInstitution($institution);
                    $requests += $crawl['requests'];
                    $records[] = $crawl['record'];
                    array_push($warnings, ...$crawl['warnings']);
                } catch (Throwable $error) {
                    $errors[] = $error;
                    $warnings[] = 'An official institution site was skipped after a bounded crawl failure.';
                }
            }
            $warnings = array_values(array_unique($warnings));
            $metadata = [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'crawler_enabled' => true,
                'institutions_requested' => count($institutions),
                'institutions_completed' => count($records),
                'requests_made' => $requests,
                'max_requests_per_domain' => $this->integerConfig(
                    ['crawler.max_requests_per_domain', 'max_requests_per_domain'],
                    10,
                    1,
                    100
                ),
                'max_depth' => $this->integerConfig(
                    ['crawler.max_depth', 'crawler_max_depth'],
                    2,
                    0,
                    5
                ),
            ];
            if ($errors !== [] && $records === []) {
                return SrpInstitutionSourceResult::failure($this->name(), $errors[0], $metadata);
            }
            return $errors === []
                ? SrpInstitutionSourceResult::success(
                    $this->name(),
                    $records,
                    $metadata,
                    $warnings
                )
                : SrpInstitutionSourceResult::partial(
                    $this->name(),
                    $records,
                    $errors,
                    $metadata,
                    $warnings
                );
        } catch (Throwable $error) {
            return SrpInstitutionSourceResult::failure($this->name(), $error, [
                'started_at' => $startedAt,
                'finished_at' => $this->http->nowAtom(),
                'crawler_enabled' => true,
            ]);
        }
    }

    /**
     * Deterministic robots rule check exposed for fixture tests.
     */
    public function robotsAllows(
        string $robotsBody,
        string $path,
        ?string $userAgent = null
    ): bool {
        $rules = $this->parseRobots($robotsBody);
        $agent = strtolower($userAgent ?? $this->crawlerProductToken());
        $selected = [];
        foreach ($rules['groups'] as $group) {
            if (in_array($agent, $group['agents'], true)) {
                array_push($selected, ...$group['rules']);
            }
        }
        if ($selected === []) {
            foreach ($rules['groups'] as $group) {
                if (in_array('*', $group['agents'], true)) {
                    array_push($selected, ...$group['rules']);
                }
            }
        }
        $path = '/' . ltrim($path, '/');
        $winner = null;
        foreach ($selected as $rule) {
            if ($rule['pattern'] === '') {
                continue;
            }
            $regex = preg_quote($rule['pattern'], '#');
            $regex = str_replace('\*', '.*', $regex);
            if (str_ends_with($regex, '\$')) {
                $regex = substr($regex, 0, -2) . '$';
            }
            if (preg_match('#^' . $regex . '#', $path) !== 1) {
                continue;
            }
            $length = strlen(str_replace('*', '', $rule['pattern']));
            if ($winner === null
                || $length > $winner['length']
                || ($length === $winner['length'] && $rule['allow'])
            ) {
                $winner = ['allow' => $rule['allow'], 'length' => $length];
            }
        }
        return $winner === null || $winner['allow'];
    }

    /**
     * @param array<string, mixed> $institution
     * @return array{record: array<string, mixed>, requests: int, warnings: list<string>}
     */
    private function crawlInstitution(array $institution): array
    {
        $website = SrpInstitutionSourceSupport::url($institution['official_website'] ?? null);
        $domain = SrpInstitutionSourceSupport::domain($institution['normalized_domain'] ?? $website);
        if ($website === null || $domain === null) {
            throw new InvalidArgumentException('Official crawler input is missing a valid website/domain.');
        }
        if (($institution['verified_domain'] ?? false) !== true) {
            throw new RuntimeException('The institution domain has not been verified.');
        }
        $this->assertAllowedUrl($website, $domain);
        $parts = parse_url($website);
        $origin = strtolower((string)$parts['scheme']) . '://' . strtolower((string)$parts['host']);
        if (isset($parts['port'])) {
            $origin .= ':' . (int)$parts['port'];
        }

        $maxRequests = $this->integerConfig(
            ['crawler.max_requests_per_domain', 'max_requests_per_domain'],
            10,
            1,
            100
        );
        $maxDepth = $this->integerConfig(
            ['crawler.max_depth', 'crawler_max_depth'],
            2,
            0,
            5
        );
        $maxFileBytes = $this->integerConfig(
            ['crawler.max_file_bytes', 'crawler_max_file_bytes'],
            10 * 1024 * 1024,
            1024,
            100 * 1024 * 1024
        );
        $minimumInterval = $this->floatConfig(
            ['crawler.minimum_request_interval', 'crawler_minimum_request_interval'],
            1.0,
            0.1,
            60.0
        );
        $requests = 0;

        // A robots failure is treated conservatively: the institution crawl is
        // skipped rather than assuming permission.
        $robotsUrl = $origin . '/robots.txt';
        $robotsResponse = $this->safeRequest(
            $robotsUrl,
            $domain,
            $requests,
            $maxRequests,
            min($maxFileBytes, 1024 * 1024),
            $minimumInterval
        );
        if (in_array($robotsResponse->statusCode(), [401, 403], true)) {
            throw new RuntimeException('robots.txt or the origin denied crawler access.');
        }
        if ($robotsResponse->statusCode() >= 500) {
            throw new RuntimeException('robots.txt could not be verified because the origin failed.');
        }
        $robotsBody = $robotsResponse->statusCode() === 404 ? '' : $robotsResponse->body();
        $robots = $this->parseRobots($robotsBody);
        $crawlDelay = $this->robotsCrawlDelay($robots);
        if ($crawlDelay !== null) {
            $minimumInterval = max($minimumInterval, min(60.0, $crawlDelay));
        }

        $queue = [];
        $this->enqueue($queue, $website, 0, 'html');
        $this->enqueue($queue, $origin . '/sitemap.xml', 0, 'sitemap');
        foreach ($robots['sitemaps'] as $sitemap) {
            $this->enqueue($queue, $sitemap, 0, 'sitemap');
        }
        $visited = [$robotsUrl => true];
        /** @var array<string, list<array<string, mixed>>> $observations */
        $observations = [];
        $brandDocuments = [];
        $logoCandidates = [];
        $manifestMetadata = [];
        $warnings = [];
        $pagesVisited = 0;

        while ($queue !== [] && $requests < $maxRequests) {
            $job = array_shift($queue);
            $url = (string)$job['url'];
            if (isset($visited[$url]) || (int)$job['depth'] > $maxDepth) {
                continue;
            }
            $visited[$url] = true;
            $urlPath = (string)(parse_url($url, PHP_URL_PATH) ?: '/');
            if (!$this->robotsAllows($robotsBody, $urlPath)) {
                continue;
            }
            try {
                $response = $this->safeRequest(
                    $url,
                    $domain,
                    $requests,
                    $maxRequests,
                    $maxFileBytes,
                    $minimumInterval
                );
            } catch (Throwable $error) {
                $warnings[] = 'A permitted official-site URL failed and was skipped.';
                continue;
            }
            if ($response->statusCode() < 200 || $response->statusCode() >= 300) {
                continue;
            }
            $type = $this->validatedContentType(
                (string)$job['type'],
                $response->header('Content-Type'),
                $response->body(),
                $url
            );
            if ($type === null) {
                $warnings[] = 'An official-site response failed MIME validation and was skipped.';
                continue;
            }
            $pagesVisited++;

            if ($type === 'html') {
                $extracted = $this->extractHtml($response->body(), $response->effectiveUrl(), $domain);
                $this->mergeObservations($observations, $extracted['observations']);
                array_push($brandDocuments, ...$extracted['brand_documents']);
                array_push($logoCandidates, ...$extracted['logo_candidates']);
                foreach ($extracted['links'] as $link) {
                    $depth = (int)$job['depth'] + 1;
                    if ($depth <= $maxDepth) {
                        $this->enqueue($queue, $link['url'], $depth, $link['type']);
                    }
                }
            } elseif ($type === 'sitemap') {
                foreach ($this->extractSitemapLinks($response->body(), $domain) as $link) {
                    $this->enqueue($queue, $link['url'], min($maxDepth, 1), $link['type']);
                }
            } elseif ($type === 'css') {
                $this->mergeObservations(
                    $observations,
                    $this->extractCssColors($response->body(), $response->effectiveUrl())
                );
            } elseif ($type === 'manifest') {
                $manifest = $this->extractManifest($response->body(), $response->effectiveUrl(), $domain);
                array_push($manifestMetadata, ...$manifest['metadata']);
                array_push($logoCandidates, ...$manifest['logo_candidates']);
            } elseif ($type === 'svg') {
                $logoCandidates[] = [
                    'url' => $response->effectiveUrl(),
                    'source_type' => 'official_site_svg',
                    'mime_type' => 'image/svg+xml',
                    'license_status' => 'unknown',
                ];
            } elseif ($type === 'pdf') {
                $brandDocuments[] = [
                    'url' => $response->effectiveUrl(),
                    'mime_type' => 'application/pdf',
                    'sha256' => hash('sha256', $response->body()),
                    'bytes' => strlen($response->body()),
                ];
            }
        }

        $retrievedAt = $this->http->nowAtom();
        $recordId = (string)(
            $institution['ipeds_unitid']
            ?? $institution['match']['ipeds_unitid']
            ?? $domain
        );
        $fields = [];
        // A successful bounded visit confirms the already-verified directory
        // website; it does not independently establish identity.
        SrpInstitutionSourceSupport::addCandidate(
            $fields,
            'official_website',
            $website,
            'official_institution_page',
            $website,
            $recordId,
            $retrievedAt,
            0.95,
            ['verified_domain' => $domain]
        );
        SrpInstitutionSourceSupport::addCandidate(
            $fields,
            'website',
            $website,
            'official_institution_page',
            $website,
            $recordId,
            $retrievedAt,
            0.95,
            ['verified_domain' => $domain]
        );
        SrpInstitutionSourceSupport::addCandidate(
            $fields,
            'normalized_domain',
            $domain,
            'official_institution_page',
            $website,
            $recordId,
            $retrievedAt,
            0.95,
            ['verified_domain' => true]
        );
        foreach ($observations as $field => $candidates) {
            usort($candidates, static fn(array $left, array $right): int =>
                ((float)$right['confidence']) <=> ((float)$left['confidence'])
            );
            $selected = array_shift($candidates);
            $metadata = $selected['metadata'];
            $metadata['alternatives'] = array_slice($candidates, 0, 4);
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                $field,
                $selected['value'],
                $selected['source_type'],
                $selected['source_url'],
                $recordId,
                $retrievedAt,
                (float)$selected['confidence'],
                $metadata
            );
        }
        // Logos found on an official site remain non-selected candidates until
        // copyright/license review; the crawler never downloads/redistributes.
        if ($logoCandidates !== []) {
            $candidate = $logoCandidates[0];
            SrpInstitutionSourceSupport::addCandidate(
                $fields,
                'logo_url',
                $candidate['url'] ?? null,
                (string)($candidate['source_type'] ?? 'official_institution_page'),
                $candidate['page_url'] ?? $website,
                $recordId,
                $retrievedAt,
                0.0,
                array_merge($candidate, [
                    'logo_type' => 'institutional_logo',
                    'logo_license_name' => null,
                    'logo_license_url' => null,
                    'logo_attribution' => null,
                    'license' => ['name' => null, 'url' => null],
                    'license_permits_redistribution' => false,
                    'requires_license_review' => true,
                    'alternatives' => array_slice($logoCandidates, 1, 4),
                ])
            );
        }

        $record = SrpInstitutionSourceSupport::record(
            $this->name(),
            $recordId,
            $retrievedAt,
            [
                'ipeds_unitid' => $institution['match']['ipeds_unitid']
                    ?? $institution['ipeds_unitid']
                    ?? null,
                'ope_id' => $institution['match']['ope_id']
                    ?? $institution['ope_id']
                    ?? null,
                'normalized_domain' => $domain,
                'name' => $institution['match']['name']
                    ?? $institution['name']
                    ?? null,
                'city' => $institution['match']['city']
                    ?? $institution['city']
                    ?? null,
                'state' => $institution['match']['state']
                    ?? $institution['state']
                    ?? null,
            ],
            $fields,
            [
                'robots_checked' => true,
                'robots_url' => $robotsUrl,
                'requests_made' => $requests,
                'pages_visited' => $pagesVisited,
                'crawl_depth_limit' => $maxDepth,
                'request_limit' => $maxRequests,
                'brand_documents' => $this->boundedUniqueUrls($brandDocuments, 10),
                'logo_candidates' => $this->boundedUniqueUrls($logoCandidates, 10),
                'manifest_metadata' => array_slice($manifestMetadata, 0, 10),
            ]
        );
        return [
            'record' => $record,
            'requests' => $requests,
            'warnings' => array_values(array_unique($warnings)),
        ];
    }

    private function safeRequest(
        string $url,
        string $domain,
        int &$requestCount,
        int $requestLimit,
        int $maxBytes,
        float $minimumInterval
    ): SrpInstitutionHttpResponse {
        $redirects = 0;
        $maximumRedirects = $this->integerConfig(
            ['crawler.max_redirects', 'crawler_max_redirects'],
            3,
            0,
            5
        );
        while (true) {
            if ($requestCount >= $requestLimit) {
                throw new RuntimeException('Official-site per-domain request limit reached.');
            }
            $this->assertAllowedUrl($url, $domain);
            $requestCount++;
            $response = $this->http->get($url, [
                'headers' => [
                    'Accept' => 'text/html,application/xhtml+xml,application/xml,text/xml,'
                        . 'text/css,application/manifest+json,application/json,'
                        . 'image/svg+xml,application/pdf;q=0.8',
                ],
                'max_bytes' => $maxBytes,
                'cache' => true,
                'cache_ttl' => $this->integerConfig(
                    ['crawler.cache_ttl', 'crawler_cache_ttl'],
                    7 * 86400,
                    0,
                    30 * 86400
                ),
                'minimum_interval' => $minimumInterval,
                'follow_redirects' => false,
                'throw_http_errors' => false,
                'max_retries' => 1,
            ]);
            if (!in_array($response->statusCode(), [301, 302, 303, 307, 308], true)) {
                return $response;
            }
            $location = $response->header('Location');
            if ($location === null || $redirects >= $maximumRedirects) {
                throw new RuntimeException('Official-site redirect could not be followed safely.');
            }
            $resolved = $this->resolveUrl($url, $location);
            if ($resolved === null) {
                throw new RuntimeException('Official-site redirect URL is invalid.');
            }
            $url = $resolved;
            $redirects++;
        }
    }

    private function assertAllowedUrl(string $url, string $officialDomain): void
    {
        $parts = parse_url($url);
        if (!is_array($parts)
            || !in_array(strtolower((string)($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host'])
            || isset($parts['user'])
            || isset($parts['pass'])
        ) {
            throw new InvalidArgumentException('Crawler URL is not an absolute HTTP(S) URL.');
        }
        $host = strtolower(rtrim((string)$parts['host'], '.'));
        if ($host !== $officialDomain && !str_ends_with($host, '.' . $officialDomain)) {
            throw new RuntimeException('Crawler refused a URL outside the verified official domain.');
        }
        if (isset($parts['port']) && !in_array((int)$parts['port'], [80, 443], true)) {
            throw new RuntimeException('Crawler refused a nonstandard network port.');
        }
        if (!$this->publicHost($host)) {
            throw new RuntimeException('Crawler refused a private, reserved, or unresolved network target.');
        }
    }

    private function publicHost(string $host): bool
    {
        if (isset($this->hostSafetyCache[$host])) {
            return $this->hostSafetyCache[$host];
        }
        if ($host === 'localhost'
            || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.local')
            || filter_var($host, FILTER_VALIDATE_IP) !== false
        ) {
            return $this->hostSafetyCache[$host] = false;
        }
        // An injected HTTP transport cannot reach the network unless its test
        // explicitly chooses to; allow fixture domains without DNS coupling.
        if ($this->http->usesCustomTransport()) {
            return $this->hostSafetyCache[$host] = true;
        }
        $addresses = ($this->hostResolver)($host);
        if (!is_array($addresses) || $addresses === []) {
            return $this->hostSafetyCache[$host] = false;
        }
        foreach ($addresses as $address) {
            if (!is_string($address)
                || filter_var(
                    $address,
                    FILTER_VALIDATE_IP,
                    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
                ) === false
            ) {
                return $this->hostSafetyCache[$host] = false;
            }
        }
        return $this->hostSafetyCache[$host] = true;
    }

    /**
     * @return array{
     *   groups: list<array{agents: list<string>, rules: list<array{allow: bool, pattern: string}>, delay: float|null}>,
     *   sitemaps: list<string>
     * }
     */
    private function parseRobots(string $body): array
    {
        $groups = [];
        $sitemaps = [];
        $current = null;
        $sawDirective = false;
        foreach (preg_split('/\r\n|\r|\n/', $body) ?: [] as $line) {
            $line = preg_replace('/\s+#.*$/', '', trim($line)) ?? trim($line);
            if ($line === '' || !str_contains($line, ':')) {
                continue;
            }
            [$name, $value] = array_map('trim', explode(':', $line, 2));
            $name = strtolower($name);
            if ($name === 'sitemap') {
                if (preg_match('#^https?://#i', $value)) {
                    $sitemaps[] = $value;
                }
                continue;
            }
            if ($name === 'user-agent') {
                if ($current === null || $sawDirective) {
                    if ($current !== null) {
                        $groups[] = $current;
                    }
                    $current = ['agents' => [], 'rules' => [], 'delay' => null];
                    $sawDirective = false;
                }
                $agent = strtolower(trim($value));
                if ($agent !== '') {
                    $current['agents'][] = $agent;
                }
                continue;
            }
            if ($current === null) {
                continue;
            }
            if ($name === 'allow' || $name === 'disallow') {
                $current['rules'][] = [
                    'allow' => $name === 'allow',
                    'pattern' => trim($value),
                ];
                $sawDirective = true;
            } elseif ($name === 'crawl-delay' && is_numeric($value)) {
                $current['delay'] = max(0.0, (float)$value);
                $sawDirective = true;
            }
        }
        if ($current !== null) {
            $groups[] = $current;
        }
        return [
            'groups' => $groups,
            'sitemaps' => array_values(array_unique($sitemaps)),
        ];
    }

    /**
     * @param array{
     *   groups: list<array{agents: list<string>, rules: list<array{allow: bool, pattern: string}>, delay: float|null}>,
     *   sitemaps: list<string>
     * } $robots
     */
    private function robotsCrawlDelay(array $robots): ?float
    {
        $agent = $this->crawlerProductToken();
        $wildcard = null;
        foreach ($robots['groups'] as $group) {
            if (in_array($agent, $group['agents'], true) && $group['delay'] !== null) {
                return (float)$group['delay'];
            }
            if (in_array('*', $group['agents'], true) && $group['delay'] !== null) {
                $wildcard = (float)$group['delay'];
            }
        }
        return $wildcard;
    }

    private function crawlerProductToken(): string
    {
        $agent = strtolower($this->http->userAgent());
        $token = preg_split('/[\s\/(;]+/', $agent)[0] ?? 'studentsphere-institutionpipeline';
        return trim($token) !== '' ? trim($token) : 'studentsphere-institutionpipeline';
    }

    /**
     * @return array{
     *   observations: array<string, list<array<string, mixed>>>,
     *   links: list<array{url: string, type: string}>,
     *   brand_documents: list<array<string, mixed>>,
     *   logo_candidates: list<array<string, mixed>>
     * }
     */
    private function extractHtml(string $html, string $pageUrl, string $domain): array
    {
        if (!class_exists('DOMDocument')) {
            throw new RuntimeException('DOM extension is required for official-site crawling.');
        }
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadHTML(
                '<?xml encoding="UTF-8">' . $html,
                LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_COMPACT
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        if (!$loaded) {
            throw new UnexpectedValueException('Official-site HTML could not be parsed.');
        }
        $xpath = new DOMXPath($document);
        $links = [];
        $brandDocuments = [];
        $logoCandidates = [];
        $observations = $this->extractCssColors($html, $pageUrl);

        foreach ($xpath->query('//a[@href] | //link[@href]') ?: [] as $node) {
            if (!$node instanceof DOMElement) {
                continue;
            }
            $reference = trim($node->getAttribute('href'));
            $url = $this->resolveUrl($pageUrl, $reference);
            if ($url === null
                || !$this->urlOnDomain($url, $domain)
                || preg_match('#^(?:mailto|tel|javascript|data):#i', $reference)
            ) {
                continue;
            }
            $rel = strtolower($node->getAttribute('rel'));
            $type = strtolower($node->getAttribute('type'));
            $text = strtolower(trim($node->textContent . ' ' . $node->getAttribute('title') . ' ' . $url));
            $classification = null;
            if (str_contains($rel, 'manifest') || str_contains($type, 'manifest')) {
                $classification = 'manifest';
            } elseif (str_contains($rel, 'stylesheet') && $this->hasBrandTerm($text . ' style main theme global')) {
                $classification = 'css';
            } elseif (preg_match('/\.css(?:$|\?)/i', $url)) {
                $classification = 'css';
            } elseif (preg_match('/\.svg(?:$|\?)/i', $url) && $this->hasBrandTerm($text)) {
                $classification = 'svg';
                $logoCandidates[] = [
                    'url' => $url,
                    'page_url' => $pageUrl,
                    'source_type' => 'official_site_svg',
                    'license_status' => 'unknown',
                ];
            } elseif (preg_match('/\.pdf(?:$|\?)/i', $url) && $this->hasBrandTerm($text)) {
                $classification = 'pdf';
                $brandDocuments[] = ['url' => $url, 'discovered_on' => $pageUrl];
            } elseif ($this->hasBrandTerm($text)) {
                $classification = 'html';
            }
            if ($classification !== null) {
                $links[] = ['url' => $url, 'type' => $classification];
            }
        }

        foreach ($xpath->query('//meta[@content]') ?: [] as $meta) {
            if (!$meta instanceof DOMElement) {
                continue;
            }
            $name = strtolower(trim(
                $meta->getAttribute('name')
                . ' '
                . $meta->getAttribute('property')
                . ' '
                . $meta->getAttribute('itemprop')
            ));
            $content = trim($meta->getAttribute('content'));
            if ($content === '') {
                continue;
            }
            foreach (['motto', 'slogan', 'tagline'] as $field) {
                if (preg_match('/(?:^|\s)' . $field . '(?:$|\s)/', $name)) {
                    $this->observe(
                        $observations,
                        $field,
                        $content,
                        'official_institution_page',
                        $pageUrl,
                        0.95,
                        ['html_meta_name' => $name]
                    );
                }
            }
            if (str_contains($name, 'logo')) {
                $url = $this->resolveUrl($pageUrl, $content);
                if ($url !== null && $this->urlOnDomain($url, $domain)) {
                    $logoCandidates[] = [
                        'url' => $url,
                        'page_url' => $pageUrl,
                        'source_type' => 'official_institution_page',
                        'license_status' => 'unknown',
                    ];
                }
            }
        }

        foreach (['motto', 'slogan', 'tagline'] as $field) {
            $query = '//*[contains(translate(@class,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"'
                . $field
                . '") or contains(translate(@id,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"'
                . $field
                . '")]';
            foreach ($xpath->query($query) ?: [] as $node) {
                $text = SrpInstitutionSourceSupport::text($node->textContent ?? null, 500);
                if ($text !== null && mb_strlen($text, 'UTF-8') <= 300) {
                    $this->observe(
                        $observations,
                        $field,
                        $text,
                        'official_institution_page',
                        $pageUrl,
                        0.95,
                        ['explicit_html_label' => $field]
                    );
                    break;
                }
            }
        }

        foreach ($xpath->query('//script[@type="application/ld+json"]') ?: [] as $script) {
            $json = trim((string)$script->textContent);
            if ($json === '' || strlen($json) > 2 * 1024 * 1024) {
                continue;
            }
            try {
                $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
            } catch (JsonException $ignored) {
                continue;
            }
            foreach ($this->jsonLdOrganizations($data) as $organization) {
                foreach (['slogan', 'motto'] as $field) {
                    if (isset($organization[$field]) && is_scalar($organization[$field])) {
                        $this->observe(
                            $observations,
                            $field,
                            $organization[$field],
                            'official_institution_page',
                            $pageUrl,
                            0.95,
                            ['json_ld' => true]
                        );
                    }
                }
                $logo = $organization['logo'] ?? null;
                if (is_array($logo)) {
                    $logo = $logo['url'] ?? $logo['contentUrl'] ?? null;
                }
                if (is_scalar($logo)) {
                    $url = $this->resolveUrl($pageUrl, (string)$logo);
                    if ($url !== null && $this->urlOnDomain($url, $domain)) {
                        $logoCandidates[] = [
                            'url' => $url,
                            'page_url' => $pageUrl,
                            'source_type' => 'official_institution_page',
                            'license_status' => 'unknown',
                            'json_ld' => true,
                        ];
                    }
                }
            }
        }
        return [
            'observations' => $observations,
            'links' => $this->uniqueLinks($links),
            'brand_documents' => $brandDocuments,
            'logo_candidates' => $logoCandidates,
        ];
    }

    /**
     * @return list<array{url: string, type: string}>
     */
    private function extractSitemapLinks(string $xml, string $domain): array
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        if (!$loaded) {
            return [];
        }
        $links = [];
        foreach ($document->getElementsByTagName('loc') as $location) {
            $url = trim($location->textContent);
            if (!$this->urlOnDomain($url, $domain)) {
                continue;
            }
            if (preg_match('/sitemap.*\.xml(?:$|\?)/i', $url)) {
                $links[] = ['url' => $url, 'type' => 'sitemap'];
            } elseif ($this->hasBrandTerm(strtolower($url))) {
                $links[] = [
                    'url' => $url,
                    'type' => preg_match('/\.pdf(?:$|\?)/i', $url)
                        ? 'pdf'
                        : (preg_match('/\.svg(?:$|\?)/i', $url) ? 'svg' : 'html'),
                ];
            }
            if (count($links) >= 100) {
                break;
            }
        }
        return $this->uniqueLinks($links);
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function extractCssColors(string $css, string $sourceUrl): array
    {
        $observations = [];
        if (preg_match_all(
            '/--([a-z0-9_-]*(?:primary|secondary|brand|school)[a-z0-9_-]*)\s*:\s*([^;}{]+)/i',
            $css,
            $matches,
            PREG_SET_ORDER
        )) {
            foreach ($matches as $match) {
                $variable = strtolower($match[1]);
                $raw = trim($match[2]);
                $color = $this->normalizeCssColor($raw);
                if ($color === null) {
                    continue;
                }
                $field = str_contains($variable, 'secondary') ? 'secondary_color' : 'primary_color';
                $this->observe(
                    $observations,
                    $field,
                    $color,
                    'official_site_css',
                    $sourceUrl,
                    0.85,
                    [
                        'css_variable' => '--' . $variable,
                        'original_value' => $raw,
                    ]
                );
            }
        }
        return $observations;
    }

    /**
     * @return array{metadata: list<array<string, mixed>>, logo_candidates: list<array<string, mixed>>}
     */
    private function extractManifest(string $json, string $manifestUrl, string $domain): array
    {
        try {
            $manifest = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new UnexpectedValueException('Official web manifest is malformed.', 0, $error);
        }
        if (!is_array($manifest)) {
            return ['metadata' => [], 'logo_candidates' => []];
        }
        $metadata = [[
            'url' => $manifestUrl,
            // Theme colors are retained as low-level metadata only; a web-app
            // theme is not automatically an official institutional color.
            'theme_color' => isset($manifest['theme_color'])
                ? $this->normalizeCssColor((string)$manifest['theme_color'])
                : null,
            'background_color' => isset($manifest['background_color'])
                ? $this->normalizeCssColor((string)$manifest['background_color'])
                : null,
        ]];
        $logos = [];
        foreach (is_array($manifest['icons'] ?? null) ? $manifest['icons'] : [] as $icon) {
            if (!is_array($icon) || !is_scalar($icon['src'] ?? null)) {
                continue;
            }
            $url = $this->resolveUrl($manifestUrl, (string)$icon['src']);
            if ($url !== null && $this->urlOnDomain($url, $domain)) {
                $logos[] = [
                    'url' => $url,
                    'page_url' => $manifestUrl,
                    'source_type' => 'official_institution_page',
                    'manifest_icon' => true,
                    'sizes' => $icon['sizes'] ?? null,
                    'license_status' => 'unknown',
                ];
            }
        }
        return ['metadata' => $metadata, 'logo_candidates' => $logos];
    }

    /**
     * @param mixed $data
     * @return list<array<string, mixed>>
     */
    private function jsonLdOrganizations($data): array
    {
        $results = [];
        if (!is_array($data)) {
            return [];
        }
        $type = $data['@type'] ?? null;
        $types = is_array($type) ? $type : [$type];
        foreach ($types as $candidate) {
            if (is_string($candidate)
                && in_array(strtolower($candidate), [
                    'organization', 'collegeoruniversity', 'educationalorganization',
                ], true)
            ) {
                $results[] = $data;
                break;
            }
        }
        foreach ($data as $value) {
            if (is_array($value)) {
                array_push($results, ...$this->jsonLdOrganizations($value));
            }
        }
        return $results;
    }

    /**
     * @param array<string, list<array<string, mixed>>> $observations
     * @param mixed $value
     * @param array<string, mixed> $metadata
     */
    private function observe(
        array &$observations,
        string $field,
        $value,
        string $sourceType,
        string $sourceUrl,
        float $confidence,
        array $metadata = []
    ): void {
        $normalized = SrpInstitutionSourceSupport::normalizeField($field, $value);
        if ($normalized === null || $normalized === '') {
            return;
        }
        $identity = is_scalar($normalized)
            ? mb_strtolower((string)$normalized, 'UTF-8')
            : hash('sha256', serialize($normalized));
        foreach ($observations[$field] ?? [] as $existing) {
            $existingIdentity = is_scalar($existing['value'])
                ? mb_strtolower((string)$existing['value'], 'UTF-8')
                : hash('sha256', serialize($existing['value']));
            if ($identity === $existingIdentity) {
                return;
            }
        }
        if (count($observations[$field] ?? []) < 10) {
            $observations[$field][] = [
                'value' => $normalized,
                'source_type' => $sourceType,
                'source_url' => $sourceUrl,
                'confidence' => $confidence,
                'metadata' => $metadata,
            ];
        }
    }

    /**
     * @param array<string, list<array<string, mixed>>> $target
     * @param array<string, list<array<string, mixed>>> $incoming
     */
    private function mergeObservations(array &$target, array $incoming): void
    {
        foreach ($incoming as $field => $candidates) {
            foreach ($candidates as $candidate) {
                $this->observe(
                    $target,
                    $field,
                    $candidate['value'] ?? null,
                    (string)($candidate['source_type'] ?? 'official_institution_page'),
                    (string)($candidate['source_url'] ?? ''),
                    (float)($candidate['confidence'] ?? 0.4),
                    is_array($candidate['metadata'] ?? null) ? $candidate['metadata'] : []
                );
            }
        }
    }

    /**
     * @param list<array<string, mixed>> $queue
     */
    private function enqueue(array &$queue, string $url, int $depth, string $type): void
    {
        if (!preg_match('#^https?://#i', $url)) {
            return;
        }
        $url = preg_replace('/#.*$/', '', $url) ?? $url;
        foreach ($queue as $job) {
            if ($job['url'] === $url) {
                return;
            }
        }
        if (count($queue) < 250) {
            $queue[] = ['url' => $url, 'depth' => $depth, 'type' => $type];
        }
    }

    private function validatedContentType(
        string $expected,
        ?string $header,
        string $body,
        string $url
    ): ?string {
        $mime = strtolower(trim(explode(';', (string)$header, 2)[0]));
        $extension = strtolower((string)pathinfo((string)parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        $expected = strtolower($expected);
        return match ($expected) {
            'html' => ($mime === '' || in_array($mime, ['text/html', 'application/xhtml+xml'], true))
                && preg_match('/<(?:!doctype\s+html|html|head|body)\b/i', substr($body, 0, 4096))
                ? 'html'
                : null,
            'sitemap' => ($mime === '' || str_contains($mime, 'xml') || $mime === 'text/plain')
                && preg_match('/<(?:urlset|sitemapindex)\b/i', substr($body, 0, 4096))
                ? 'sitemap'
                : null,
            'css' => ($mime === '' || $mime === 'text/css') && ($extension === 'css' || str_contains($body, '{'))
                ? 'css'
                : null,
            'manifest' => ($mime === '' || str_contains($mime, 'json') || str_contains($mime, 'manifest'))
                && str_starts_with(ltrim($body), '{')
                ? 'manifest'
                : null,
            'svg' => ($mime === '' || $mime === 'image/svg+xml')
                && preg_match('/<svg\b/i', substr($body, 0, 4096))
                ? 'svg'
                : null,
            'pdf' => ($mime === '' || $mime === 'application/pdf') && str_starts_with($body, '%PDF-')
                ? 'pdf'
                : null,
            default => null,
        };
    }

    private function normalizeCssColor(string $value): ?string
    {
        $value = strtolower(trim($value));
        if (preg_match('/^#([0-9a-f]{3})$/i', $value, $matches)) {
            return '#' . strtoupper(
                $matches[1][0] . $matches[1][0]
                . $matches[1][1] . $matches[1][1]
                . $matches[1][2] . $matches[1][2]
            );
        }
        if (preg_match('/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i', $value, $matches)) {
            return '#' . strtoupper($matches[1]);
        }
        if (preg_match(
            '/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/',
            $value,
            $matches
        )) {
            $rgb = [(int)$matches[1], (int)$matches[2], (int)$matches[3]];
            if (max($rgb) > 255) {
                return null;
            }
            if (isset($matches[4]) && $matches[4] !== '') {
                $alpha = str_ends_with($matches[4], '%')
                    ? (float)rtrim($matches[4], '%') / 100
                    : (float)$matches[4];
                if ($alpha < 0.99) {
                    return null;
                }
            }
            return sprintf('#%02X%02X%02X', $rgb[0], $rgb[1], $rgb[2]);
        }
        if (preg_match(
            '/^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,\/]\s*([\d.]+%?))?\s*\)$/',
            $value,
            $matches
        )) {
            if (isset($matches[4]) && $matches[4] !== '') {
                $alpha = str_ends_with($matches[4], '%')
                    ? (float)rtrim($matches[4], '%') / 100
                    : (float)$matches[4];
                if ($alpha < 0.99) {
                    return null;
                }
            }
            return $this->hslToHex((float)$matches[1], (float)$matches[2], (float)$matches[3]);
        }
        $named = [
            'black' => '#000000', 'silver' => '#C0C0C0', 'gray' => '#808080',
            'white' => '#FFFFFF', 'maroon' => '#800000', 'red' => '#FF0000',
            'purple' => '#800080', 'fuchsia' => '#FF00FF', 'green' => '#008000',
            'lime' => '#00FF00', 'olive' => '#808000', 'yellow' => '#FFFF00',
            'navy' => '#000080', 'blue' => '#0000FF', 'teal' => '#008080',
            'aqua' => '#00FFFF', 'orange' => '#FFA500',
        ];
        return $named[$value] ?? null;
    }

    private function hslToHex(float $hue, float $saturation, float $lightness): ?string
    {
        if ($saturation < 0 || $saturation > 100 || $lightness < 0 || $lightness > 100) {
            return null;
        }
        $hue = fmod(($hue % 360 + 360), 360) / 360;
        $saturation /= 100;
        $lightness /= 100;
        if ($saturation === 0.0) {
            $red = $green = $blue = $lightness;
        } else {
            $q = $lightness < 0.5
                ? $lightness * (1 + $saturation)
                : $lightness + $saturation - ($lightness * $saturation);
            $p = 2 * $lightness - $q;
            $red = $this->hueChannel($p, $q, $hue + (1 / 3));
            $green = $this->hueChannel($p, $q, $hue);
            $blue = $this->hueChannel($p, $q, $hue - (1 / 3));
        }
        return sprintf(
            '#%02X%02X%02X',
            (int)round($red * 255),
            (int)round($green * 255),
            (int)round($blue * 255)
        );
    }

    private function hueChannel(float $p, float $q, float $t): float
    {
        if ($t < 0) {
            $t += 1;
        }
        if ($t > 1) {
            $t -= 1;
        }
        if ($t < 1 / 6) {
            return $p + ($q - $p) * 6 * $t;
        }
        if ($t < 1 / 2) {
            return $q;
        }
        if ($t < 2 / 3) {
            return $p + ($q - $p) * (2 / 3 - $t) * 6;
        }
        return $p;
    }

    /**
     * @param array<string, mixed> $context
     * @return list<array<string, mixed>>
     */
    private function institutionsFromContext(array $context): array
    {
        $candidates = is_array($context['universities'] ?? null)
            ? $context['universities']
            : [];
        $previous = $context['previous_results'] ?? [];
        if ($previous instanceof SrpInstitutionSourceResult) {
            $previous = [$previous];
        }
        if (is_array($previous)) {
            foreach ($previous as $result) {
                $records = $result instanceof SrpInstitutionSourceResult
                    ? $result->records()
                    : (is_array($result['records'] ?? null) ? $result['records'] : []);
                array_push($candidates, ...$records);
            }
        }
        if (isset($context['official_website']) || isset($context['website'])) {
            $candidates[] = $context;
        }

        $unitIds = [];
        if (isset($context['unitid'])) {
            $unitId = SrpInstitutionSourceSupport::unitId($context['unitid']);
            if ($unitId !== null) {
                $unitIds[$unitId] = true;
            }
        }
        foreach (is_array($context['unitids'] ?? null) ? $context['unitids'] : [] as $value) {
            $unitId = SrpInstitutionSourceSupport::unitId($value);
            if ($unitId !== null) {
                $unitIds[$unitId] = true;
            }
        }
        $stateFilter = isset($context['state'])
            ? SrpInstitutionSourceSupport::state($context['state'])
            : null;
        $institutions = [];
        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }
            $match = is_array($candidate['match'] ?? null) ? $candidate['match'] : $candidate;
            $website = $candidate['official_website']
                ?? $candidate['website']
                ?? $candidate['fields']['official_website']['value']
                ?? $candidate['fields']['website']['value']
                ?? null;
            $domain = $candidate['normalized_domain']
                ?? $match['normalized_domain']
                ?? $candidate['fields']['normalized_domain']['value']
                ?? SrpInstitutionSourceSupport::domain($website);
            $website = SrpInstitutionSourceSupport::url($website);
            $domain = SrpInstitutionSourceSupport::domain($domain);
            $unitId = SrpInstitutionSourceSupport::unitId(
                $candidate['ipeds_unitid']
                ?? $match['ipeds_unitid']
                ?? $candidate['fields']['ipeds_unitid']['value']
                ?? null
            );
            $state = SrpInstitutionSourceSupport::state(
                $candidate['state'] ?? $match['state'] ?? null
            );
            $verifiedDomain = $this->hasTrustedDomainProvenance($candidate);
            if ($website === null
                || $domain === null
                || ($unitIds !== [] && !isset($unitIds[(string)$unitId]))
                || ($stateFilter !== null && $state !== null && $state !== $stateFilter)
                || !$verifiedDomain
            ) {
                continue;
            }
            $institutions[$unitId ?? $domain] = [
                'official_website' => $website,
                'normalized_domain' => $domain,
                'verified_domain' => true,
                'ipeds_unitid' => $unitId,
                'ope_id' => $candidate['ope_id'] ?? $match['ope_id'] ?? null,
                'name' => $candidate['name']
                    ?? $match['name']
                    ?? $candidate['fields']['official_name']['value']
                    ?? null,
                'city' => $candidate['city'] ?? $match['city'] ?? null,
                'state' => $state,
                'match' => array_merge([
                    'ipeds_unitid' => $unitId,
                    'ope_id' => null,
                    'normalized_domain' => $domain,
                    'name' => null,
                    'city' => null,
                    'state' => $state,
                ], $match),
            ];
        }
        $limit = isset($context['limit']) && is_numeric($context['limit'])
            ? max(1, (int)$context['limit'])
            : null;
        return array_slice(array_values($institutions), 0, $limit ?? count($institutions));
    }

    /**
     * A stored normalized domain alone is not proof of official ownership.
     * Require explicit verification or provenance from a trusted directory /
     * manual source before making any crawler request.
     *
     * @param array<string, mixed> $candidate
     */
    private function hasTrustedDomainProvenance(array $candidate): bool
    {
        if (array_key_exists('verified_domain', $candidate)) {
            return $candidate['verified_domain'] === true;
        }
        $trusted = [
            'manual_verified',
            'official_institution_page',
            'ipeds',
            'college_scorecard',
            'wikidata_referenced',
        ];
        if (in_array((string)($candidate['source'] ?? ''), ['ipeds', 'scorecard'], true)) {
            return true;
        }
        foreach (['website', 'official_website', 'normalized_domain'] as $field) {
            $sourceType = $candidate['fields'][$field]['source_type'] ?? null;
            if (is_string($sourceType) && in_array($sourceType, $trusted, true)) {
                return true;
            }
        }
        $sources = $this->decodeJsonObject($candidate['data_sources_json'] ?? null);
        foreach (['website', 'normalized_domain'] as $field) {
            $sourceType = $sources[$field]['source_type'] ?? null;
            if (is_string($sourceType) && in_array($sourceType, $trusted, true)) {
                return true;
            }
        }
        $verified = $this->decodeJsonObject($candidate['data_verified_json'] ?? null);
        foreach (['website', 'normalized_domain'] as $field) {
            if (($verified[$field]['verified'] ?? false) === true) {
                return true;
            }
        }
        $overrides = $this->decodeJsonObject($candidate['manual_overrides_json'] ?? null);
        return isset($overrides['website']['value']) || isset($overrides['normalized_domain']['value']);
    }

    /**
     * @param mixed $value
     * @return array<string, mixed>
     */
    private function decodeJsonObject($value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        try {
            $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : [];
        } catch (JsonException $ignored) {
            return [];
        }
    }

    private function resolveUrl(string $base, string $reference): ?string
    {
        $reference = html_entity_decode(trim($reference), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if ($reference === '' || preg_match('#^(?:data|javascript|mailto|tel):#i', $reference)) {
            return null;
        }
        if (preg_match('#^https?://#i', $reference)) {
            return SrpInstitutionSourceSupport::url($reference);
        }
        $parts = parse_url($base);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        if (str_starts_with($reference, '//')) {
            return SrpInstitutionSourceSupport::url($parts['scheme'] . ':' . $reference);
        }
        $origin = strtolower((string)$parts['scheme']) . '://' . strtolower((string)$parts['host']);
        if (isset($parts['port'])) {
            $origin .= ':' . (int)$parts['port'];
        }
        if (str_starts_with($reference, '/')) {
            return SrpInstitutionSourceSupport::url($origin . $this->removeDotSegments($reference));
        }
        $directory = rtrim(str_replace('\\', '/', dirname((string)($parts['path'] ?? '/'))), '/');
        return SrpInstitutionSourceSupport::url(
            $origin . $this->removeDotSegments($directory . '/' . $reference)
        );
    }

    private function removeDotSegments(string $path): string
    {
        $query = '';
        if (str_contains($path, '?')) {
            [$path, $queryPart] = explode('?', $path, 2);
            $query = '?' . $queryPart;
        }
        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);
                continue;
            }
            $segments[] = $segment;
        }
        return '/' . implode('/', $segments) . $query;
    }

    private function urlOnDomain(string $url, string $domain): bool
    {
        $host = strtolower((string)parse_url($url, PHP_URL_HOST));
        return $host === $domain || str_ends_with($host, '.' . $domain);
    }

    private function hasBrandTerm(string $value): bool
    {
        $value = strtolower(str_replace(['_', ' '], '-', $value));
        foreach (self::BRAND_TERMS as $term) {
            if (str_contains($value, $term)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param list<array{url: string, type: string}> $links
     * @return list<array{url: string, type: string}>
     */
    private function uniqueLinks(array $links): array
    {
        $result = [];
        $seen = [];
        foreach ($links as $link) {
            $identity = $link['type'] . ':' . $link['url'];
            if (!isset($seen[$identity])) {
                $seen[$identity] = true;
                $result[] = $link;
            }
        }
        return $result;
    }

    /**
     * @param list<array<string, mixed>> $entries
     * @return list<array<string, mixed>>
     */
    private function boundedUniqueUrls(array $entries, int $limit): array
    {
        $result = [];
        $seen = [];
        foreach ($entries as $entry) {
            $url = SrpInstitutionSourceSupport::url($entry['url'] ?? null);
            if ($url === null || isset($seen[$url])) {
                continue;
            }
            $seen[$url] = true;
            $entry['url'] = $url;
            $result[] = $entry;
            if (count($result) >= $limit) {
                break;
            }
        }
        return $result;
    }

    /**
     * @param list<string> $keys
     */
    private function integerConfig(
        array $keys,
        int $default,
        int $minimum,
        int $maximum
    ): int {
        $value = SrpInstitutionSourceSupport::config($this->config, $keys, $default);
        return is_numeric($value) ? max($minimum, min($maximum, (int)$value)) : $default;
    }

    /**
     * @param list<string> $keys
     */
    private function floatConfig(
        array $keys,
        float $default,
        float $minimum,
        float $maximum
    ): float {
        $value = SrpInstitutionSourceSupport::config($this->config, $keys, $default);
        return is_numeric($value) ? max($minimum, min($maximum, (float)$value)) : $default;
    }

    /**
     * @param list<string> $keys
     */
    private function booleanConfig(array $keys, bool $default): bool
    {
        $value = SrpInstitutionSourceSupport::config($this->config, $keys, $default);
        return $this->toBool($value, $default);
    }

    /**
     * @param mixed $value
     */
    private function toBool($value, bool $default = false): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $parsed ?? $default;
    }
}

if (!class_exists('SrpOfficialSiteSource', false)) {
    class_alias(SrpInstitutionOfficialSiteSource::class, 'SrpOfficialSiteSource');
}
