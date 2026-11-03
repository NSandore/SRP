ALTER TABLE knowledge_gaps
    MODIFY COLUMN source_post_id VARCHAR(32) NULL,
    ADD COLUMN source_type ENUM('feedback','search') NOT NULL DEFAULT 'feedback' AFTER gap_id,
    ADD COLUMN source_key CHAR(64) NULL AFTER source_user_id,
    ADD COLUMN search_query VARCHAR(160) NULL AFTER source_key,
    ADD COLUMN signal_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER search_query,
    ADD COLUMN first_seen_at DATETIME NULL AFTER signal_count,
    ADD COLUMN last_seen_at DATETIME NULL AFTER first_seen_at,
    ADD UNIQUE KEY uq_knowledge_gap_source_key (source_key),
    ADD KEY idx_knowledge_gap_source_type (source_type, status, signal_count);

UPDATE knowledge_gaps
SET source_type = 'feedback',
    first_seen_at = COALESCE(first_seen_at, created_at),
    last_seen_at = COALESCE(last_seen_at, updated_at)
WHERE source_type = 'feedback';

CREATE TABLE IF NOT EXISTS search_gap_signals (
    query_hash CHAR(64) NOT NULL,
    query_text VARCHAR(160) NOT NULL,
    occurrence_count INT UNSIGNED NOT NULL DEFAULT 1,
    promoted_gap_id VARCHAR(32) NULL,
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    PRIMARY KEY (query_hash),
    KEY idx_search_gap_signal_recency (last_seen_at),
    KEY idx_search_gap_signal_promotion (promoted_gap_id),
    CONSTRAINT fk_search_gap_promoted_gap FOREIGN KEY (promoted_gap_id) REFERENCES knowledge_gaps(gap_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
