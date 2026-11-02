ALTER TABLE knowledge_gaps
    MODIFY COLUMN status ENUM('open','in_progress','ready_for_review','resolved') NOT NULL DEFAULT 'open',
    ADD COLUMN contributor_notes VARCHAR(1000) NULL AFTER assigned_to;
