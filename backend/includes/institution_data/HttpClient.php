<?php

declare(strict_types=1);

/**
 * A bounded response value used by the institution-data HTTP client.
 */
final class SrpInstitutionHttpResponse
{
    private int $statusCode;
    /** @var array<string, list<string>> */
    private array $headers;
    private string $body;
    private string $effectiveUrl;
    private int $attempts;
    private bool $fromCache;

    /**
     * @param array<string, string|list<string>> $headers
     */
    public function __construct(
        int $statusCode,
        array $headers,
        string $body,
        string $effectiveUrl,
        int $attempts = 1,
        bool $fromCache = false
    ) {
        if ($statusCode < 0 || $statusCode > 599) {
            throw new InvalidArgumentException('Invalid HTTP status code.');
        }
        $this->statusCode = $statusCode;
        $this->headers = self::normalizeHeaders($headers);
        $this->body = $body;
        $this->effectiveUrl = $effectiveUrl;
        $this->attempts = max(1, $attempts);
        $this->fromCache = $fromCache;
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * @return array<string, list<string>>
     */
    public function headers(): array
    {
        return $this->headers;
    }

    public function header(string $name): ?string
    {
        $values = $this->headers[strtolower($name)] ?? [];
        return $values ? implode(', ', $values) : null;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function effectiveUrl(): string
    {
        return $this->effectiveUrl;
    }

    public function attempts(): int
    {
        return $this->attempts;
    }

    public function fromCache(): bool
    {
        return $this->fromCache;
    }

    /**
     * @return array<string, mixed>|list<mixed>
     */
    public function json(int $depth = 128): array
    {
        try {
            $decoded = json_decode($this->body, true, $depth, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new UnexpectedValueException(
                'The remote service returned malformed JSON: ' . $error->getMessage(),
                0,
                $error
            );
        }
        if (!is_array($decoded)) {
            throw new UnexpectedValueException('The remote JSON response must be an object or array.');
        }
        return $decoded;
    }

    /**
     * @param array<string, string|list<string>> $headers
     * @return array<string, list<string>>
     */
    private static function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $name => $values) {
            if (is_int($name)) {
                if (!is_string($values) || strpos($values, ':') === false) {
                    continue;
                }
                [$name, $values] = explode(':', $values, 2);
            }
            $key = strtolower(trim((string)$name));
            if ($key === '') {
                continue;
            }
            $list = is_array($values) ? $values : [$values];
            foreach ($list as $value) {
                if (is_scalar($value)) {
                    $normalized[$key][] = trim((string)$value);
                }
            }
        }
        return $normalized;
    }
}

/**
 * Categorized request failure. URLs stored here are already credential-safe.
 */
final class SrpInstitutionHttpException extends RuntimeException
{
    private string $category;
    private string $requestUrl;
    private ?int $httpStatus;
    private int $attempts;
    /** @var array<string, scalar|null> */
    private array $details;

    /**
     * @param array<string, scalar|null> $details
     */
    public function __construct(
        string $category,
        string $message,
        string $requestUrl,
        ?int $httpStatus = null,
        int $attempts = 1,
        array $details = [],
        ?Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
        $this->category = $category;
        $this->requestUrl = $requestUrl;
        $this->httpStatus = $httpStatus;
        $this->attempts = max(1, $attempts);
        $this->details = $details;
    }

    public function category(): string
    {
        return $this->category;
    }

    public function requestUrl(): string
    {
        return $this->requestUrl;
    }

    public function httpStatus(): ?int
    {
        return $this->httpStatus;
    }

    public function attempts(): int
    {
        return $this->attempts;
    }

    /**
     * @return array<string, scalar|null>
     */
    public function details(): array
    {
        return $this->details;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'category' => $this->category,
            'message' => $this->getMessage(),
            'url' => $this->requestUrl,
            'http_status' => $this->httpStatus,
            'attempts' => $this->attempts,
            'details' => $this->details,
        ];
    }
}

/**
 * Production HTTP client for free institution sources.
 *
 * The transport, sleeper, clock, and logger are injectable so tests never
 * need a live endpoint or real delays. A custom transport receives one array:
 *
 *   [
 *     'method' => 'GET',
 *     'url' => 'https://example.test/resource',
 *     'headers' => ['Accept' => 'application/json'],
 *     'body' => null,
 *     'timeout' => 30.0,
 *     'connect_timeout' => 10.0,
 *     'max_bytes' => 52428800,
 *     'follow_redirects' => true,
 *     'max_redirects' => 5,
 *   ]
 *
 * It may return SrpInstitutionHttpResponse, an associative response array, or
 * a PSR-7-like object. The sleeper is called with seconds as a float.
 */
final class SrpInstitutionHttpClient
{
    /** @var callable(array<string, mixed>): mixed */
    private $transport;
    /** @var callable(float): void */
    private $sleeper;
    /** @var callable(): float */
    private $clock;
    /** @var callable|null */
    private $logger;
    /** @var array<string, mixed>|object */
    private $config;
    private bool $customTransport;
    private float $defaultTimeout;
    private float $connectTimeout;
    private int $defaultMaxRetries;
    private float $initialBackoff;
    private float $maximumBackoff;
    private float $minimumInterval;
    private int $defaultMaxBytes;
    private string $userAgent;
    private ?string $cachePath;
    private int $defaultCacheTtl;
    /** @var array<string, float> */
    private array $lastRequestAt = [];

    /**
     * @param array<string, mixed>|object|callable $config
     */
    public function __construct(
        $config = [],
        ?callable $transport = null,
        ?callable $sleeper = null,
        ?callable $logger = null,
        ?callable $clock = null
    ) {
        // A transport-only constructor is convenient in small mocked tests.
        if (is_callable($config)
            && !is_array($config)
            && !(is_object($config) && method_exists($config, 'get'))
        ) {
            $transport = $config;
            $config = [];
        }
        if (!is_array($config) && !is_object($config)) {
            throw new InvalidArgumentException('HTTP client configuration must be an array or object.');
        }
        $this->config = $config;
        $this->customTransport = $transport !== null;
        $this->transport = $transport ?? function (array $request): array {
            return $this->curlTransport($request);
        };
        $this->sleeper = $sleeper ?? static function (float $seconds): void {
            if ($seconds > 0) {
                usleep((int)min(PHP_INT_MAX, round($seconds * 1000000)));
            }
        };
        $this->logger = $logger;
        $this->clock = $clock ?? static fn(): float => microtime(true);

        $this->defaultTimeout = $this->positiveFloat(
            $this->value(
                ['request_timeout', 'http.request_timeout', 'INSTITUTION_PIPELINE_REQUEST_TIMEOUT'],
                getenv('INSTITUTION_PIPELINE_REQUEST_TIMEOUT') ?: 30
            ),
            30.0
        );
        $this->connectTimeout = $this->positiveFloat(
            $this->value(['connect_timeout', 'http.connect_timeout'], min(10.0, $this->defaultTimeout)),
            min(10.0, $this->defaultTimeout)
        );
        $this->defaultMaxRetries = $this->boundedInt(
            $this->value(
                ['max_retries', 'http.max_retries', 'INSTITUTION_PIPELINE_MAX_RETRIES'],
                getenv('INSTITUTION_PIPELINE_MAX_RETRIES') !== false
                    ? getenv('INSTITUTION_PIPELINE_MAX_RETRIES')
                    : 3
            ),
            0,
            10,
            3
        );
        $this->initialBackoff = $this->positiveFloat(
            $this->value(['retry_initial_delay', 'http.retry_initial_delay'], 0.5),
            0.5
        );
        $this->maximumBackoff = $this->positiveFloat(
            $this->value(['retry_max_delay', 'http.retry_max_delay'], 30.0),
            30.0
        );
        $this->minimumInterval = max(
            0.0,
            (float)$this->value(['minimum_request_interval', 'http.minimum_request_interval'], 0.1)
        );
        $this->defaultMaxBytes = $this->boundedInt(
            $this->value(['max_response_bytes', 'http.max_response_bytes'], 50 * 1024 * 1024),
            1024,
            1024 * 1024 * 1024,
            50 * 1024 * 1024
        );

        $contact = trim((string)$this->value(
            ['contact_email', 'INSTITUTION_PIPELINE_CONTACT_EMAIL'],
            getenv('INSTITUTION_PIPELINE_CONTACT_EMAIL') ?: ''
        ));
        $configuredAgent = trim((string)$this->value(
            ['user_agent', 'INSTITUTION_PIPELINE_USER_AGENT'],
            getenv('INSTITUTION_PIPELINE_USER_AGENT') ?: ''
        ));
        $this->userAgent = $configuredAgent !== ''
            ? $configuredAgent
            : 'StudentSphere-InstitutionPipeline/1.0'
                . ($contact !== '' ? " (contact: {$contact})" : ' (institution-data refresh)');

        $cache = $this->value(
            ['cache_path', 'http.cache_path', 'INSTITUTION_PIPELINE_CACHE_PATH'],
            getenv('INSTITUTION_PIPELINE_CACHE_PATH') ?: null
        );
        $this->cachePath = is_string($cache) && trim($cache) !== ''
            ? rtrim(trim($cache), DIRECTORY_SEPARATOR)
            : null;
        $this->defaultCacheTtl = $this->boundedInt(
            $this->value(['cache_ttl', 'http.cache_ttl'], 86400),
            0,
            365 * 86400,
            86400
        );
    }

    /**
     * @param array<string, mixed> $options
     */
    public function get(string $url, array $options = []): SrpInstitutionHttpResponse
    {
        return $this->request('GET', $url, $options);
    }

    /**
     * @param array<string, mixed> $options
     */
    public function head(string $url, array $options = []): SrpInstitutionHttpResponse
    {
        $options['cache'] = $options['cache'] ?? false;
        return $this->request('HEAD', $url, $options);
    }

    /**
     * @param array<string, mixed> $options
     * @return array<string, mixed>|list<mixed>
     */
    public function getJson(string $url, array $options = []): array
    {
        $headers = is_array($options['headers'] ?? null) ? $options['headers'] : [];
        $headers['Accept'] = $headers['Accept'] ?? 'application/json';
        $options['headers'] = $headers;
        return $this->get($url, $options)->json((int)($options['json_depth'] ?? 128));
    }

    /**
     * @param array<string, mixed> $options
     */
    public function request(
        string $method,
        string $url,
        array $options = []
    ): SrpInstitutionHttpResponse {
        $method = strtoupper(trim($method));
        if (!preg_match('/^[A-Z]+$/', $method)) {
            throw new InvalidArgumentException('Invalid HTTP method.');
        }
        $this->validateUrl($url);

        $headers = $this->normalizeRequestHeaders(
            is_array($options['headers'] ?? null) ? $options['headers'] : []
        );
        if (!$this->hasHeader($headers, 'User-Agent')) {
            $headers['User-Agent'] = $this->userAgent;
        }
        if (!$this->hasHeader($headers, 'Accept')) {
            $headers['Accept'] = 'application/json, text/csv;q=0.9, application/zip;q=0.9, */*;q=0.5';
        }

        $timeout = $this->positiveFloat($options['timeout'] ?? $this->defaultTimeout, $this->defaultTimeout);
        $connectTimeout = $this->positiveFloat(
            $options['connect_timeout'] ?? min($this->connectTimeout, $timeout),
            min($this->connectTimeout, $timeout)
        );
        $maxBytes = $this->boundedInt(
            $options['max_bytes'] ?? $this->defaultMaxBytes,
            1,
            1024 * 1024 * 1024,
            $this->defaultMaxBytes
        );
        $maxRetries = $this->boundedInt(
            $options['max_retries'] ?? $this->defaultMaxRetries,
            0,
            10,
            $this->defaultMaxRetries
        );
        $cacheTtl = $this->boundedInt(
            $options['cache_ttl'] ?? $this->defaultCacheTtl,
            0,
            365 * 86400,
            $this->defaultCacheTtl
        );
        $cacheEnabled = (bool)($options['cache'] ?? ($method === 'GET'))
            && $cacheTtl > 0
            && $this->cachePath !== null;
        $body = isset($options['body']) ? (string)$options['body'] : null;
        $cacheKey = $this->cacheKey($method, $url, $headers, $body, $options);
        if ($cacheEnabled) {
            $cached = $this->readCache($cacheKey, $maxBytes);
            if ($cached !== null) {
                $this->log('debug', 'institution_http_cache_hit', [
                    'method' => $method,
                    'url' => self::sanitizeUrl($url),
                    'status' => $cached->statusCode(),
                ]);
                return $cached;
            }
        }

        $request = [
            'method' => $method,
            'url' => $url,
            'headers' => $headers,
            'body' => $body,
            'timeout' => $timeout,
            'connect_timeout' => $connectTimeout,
            'max_bytes' => $maxBytes,
            'follow_redirects' => (bool)($options['follow_redirects'] ?? true),
            'max_redirects' => $this->boundedInt($options['max_redirects'] ?? 5, 0, 20, 5),
        ];
        $safeUrl = self::sanitizeUrl($url);
        $throwHttpErrors = (bool)($options['throw_http_errors'] ?? true);
        $retryStatuses = array_map(
            'intval',
            is_array($options['retry_statuses'] ?? null)
                ? $options['retry_statuses']
                : [408, 425, 429, 500, 502, 503, 504]
        );
        $minimumInterval = max(
            0.0,
            (float)($options['minimum_interval'] ?? $this->minimumInterval)
        );
        $attempts = $maxRetries + 1;
        $lastError = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $this->respectRateLimit($url, $minimumInterval);
            $startedAt = ($this->clock)();
            try {
                $raw = ($this->transport)($request);
                $response = $this->coerceResponse($raw, $url, $attempt);
                if (strlen($response->body()) > $maxBytes) {
                    throw new SrpInstitutionHttpException(
                        'response_too_large',
                        "Remote response exceeded the {$maxBytes}-byte limit.",
                        $safeUrl,
                        $response->statusCode(),
                        $attempt
                    );
                }
                $status = $response->statusCode();
                $successful = $status >= 200 && $status < 300;
                $retryable = in_array($status, $retryStatuses, true);
                if ($successful || (!$throwHttpErrors && !$retryable)) {
                    $durationMs = (int)round(max(0.0, (($this->clock)() - $startedAt) * 1000));
                    $this->log('info', 'institution_http_response', [
                        'method' => $method,
                        'url' => $safeUrl,
                        'status' => $status,
                        'attempt' => $attempt,
                        'duration_ms' => $durationMs,
                        'bytes' => strlen($response->body()),
                    ]);
                    if ($cacheEnabled && $successful) {
                        $this->writeCache($cacheKey, $response, $cacheTtl);
                    }
                    return $response;
                }

                $category = $status === 429
                    ? 'rate_limited'
                    : ($retryable ? 'http_error' : 'http_non_retryable');
                $lastError = new SrpInstitutionHttpException(
                    $category,
                    "Remote service returned HTTP {$status}.",
                    $safeUrl,
                    $status,
                    $attempt
                );
                if (!$retryable || $attempt >= $attempts) {
                    if (!$throwHttpErrors) {
                        return $response;
                    }
                    throw $lastError;
                }
                $delay = $this->retryDelay($attempt, $response->header('Retry-After'));
            } catch (SrpInstitutionHttpException $error) {
                $lastError = $error;
                if (!$this->retryableCategory($error->category()) || $attempt >= $attempts) {
                    $this->log('error', 'institution_http_failure', [
                        'method' => $method,
                        'url' => $safeUrl,
                        'category' => $error->category(),
                        'status' => $error->httpStatus(),
                        'attempts' => $attempt,
                        'message' => $error->getMessage(),
                    ]);
                    throw new SrpInstitutionHttpException(
                        $error->category(),
                        $error->getMessage(),
                        $safeUrl,
                        $error->httpStatus(),
                        $attempt,
                        $error->details(),
                        $error
                    );
                }
                $delay = $this->retryDelay($attempt, null);
            } catch (Throwable $error) {
                $category = $this->categorizeThrowable($error);
                $lastError = new SrpInstitutionHttpException(
                    $category,
                    $this->safeTransportMessage($category, $error),
                    $safeUrl,
                    null,
                    $attempt,
                    [],
                    $error
                );
                if (!$this->retryableCategory($category) || $attempt >= $attempts) {
                    $this->log('error', 'institution_http_failure', [
                        'method' => $method,
                        'url' => $safeUrl,
                        'category' => $category,
                        'status' => null,
                        'attempts' => $attempt,
                        'message' => $lastError->getMessage(),
                    ]);
                    throw $lastError;
                }
                $delay = $this->retryDelay($attempt, null);
            }

            $this->log('warning', 'institution_http_retry', [
                'method' => $method,
                'url' => $safeUrl,
                'category' => $lastError instanceof SrpInstitutionHttpException
                    ? $lastError->category()
                    : 'unknown',
                'status' => $lastError instanceof SrpInstitutionHttpException
                    ? $lastError->httpStatus()
                    : null,
                'attempt' => $attempt,
                'next_attempt' => $attempt + 1,
                'delay_seconds' => $delay,
            ]);
            ($this->sleeper)($delay);
        }

        throw $lastError ?? new SrpInstitutionHttpException(
            'unknown',
            'The remote request failed.',
            $safeUrl,
            null,
            $attempts
        );
    }

    /**
     * Atomically writes a successful response body to a caller-selected path.
     *
     * @param array<string, mixed> $options
     */
    public function download(
        string $url,
        string $destination,
        array $options = []
    ): SrpInstitutionHttpResponse {
        if ($destination === '' || str_contains($destination, "\0")) {
            throw new InvalidArgumentException('Invalid download destination.');
        }
        $directory = dirname($destination);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create the download directory.');
        }
        $response = $this->get($url, $options);
        $temporary = $destination . '.part-' . bin2hex(random_bytes(6));
        if (file_put_contents($temporary, $response->body(), LOCK_EX) === false) {
            throw new RuntimeException('Unable to write the downloaded source file.');
        }
        @chmod($temporary, 0660);
        if (!rename($temporary, $destination)) {
            @unlink($temporary);
            throw new RuntimeException('Unable to publish the downloaded source file.');
        }
        return $response;
    }

    public function now(): float
    {
        return (float)($this->clock)();
    }

    public function nowAtom(): string
    {
        $seconds = (int)floor($this->now());
        return gmdate(DATE_ATOM, $seconds);
    }

    public function usesCustomTransport(): bool
    {
        return $this->customTransport;
    }

    public function userAgent(): string
    {
        return $this->userAgent;
    }

    /**
     * Removes credentials from query strings before logging or reporting.
     */
    public static function sanitizeUrl(string $url): string
    {
        $parts = parse_url($url);
        if ($parts === false) {
            return '[invalid-url]';
        }
        $scheme = isset($parts['scheme']) ? strtolower((string)$parts['scheme']) . '://' : '';
        $host = isset($parts['host']) ? strtolower((string)$parts['host']) : '';
        $port = isset($parts['port']) ? ':' . (int)$parts['port'] : '';
        $path = (string)($parts['path'] ?? '');
        $query = '';
        if (isset($parts['query']) && $parts['query'] !== '') {
            $pairs = [];
            foreach (explode('&', (string)$parts['query']) as $pair) {
                [$rawName, $rawValue] = array_pad(explode('=', $pair, 2), 2, '');
                $name = strtolower(rawurldecode($rawName));
                $sensitive = preg_match(
                    '/(?:^|[_-])(api[_-]?key|key|token|secret|password|signature|credential|auth)(?:$|[_-])/i',
                    $name
                ) === 1;
                $pairs[] = $rawName . ($rawValue !== '' ? '=' . ($sensitive ? '[REDACTED]' : $rawValue) : '');
            }
            $query = '?' . implode('&', $pairs);
        }
        return $scheme . $host . $port . $path . $query;
    }

    /**
     * @param array<string, mixed> $request
     * @return array{status: int, headers: array<string, list<string>>, body: string, effective_url: string}
     */
    private function curlTransport(array $request): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('The cURL extension is required for institution source requests.');
        }
        $handle = curl_init();
        if ($handle === false) {
            throw new RuntimeException('Unable to initialize cURL.');
        }

        $responseHeaders = [];
        $body = '';
        $tooLarge = false;
        $maxBytes = (int)$request['max_bytes'];
        $method = (string)$request['method'];
        $headerLines = [];
        foreach ((array)$request['headers'] as $name => $value) {
            $headerLines[] = trim((string)$name) . ': ' . trim((string)$value);
        }

        $options = [
            CURLOPT_URL => (string)$request['url'],
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => (bool)$request['follow_redirects'],
            CURLOPT_MAXREDIRS => (int)$request['max_redirects'],
            CURLOPT_CONNECTTIMEOUT_MS => max(1, (int)round((float)$request['connect_timeout'] * 1000)),
            CURLOPT_TIMEOUT_MS => max(1, (int)round((float)$request['timeout'] * 1000)),
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_ENCODING => '',
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
                $length = strlen($line);
                $trimmed = trim($line);
                if (str_starts_with(strtoupper($trimmed), 'HTTP/')) {
                    $responseHeaders = [];
                    return $length;
                }
                if ($trimmed !== '' && strpos($line, ':') !== false) {
                    [$name, $value] = explode(':', $line, 2);
                    $responseHeaders[strtolower(trim($name))][] = trim($value);
                }
                return $length;
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body, &$tooLarge, $maxBytes): int {
                if (strlen($body) + strlen($chunk) > $maxBytes) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ];
        if ($method === 'HEAD') {
            $options[CURLOPT_NOBODY] = true;
        } elseif ($request['body'] !== null) {
            $options[CURLOPT_POSTFIELDS] = (string)$request['body'];
        }

        try {
            if (!curl_setopt_array($handle, $options)) {
                throw new RuntimeException('Unable to configure cURL.');
            }
            $ok = curl_exec($handle);
            $errorNumber = curl_errno($handle);
            $errorText = curl_error($handle);
            $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            $effectiveUrl = (string)(curl_getinfo($handle, CURLINFO_EFFECTIVE_URL) ?: $request['url']);
            $contentType = curl_getinfo($handle, CURLINFO_CONTENT_TYPE);
            if (is_string($contentType) && $contentType !== '' && !isset($responseHeaders['content-type'])) {
                $responseHeaders['content-type'][] = $contentType;
            }

            if ($tooLarge) {
                throw new SrpInstitutionHttpException(
                    'response_too_large',
                    "Remote response exceeded the {$maxBytes}-byte limit.",
                    self::sanitizeUrl((string)$request['url']),
                    $status > 0 ? $status : null
                );
            }
            if ($ok === false || $errorNumber !== 0) {
                $category = in_array(
                    $errorNumber,
                    [CURLE_OPERATION_TIMEDOUT, CURLE_COULDNT_CONNECT, CURLE_COULDNT_RESOLVE_HOST],
                    true
                ) ? ($errorNumber === CURLE_OPERATION_TIMEDOUT ? 'timeout' : 'network') : 'transport';
                throw new SrpInstitutionHttpException(
                    $category,
                    $category === 'timeout'
                        ? 'The remote request timed out.'
                        : 'The remote request could not be completed.',
                    self::sanitizeUrl((string)$request['url']),
                    $status > 0 ? $status : null,
                    1,
                    ['curl_error' => $errorNumber, 'transport_message' => mb_substr($errorText, 0, 240)]
                );
            }

            return [
                'status' => $status,
                'headers' => $responseHeaders,
                'body' => $body,
                'effective_url' => $effectiveUrl,
            ];
        } finally {
            curl_close($handle);
        }
    }

    /**
     * @param mixed $raw
     */
    private function coerceResponse($raw, string $requestUrl, int $attempt): SrpInstitutionHttpResponse
    {
        if ($raw instanceof SrpInstitutionHttpResponse) {
            return new SrpInstitutionHttpResponse(
                $raw->statusCode(),
                $raw->headers(),
                $raw->body(),
                $raw->effectiveUrl(),
                $attempt,
                false
            );
        }
        if (is_array($raw)) {
            $status = (int)($raw['status'] ?? $raw['status_code'] ?? 0);
            $headers = is_array($raw['headers'] ?? null) ? $raw['headers'] : [];
            $body = isset($raw['body']) ? (string)$raw['body'] : '';
            $effectiveUrl = (string)($raw['effective_url'] ?? $raw['url'] ?? $requestUrl);
            return new SrpInstitutionHttpResponse($status, $headers, $body, $effectiveUrl, $attempt, false);
        }
        if (is_object($raw)
            && method_exists($raw, 'getStatusCode')
            && method_exists($raw, 'getHeaders')
            && method_exists($raw, 'getBody')
        ) {
            return new SrpInstitutionHttpResponse(
                (int)$raw->getStatusCode(),
                (array)$raw->getHeaders(),
                (string)$raw->getBody(),
                $requestUrl,
                $attempt,
                false
            );
        }
        throw new UnexpectedValueException('The injected HTTP transport returned an unsupported response.');
    }

    private function validateUrl(string $url): void
    {
        if ($url === '' || str_contains($url, "\r") || str_contains($url, "\n")) {
            throw new InvalidArgumentException('Invalid request URL.');
        }
        $parts = parse_url($url);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        if ($parts === false || !in_array($scheme, ['http', 'https'], true) || empty($parts['host'])) {
            throw new InvalidArgumentException('Only absolute HTTP(S) source URLs are allowed.');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('Credentials in source URLs are not allowed.');
        }
    }

    /**
     * @param array<string, mixed> $headers
     * @return array<string, string>
     */
    private function normalizeRequestHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $name => $value) {
            $name = trim((string)$name);
            if ($name === '' || str_contains($name, "\r") || str_contains($name, "\n")) {
                throw new InvalidArgumentException('Invalid HTTP header name.');
            }
            if (!is_scalar($value)) {
                throw new InvalidArgumentException("HTTP header {$name} must be scalar.");
            }
            $value = trim((string)$value);
            if (str_contains($value, "\r") || str_contains($value, "\n")) {
                throw new InvalidArgumentException("Invalid HTTP header value for {$name}.");
            }
            $normalized[$name] = $value;
        }
        return $normalized;
    }

    /**
     * @param array<string, string> $headers
     */
    private function hasHeader(array $headers, string $wanted): bool
    {
        foreach ($headers as $name => $_) {
            if (strcasecmp($name, $wanted) === 0) {
                return true;
            }
        }
        return false;
    }

    private function respectRateLimit(string $url, float $minimumInterval): void
    {
        if ($minimumInterval <= 0) {
            return;
        }
        $parts = parse_url($url);
        $origin = strtolower((string)($parts['scheme'] ?? ''))
            . '://'
            . strtolower((string)($parts['host'] ?? ''))
            . (isset($parts['port']) ? ':' . (int)$parts['port'] : '');
        $now = (float)($this->clock)();
        if (isset($this->lastRequestAt[$origin])) {
            $remaining = $minimumInterval - ($now - $this->lastRequestAt[$origin]);
            if ($remaining > 0) {
                ($this->sleeper)($remaining);
                // Mock clocks need not advance when their mock sleeper is called.
                $now = max((float)($this->clock)(), $this->lastRequestAt[$origin] + $minimumInterval);
            }
        }
        $this->lastRequestAt[$origin] = $now;
    }

    private function retryDelay(int $failedAttempt, ?string $retryAfter): float
    {
        if ($retryAfter !== null) {
            $retryAfter = trim($retryAfter);
            if (ctype_digit($retryAfter)) {
                return min($this->maximumBackoff, max(0.0, (float)$retryAfter));
            }
            $timestamp = strtotime($retryAfter);
            if ($timestamp !== false) {
                return min(
                    $this->maximumBackoff,
                    max(0.0, $timestamp - (float)($this->clock)())
                );
            }
        }
        return min(
            $this->maximumBackoff,
            $this->initialBackoff * (2 ** max(0, $failedAttempt - 1))
        );
    }

    private function retryableCategory(string $category): bool
    {
        return in_array($category, ['timeout', 'network', 'transport', 'rate_limited', 'http_error'], true);
    }

    private function categorizeThrowable(Throwable $error): string
    {
        $message = strtolower($error->getMessage());
        if (str_contains($message, 'timed out') || str_contains($message, 'timeout')) {
            return 'timeout';
        }
        if (str_contains($message, 'resolve')
            || str_contains($message, 'connect')
            || str_contains($message, 'network')
        ) {
            return 'network';
        }
        if ($error instanceof UnexpectedValueException) {
            return 'invalid_response';
        }
        return 'transport';
    }

    private function safeTransportMessage(string $category, Throwable $error): string
    {
        if ($category === 'timeout') {
            return 'The remote request timed out.';
        }
        if ($category === 'network') {
            return 'The remote service could not be reached.';
        }
        if ($category === 'invalid_response') {
            return mb_substr($error->getMessage(), 0, 300);
        }
        return 'The HTTP transport failed: ' . mb_substr($error->getMessage(), 0, 240);
    }

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $options
     */
    private function cacheKey(
        string $method,
        string $url,
        array $headers,
        ?string $body,
        array $options
    ): string {
        if (isset($options['cache_key']) && is_string($options['cache_key'])) {
            return hash('sha256', $options['cache_key']);
        }
        $vary = [];
        foreach ($headers as $name => $value) {
            if (in_array(strtolower($name), ['accept', 'accept-language', 'authorization'], true)) {
                $vary[strtolower($name)] = $value;
            }
        }
        ksort($vary);
        return hash('sha256', json_encode([
            $method,
            $url,
            $vary,
            $body === null ? null : hash('sha256', $body),
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function readCache(string $key, int $maxBytes): ?SrpInstitutionHttpResponse
    {
        if ($this->cachePath === null) {
            return null;
        }
        $path = $this->cacheFile($key);
        if (!is_file($path)) {
            return null;
        }
        $size = filesize($path);
        if ($size === false || $size > (int)ceil($maxBytes * 1.5) + 65536) {
            @unlink($path);
            return null;
        }
        $contents = file_get_contents($path);
        if ($contents === false) {
            return null;
        }
        try {
            $entry = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $ignored) {
            @unlink($path);
            return null;
        }
        if (!is_array($entry)
            || !isset($entry['expires_at'], $entry['status'], $entry['body'])
            || (float)$entry['expires_at'] <= (float)($this->clock)()
        ) {
            @unlink($path);
            return null;
        }
        $body = base64_decode((string)$entry['body'], true);
        if ($body === false || strlen($body) > $maxBytes) {
            @unlink($path);
            return null;
        }
        return new SrpInstitutionHttpResponse(
            (int)$entry['status'],
            is_array($entry['headers'] ?? null) ? $entry['headers'] : [],
            $body,
            (string)($entry['effective_url'] ?? ''),
            1,
            true
        );
    }

    private function writeCache(
        string $key,
        SrpInstitutionHttpResponse $response,
        int $ttl
    ): void {
        if ($this->cachePath === null || $ttl <= 0) {
            return;
        }
        try {
            $directory = dirname($this->cacheFile($key));
            if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
                throw new RuntimeException('Unable to create institution HTTP cache directory.');
            }
            $allowedHeaders = [];
            foreach ([
                'content-type', 'content-length', 'content-disposition',
                'etag', 'last-modified', 'cache-control',
            ] as $name) {
                if (isset($response->headers()[$name])) {
                    $allowedHeaders[$name] = $response->headers()[$name];
                }
            }
            $entry = [
                'version' => 1,
                'created_at' => (float)($this->clock)(),
                'expires_at' => (float)($this->clock)() + $ttl,
                'status' => $response->statusCode(),
                'headers' => $allowedHeaders,
                'effective_url' => self::sanitizeUrl($response->effectiveUrl()),
                'body' => base64_encode($response->body()),
            ];
            $path = $this->cacheFile($key);
            $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
            $json = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (file_put_contents($temporary, $json, LOCK_EX) === false) {
                throw new RuntimeException('Unable to write institution HTTP cache entry.');
            }
            @chmod($temporary, 0660);
            if (!rename($temporary, $path)) {
                @unlink($temporary);
                throw new RuntimeException('Unable to publish institution HTTP cache entry.');
            }
        } catch (Throwable $error) {
            // Cache failure must never turn a successful source response into a failed run.
            $this->log('warning', 'institution_http_cache_write_failed', [
                'category' => 'cache',
                'message' => mb_substr($error->getMessage(), 0, 240),
            ]);
        }
    }

    private function cacheFile(string $key): string
    {
        if ($this->cachePath === null) {
            return '';
        }
        return $this->cachePath
            . DIRECTORY_SEPARATOR
            . substr($key, 0, 2)
            . DIRECTORY_SEPARATOR
            . $key
            . '.json';
    }

    /**
     * @param list<string> $keys
     * @param mixed $default
     * @return mixed
     */
    private function value(array $keys, $default = null)
    {
        foreach ($keys as $key) {
            if (is_array($this->config)) {
                if (array_key_exists($key, $this->config)) {
                    return $this->config[$key];
                }
                $cursor = $this->config;
                $found = true;
                foreach (explode('.', $key) as $segment) {
                    if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                        $found = false;
                        break;
                    }
                    $cursor = $cursor[$segment];
                }
                if ($found) {
                    return $cursor;
                }
            } elseif (is_object($this->config)) {
                if (method_exists($this->config, 'get')) {
                    try {
                        $sentinel = new stdClass();
                        $value = $this->config->get($key, $sentinel);
                        if ($value !== $sentinel) {
                            return $value;
                        }
                    } catch (Throwable $ignored) {
                        // Try public properties and accessor methods below.
                    }
                }
                if (isset($this->config->{$key}) || property_exists($this->config, $key)) {
                    return $this->config->{$key};
                }
                $method = lcfirst(str_replace(' ', '', ucwords(str_replace(['.', '_', '-'], ' ', $key))));
                if (method_exists($this->config, $method)) {
                    try {
                        return $this->config->{$method}();
                    } catch (Throwable $ignored) {
                        // Continue to another compatible key.
                    }
                }
            }
        }
        return $default;
    }

    /**
     * @param mixed $value
     */
    private function positiveFloat($value, float $default): float
    {
        $number = is_numeric($value) ? (float)$value : $default;
        return $number > 0 ? $number : $default;
    }

    /**
     * @param mixed $value
     */
    private function boundedInt($value, int $minimum, int $maximum, int $default): int
    {
        if (!is_numeric($value)) {
            return $default;
        }
        return max($minimum, min($maximum, (int)$value));
    }

    /**
     * @param array<string, scalar|null> $context
     */
    private function log(string $level, string $event, array $context): void
    {
        if ($this->logger === null) {
            return;
        }
        $safeContext = $this->sanitizeLogContext($context);
        try {
            ($this->logger)($level, $event, $safeContext);
        } catch (ArgumentCountError $ignored) {
            try {
                ($this->logger)([
                    'level' => $level,
                    'event' => $event,
                    'context' => $safeContext,
                ]);
            } catch (Throwable $ignoredAgain) {
                // Logging must not affect source ingestion.
            }
        } catch (Throwable $ignored) {
            // Logging must not affect source ingestion.
        }
    }

    /**
     * @param array<string, scalar|null> $context
     * @return array<string, scalar|null>
     */
    private function sanitizeLogContext(array $context): array
    {
        $safe = [];
        foreach ($context as $key => $value) {
            if (preg_match('/api[_-]?key|token|secret|password|authorization|cookie/i', $key)) {
                $safe[$key] = '[REDACTED]';
                continue;
            }
            if ($key === 'url' && is_string($value)) {
                $safe[$key] = self::sanitizeUrl($value);
                continue;
            }
            $safe[$key] = is_string($value) ? mb_substr($value, 0, 1000) : $value;
        }
        return $safe;
    }
}
