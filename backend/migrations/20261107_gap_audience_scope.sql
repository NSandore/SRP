ALTER TABLE knowledge_gaps
    ADD COLUMN audience_scope ENUM('unknown','individual','group','broad') NOT NULL DEFAULT 'unknown' AFTER affected_audience;
