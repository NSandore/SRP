<?php

declare(strict_types=1);

/**
 * Normalize a no-result search for anonymous aggregation.
 *
 * Obvious direct identifiers are replaced before storage. The value is also
 * deliberately short: this signal is for identifying missing topics, not for
 * retaining a person's full question.
 */
function srp_normalize_search_gap_query(string $query): string {
    $query = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $query) ?? '';
    $query = preg_replace('/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu', '[email]', $query) ?? $query;
    $query = preg_replace('~\b(?:https?://|www\.)\S+~iu', '[link]', $query) ?? $query;
    $query = preg_replace('/(?<!\w)(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}(?!\w)/u', '[phone]', $query) ?? $query;
    $query = preg_replace('/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/u', '[id]', $query) ?? $query;
    $query = preg_replace('/(?<!\d)\d{6,}(?!\d)/u', '[number]', $query) ?? $query;
    $query = preg_replace('/\s+/u', ' ', trim($query)) ?? '';
    $query = mb_strtolower($query);

    return mb_substr($query, 0, 160);
}

/**
 * Aggregate an empty search without storing a user, session, or IP address.
 * A query enters the review queue only after three occurrences.
 */
function srp_record_empty_search_gap(PDO $db, string $query, int $promotionThreshold = 3): void {
    $normalized = srp_normalize_search_gap_query($query);
    if (mb_strlen($normalized) < 3 || $normalized === '[email]' || $normalized === '[phone]' || $normalized === '[link]') {
        return;
    }

    $queryHash = hash('sha256', $normalized);
    $promotionThreshold = max(2, $promotionThreshold);

    try {
        $db->beginTransaction();

        // Low-frequency queries that never became operational work expire
        // automatically; this bounds retention of one-off searches.
        $db->exec(
            'DELETE FROM search_gap_signals
             WHERE promoted_gap_id IS NULL
               AND last_seen_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
             LIMIT 100'
        );

        $aggregate = $db->prepare(
            'INSERT INTO search_gap_signals (query_hash, query_text, occurrence_count, first_seen_at, last_seen_at)
             VALUES (:query_hash, :query_text, 1, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                occurrence_count = occurrence_count + 1,
                last_seen_at = NOW()'
        );
        $aggregate->execute([
            ':query_hash' => $queryHash,
            ':query_text' => $normalized,
        ]);

        $read = $db->prepare(
            'SELECT occurrence_count, first_seen_at, last_seen_at
             FROM search_gap_signals
             WHERE query_hash = :query_hash
             FOR UPDATE'
        );
        $read->execute([':query_hash' => $queryHash]);
        $signal = $read->fetch(PDO::FETCH_ASSOC);

        if ($signal && (int)$signal['occurrence_count'] >= $promotionThreshold) {
            $gapId = generateUniqueId($db, 'knowledge_gaps');
            $promote = $db->prepare(
                "INSERT INTO knowledge_gaps
                    (gap_id, source_type, source_key, search_query, signal_count, first_seen_at, last_seen_at)
                 VALUES
                    (:gap_id, 'search', :source_key, :search_query, :signal_count, :first_seen_at, :last_seen_at)
                 ON DUPLICATE KEY UPDATE
                    signal_count = VALUES(signal_count),
                    last_seen_at = VALUES(last_seen_at)"
            );
            $promote->execute([
                ':gap_id' => $gapId,
                ':source_key' => $queryHash,
                ':search_query' => $normalized,
                ':signal_count' => (int)$signal['occurrence_count'],
                ':first_seen_at' => $signal['first_seen_at'],
                ':last_seen_at' => $signal['last_seen_at'],
            ]);

            $findGap = $db->prepare('SELECT gap_id FROM knowledge_gaps WHERE source_key = :source_key LIMIT 1');
            $findGap->execute([':source_key' => $queryHash]);
            $promotedGapId = (string)$findGap->fetchColumn();
            $markPromoted = $db->prepare(
                'UPDATE search_gap_signals SET promoted_gap_id = :gap_id WHERE query_hash = :query_hash'
            );
            $markPromoted->execute([':gap_id' => $promotedGapId, ':query_hash' => $queryHash]);
        }

        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        // Search results must remain available if signal collection fails or a
        // deployment has not applied the supporting migration yet.
        error_log('[search-gap-signals] unable to record signal: ' . $error->getMessage());
    }
}
