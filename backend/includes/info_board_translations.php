<?php

const SRP_INFO_BOARD_COMMUNITY_ID = 'c57b7fd6c45b9d57b';

/**
 * Languages exposed by the platform language menu. English is the stored-source
 * fallback and therefore never requires a translation request.
 */
function srp_info_board_languages(): array {
    return [
        'en' => 'English',
        'es' => 'Spanish',
        'zh' => 'Simplified Chinese',
        'fil' => 'Filipino (Tagalog)',
        'vi' => 'Vietnamese',
        'ar' => 'Arabic',
        'fr' => 'French',
        'ko' => 'Korean',
        'ru' => 'Russian',
        'hi' => 'Hindi',
    ];
}

function srp_info_board_community_id(): string {
    $configured = trim((string)(getenv('INFO_BOARD_COMMUNITY_ID') ?: ''));
    return $configured !== '' ? $configured : SRP_INFO_BOARD_COMMUNITY_ID;
}

/**
 * Resolve a supported platform language from ?lang=, then Accept-Language.
 */
function srp_requested_content_language(?string $requested = null): string {
    $candidate = $requested;
    if ($candidate === null || trim($candidate) === '') {
        $candidate = isset($_GET['lang']) ? (string)$_GET['lang'] : '';
    }
    if (trim((string)$candidate) === '') {
        $acceptLanguage = (string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '');
        $candidate = explode(',', $acceptLanguage, 2)[0] ?? '';
    }

    $normalized = strtolower(str_replace('_', '-', trim((string)$candidate)));
    $aliases = [
        'tl' => 'fil',
        'tagalog' => 'fil',
        'zh-cn' => 'zh',
        'zh-hans' => 'zh',
    ];
    if (isset($aliases[$normalized])) {
        $normalized = $aliases[$normalized];
    } elseif (strpos($normalized, '-') !== false) {
        $normalized = explode('-', $normalized, 2)[0];
    }

    return array_key_exists($normalized, srp_info_board_languages()) ? $normalized : 'en';
}

function srp_info_board_translation_configured(): bool {
    return trim((string)(getenv('OPENAI_API_KEY') ?: '')) !== '';
}

/**
 * Extract the text payload from a raw Responses API response.
 */
function srp_openai_response_text(array $response): string {
    foreach (($response['output'] ?? []) as $outputItem) {
        if (($outputItem['type'] ?? '') !== 'message') {
            continue;
        }
        foreach (($outputItem['content'] ?? []) as $contentItem) {
            if (($contentItem['type'] ?? '') === 'output_text' && isset($contentItem['text'])) {
                return trim((string)$contentItem['text']);
            }
        }
    }
    return '';
}

/**
 * Translate one bounded batch. Failures are deliberately non-fatal: callers
 * continue displaying the original database value.
 *
 * @return array<string, string> request ID => translated text
 */
function srp_translate_info_board_batch(array $items, string $targetLanguage): array {
    if (!$items || $targetLanguage === 'en' || !srp_info_board_translation_configured()) {
        return [];
    }
    if (!function_exists('curl_init')) {
        error_log('[SRP] Info Board translation skipped: PHP cURL is unavailable.');
        return [];
    }

    $languages = srp_info_board_languages();
    $targetName = $languages[$targetLanguage] ?? '';
    if ($targetName === '') {
        return [];
    }

    $apiKey = trim((string)getenv('OPENAI_API_KEY'));
    $model = trim((string)(getenv('INFO_TRANSLATION_MODEL') ?: 'gpt-5.6-luna'));
    $apiUrl = trim((string)(getenv('OPENAI_API_BASE_URL') ?: 'https://api.openai.com/v1'));
    $timeout = (int)(getenv('INFO_TRANSLATION_TIMEOUT_SECONDS') ?: 30);
    $timeout = max(5, min($timeout, 60));

    $inputItems = array_map(static function (array $item): array {
        return [
            'id' => (string)$item['request_id'],
            'text' => (string)$item['source_text'],
        ];
    }, $items);

    $payload = [
        'model' => $model,
        'store' => false,
        'reasoning' => ['effort' => 'none'],
        'instructions' => implode(' ', [
            "Translate every supplied item into {$targetName}.",
            'Return exactly one result for every input ID and no commentary.',
            'Preserve HTML tag structure and attributes while translating only visible natural-language text.',
            'Do not alter URLs, email addresses, @mentions, code, placeholders, numbers, or proper names.',
            'If text is already in the target language, return it unchanged.',
        ]),
        'input' => json_encode(['items' => $inputItems], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'text' => [
            'verbosity' => 'low',
            'format' => [
                'type' => 'json_schema',
                'name' => 'info_board_translations',
                'strict' => true,
                'schema' => [
                    'type' => 'object',
                    'properties' => [
                        'translations' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'id' => ['type' => 'string'],
                                    'text' => ['type' => 'string'],
                                ],
                                'required' => ['id', 'text'],
                                'additionalProperties' => false,
                            ],
                        ],
                    ],
                    'required' => ['translations'],
                    'additionalProperties' => false,
                ],
            ],
        ],
    ];

    $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encodedPayload === false) {
        error_log('[SRP] Info Board translation skipped: unable to encode request.');
        return [];
    }

    $ch = curl_init(rtrim($apiUrl, '/') . '/responses');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $encodedPayload,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => $timeout,
    ]);

    $rawResponse = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($rawResponse === false || $status < 200 || $status >= 300) {
        error_log(sprintf(
            '[SRP] Info Board translation request failed (HTTP %d%s).',
            $status,
            $curlError !== '' ? ', transport error' : ''
        ));
        return [];
    }

    $response = json_decode((string)$rawResponse, true);
    if (!is_array($response)) {
        error_log('[SRP] Info Board translation returned invalid JSON.');
        return [];
    }
    $outputText = srp_openai_response_text($response);
    $decodedOutput = json_decode($outputText, true);
    if (!is_array($decodedOutput) || !isset($decodedOutput['translations'])) {
        error_log('[SRP] Info Board translation returned an invalid structured payload.');
        return [];
    }

    $allowedIds = [];
    foreach ($items as $item) {
        $allowedIds[(string)$item['request_id']] = true;
    }
    $translations = [];
    foreach ((array)$decodedOutput['translations'] as $translation) {
        $requestId = (string)($translation['id'] ?? '');
        if ($requestId === '' || !isset($allowedIds[$requestId]) || !array_key_exists('text', $translation)) {
            continue;
        }
        $translations[$requestId] = (string)$translation['text'];
    }
    return $translations;
}

/**
 * Overlay translated fields on database rows belonging to the Information
 * Board. Original values remain available as original_<field> for editing,
 * reporting, and future "view original" UI.
 */
function srp_translate_info_board_rows(
    PDO $db,
    array $rows,
    string $entityType,
    string $idField,
    array $fields,
    ?string $requestedLanguage = null
): array {
    $targetLanguage = srp_requested_content_language($requestedLanguage);
    if (!$rows || $targetLanguage === 'en') {
        return $rows;
    }
    if (!in_array($entityType, ['forum', 'thread', 'post'], true)) {
        return $rows;
    }

    $states = [];
    $entityIds = [];
    $maxFieldChars = (int)(getenv('INFO_TRANSLATION_MAX_FIELD_CHARS') ?: 12000);
    $maxFieldChars = max(500, min($maxFieldChars, 50000));
    foreach ($rows as $rowIndex => &$row) {
        $entityId = (string)($row[$idField] ?? '');
        if ($entityId === '') {
            continue;
        }
        $entityIds[$entityId] = true;
        foreach ($fields as $field) {
            if (!array_key_exists($field, $row)) {
                continue;
            }
            $sourceText = (string)($row[$field] ?? '');
            $row['original_' . $field] = $sourceText;
            if (trim(strip_tags($sourceText)) === '') {
                continue;
            }
            $sourceLength = function_exists('mb_strlen') ? mb_strlen($sourceText) : strlen($sourceText);
            if ($sourceLength > $maxFieldChars) {
                continue;
            }
            $stateKey = $rowIndex . '|' . $field;
            $states[$stateKey] = [
                'row_index' => $rowIndex,
                'entity_id' => $entityId,
                'field_name' => $field,
                'source_text' => $sourceText,
                'source_hash' => hash('sha256', $sourceText),
                'request_id' => (string)count($states),
            ];
        }
        $row['translation_language'] = $targetLanguage;
        $row['is_translated'] = false;
    }
    unset($row);

    if (!$states) {
        return $rows;
    }

    $cached = [];
    try {
        $placeholders = [];
        $params = [':entity_type' => $entityType, ':language_code' => $targetLanguage];
        $position = 0;
        foreach (array_keys($entityIds) as $entityId) {
            $placeholder = ':entity_id_' . $position++;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $entityId;
        }
        $stmt = $db->prepare(
            'SELECT entity_id, field_name, source_hash, translated_text '
            . 'FROM info_board_translations '
            . 'WHERE entity_type = :entity_type AND language_code = :language_code '
            . 'AND entity_id IN (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $translation) {
            $cached[(string)$translation['entity_id'] . '|' . (string)$translation['field_name']] = $translation;
        }
    } catch (Throwable $e) {
        error_log('[SRP] Info Board translation cache unavailable: ' . $e->getMessage());
        return $rows;
    }

    $missing = [];
    foreach ($states as $stateKey => $state) {
        $cacheKey = $state['entity_id'] . '|' . $state['field_name'];
        $translation = $cached[$cacheKey] ?? null;
        if ($translation && hash_equals((string)$translation['source_hash'], $state['source_hash'])) {
            $rowIndex = $state['row_index'];
            $field = $state['field_name'];
            $rows[$rowIndex][$field] = (string)$translation['translated_text'];
            $rows[$rowIndex]['is_translated'] = true;
            continue;
        }
        $missing[$stateKey] = $state;
    }

    if (!$missing || !srp_info_board_translation_configured()) {
        return $rows;
    }

    $model = trim((string)(getenv('INFO_TRANSLATION_MODEL') ?: 'gpt-5.6-luna'));
    $upsert = $db->prepare(
        'INSERT INTO info_board_translations '
        . '(entity_type, entity_id, field_name, language_code, source_hash, translated_text, provider, model) '
        . 'VALUES (:entity_type, :entity_id, :field_name, :language_code, :source_hash, :translated_text, :provider, :model) '
        . 'ON DUPLICATE KEY UPDATE source_hash = VALUES(source_hash), '
        . 'translated_text = VALUES(translated_text), provider = VALUES(provider), model = VALUES(model)'
    );

    $maxBatchChars = (int)(getenv('INFO_TRANSLATION_MAX_BATCH_CHARS') ?: 24000);
    $maxBatchChars = max($maxFieldChars, min($maxBatchChars, 100000));
    $chunks = [];
    $chunk = [];
    $chunkChars = 0;
    foreach ($missing as $stateKey => $state) {
        $fieldChars = function_exists('mb_strlen')
            ? mb_strlen($state['source_text'])
            : strlen($state['source_text']);
        if ($chunk && (count($chunk) >= 20 || $chunkChars + $fieldChars > $maxBatchChars)) {
            $chunks[] = $chunk;
            $chunk = [];
            $chunkChars = 0;
        }
        $chunk[$stateKey] = $state;
        $chunkChars += $fieldChars;
    }
    if ($chunk) {
        $chunks[] = $chunk;
    }

    foreach ($chunks as $chunk) {
        $generated = srp_translate_info_board_batch(array_values($chunk), $targetLanguage);
        foreach ($chunk as $state) {
            $translatedText = $generated[$state['request_id']] ?? null;
            if ($translatedText === null || trim((string)$translatedText) === '') {
                continue;
            }
            $rowIndex = $state['row_index'];
            $field = $state['field_name'];
            $rows[$rowIndex][$field] = (string)$translatedText;
            $rows[$rowIndex]['is_translated'] = true;
            try {
                $upsert->execute([
                    ':entity_type' => $entityType,
                    ':entity_id' => $state['entity_id'],
                    ':field_name' => $field,
                    ':language_code' => $targetLanguage,
                    ':source_hash' => $state['source_hash'],
                    ':translated_text' => (string)$translatedText,
                    ':provider' => 'openai',
                    ':model' => $model,
                ]);
            } catch (Throwable $e) {
                error_log('[SRP] Unable to cache Info Board translation: ' . $e->getMessage());
            }
        }
    }

    return $rows;
}

function srp_is_info_board_community($communityId): bool {
    return (string)$communityId === srp_info_board_community_id();
}
