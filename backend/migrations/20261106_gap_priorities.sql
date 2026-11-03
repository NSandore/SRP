ALTER TABLE knowledge_gaps
    ADD COLUMN priority_level ENUM('needs_triage','critical','high','normal','low') NOT NULL DEFAULT 'needs_triage' AFTER last_seen_at,
    ADD COLUMN affected_audience VARCHAR(255) NULL AFTER priority_level,
    ADD COLUMN urgency_reason VARCHAR(500) NULL AFTER affected_audience,
    ADD COLUMN triaged_by VARCHAR(32) NULL AFTER urgency_reason,
    ADD COLUMN triaged_at DATETIME NULL AFTER triaged_by,
    ADD KEY idx_knowledge_gap_priority (status, priority_level, updated_at),
    ADD CONSTRAINT fk_knowledge_gap_triager FOREIGN KEY (triaged_by) REFERENCES users(user_id) ON DELETE SET NULL;
