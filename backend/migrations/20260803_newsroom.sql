CREATE TABLE IF NOT EXISTS newsroom_items (
    newsroom_item_id VARCHAR(32) NOT NULL,
    source_type ENUM('official', 'manual') NOT NULL DEFAULT 'manual',
    source_name VARCHAR(160) NOT NULL,
    source_url VARCHAR(2048) DEFAULT NULL,
    source_url_hash CHAR(64) NOT NULL,
    source_title VARCHAR(500) NOT NULL,
    source_content MEDIUMTEXT DEFAULT NULL,
    source_published_at DATETIME DEFAULT NULL,
    status ENUM('incoming', 'draft', 'published', 'dismissed') NOT NULL DEFAULT 'incoming',
    draft_title VARCHAR(255) DEFAULT NULL,
    draft_body MEDIUMTEXT DEFAULT NULL,
    draft_tags JSON DEFAULT NULL,
    ai_model VARCHAR(100) DEFAULT NULL,
    ai_prompt_version VARCHAR(40) DEFAULT NULL,
    ai_generated_at DATETIME DEFAULT NULL,
    ai_generated_by VARCHAR(32) DEFAULT NULL,
    target_forum_id VARCHAR(32) DEFAULT NULL,
    thread_id VARCHAR(32) DEFAULT NULL,
    created_by VARCHAR(32) DEFAULT NULL,
    reviewed_by VARCHAR(32) DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    published_by VARCHAR(32) DEFAULT NULL,
    published_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (newsroom_item_id),
    UNIQUE KEY uq_newsroom_source_url_hash (source_url_hash),
    UNIQUE KEY uq_newsroom_thread (thread_id),
    KEY idx_newsroom_status_source_date (status, source_published_at),
    KEY idx_newsroom_published (status, published_at),
    KEY idx_newsroom_target_forum (target_forum_id),
    KEY idx_newsroom_created_by (created_by),
    KEY idx_newsroom_reviewed_by (reviewed_by),
    KEY idx_newsroom_published_by (published_by),
    CONSTRAINT fk_newsroom_forum
        FOREIGN KEY (target_forum_id) REFERENCES forums(forum_id) ON DELETE SET NULL,
    CONSTRAINT fk_newsroom_thread
        FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE SET NULL,
    CONSTRAINT fk_newsroom_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_newsroom_ai_actor
        FOREIGN KEY (ai_generated_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_newsroom_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_newsroom_publisher
        FOREIGN KEY (published_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
