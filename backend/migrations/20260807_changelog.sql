CREATE TABLE IF NOT EXISTS changelog_entries (
    changelog_entry_id VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    emoji VARCHAR(16) DEFAULT NULL,
    version_label VARCHAR(40) DEFAULT NULL,
    summary VARCHAR(500) DEFAULT NULL,
    body MEDIUMTEXT DEFAULT NULL,
    status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    published_at DATETIME DEFAULT NULL,
    created_by VARCHAR(32) DEFAULT NULL,
    published_by VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (changelog_entry_id),
    -- Serves both the public list and the "newest entry since the user last
    -- looked" prompt lookup, which orders published rows by published_at.
    KEY idx_changelog_status_published (status, published_at),
    KEY idx_changelog_created_by (created_by),
    KEY idx_changelog_published_by (published_by),
    CONSTRAINT fk_changelog_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_changelog_publisher
        FOREIGN KEY (published_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
