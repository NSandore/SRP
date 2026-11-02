CREATE TABLE IF NOT EXISTS knowledge_gaps (
    gap_id VARCHAR(32) NOT NULL,
    source_post_id VARCHAR(32) NOT NULL,
    source_user_id VARCHAR(32) NULL,
    helpful ENUM('yes','no') NULL,
    resolved_signal ENUM('yes','partly','no') NULL,
    next_step_signal ENUM('yes','unsure','no') NULL,
    missing_reason ENUM('more_detail','clearer_steps','institution_specific','source_or_contact','personal_help','other') NULL,
    missing_note VARCHAR(500) NULL,
    status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
    assigned_to VARCHAR(32) NULL,
    admin_notes VARCHAR(1000) NULL,
    resolution_url VARCHAR(500) NULL,
    updated_by VARCHAR(32) NULL,
    resolved_by VARCHAR(32) NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (gap_id),
    UNIQUE KEY uq_knowledge_gap_feedback (source_post_id, source_user_id),
    KEY idx_knowledge_gaps_queue (status, updated_at),
    KEY idx_knowledge_gaps_assignee (assigned_to, status),
    CONSTRAINT fk_knowledge_gap_post FOREIGN KEY (source_post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_gap_source_user FOREIGN KEY (source_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_knowledge_gap_assignee FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_knowledge_gap_updater FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_knowledge_gap_resolver FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO knowledge_gaps
    (gap_id, source_post_id, source_user_id, helpful, resolved_signal, next_step_signal, missing_reason, missing_note, created_at, updated_at)
SELECT
    CONCAT('kg', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 16)),
    feedback.post_id,
    feedback.user_id,
    feedback.helpful,
    feedback.resolved,
    feedback.knows_next_step,
    feedback.missing_reason,
    feedback.missing_note,
    feedback.created_at,
    feedback.updated_at
FROM content_resolution_feedback feedback
WHERE feedback.helpful = 'no'
   OR feedback.resolved IN ('partly', 'no')
   OR feedback.knows_next_step IN ('unsure', 'no');
