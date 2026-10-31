ALTER TABLE users
    ADD COLUMN deletion_status ENUM('active', 'pending', 'purged') NOT NULL DEFAULT 'active' AFTER is_public,
    ADD COLUMN deletion_requested_at DATETIME DEFAULT NULL AFTER deletion_status,
    ADD COLUMN scheduled_purge_at DATETIME DEFAULT NULL AFTER deletion_requested_at,
    ADD COLUMN fully_deleted_at DATETIME DEFAULT NULL AFTER scheduled_purge_at,
    ADD KEY idx_users_deletion_schedule (deletion_status, scheduled_purge_at);

CREATE TABLE IF NOT EXISTS account_deletion_records (
    deletion_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    email_fingerprint CHAR(64) NOT NULL,
    request_ip_fingerprint CHAR(64) DEFAULT NULL,
    requested_at DATETIME NOT NULL,
    scheduled_purge_at DATETIME NOT NULL,
    recovered_at DATETIME DEFAULT NULL,
    purged_at DATETIME DEFAULT NULL,
    forced TINYINT(1) NOT NULL DEFAULT 0,
    recovery_snapshot JSON DEFAULT NULL,
    PRIMARY KEY (deletion_id),
    KEY idx_account_deletion_user (user_id, requested_at),
    KEY idx_account_deletion_email (email_fingerprint),
    KEY idx_account_deletion_purge (purged_at, scheduled_purge_at),
    CONSTRAINT fk_account_deletion_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
