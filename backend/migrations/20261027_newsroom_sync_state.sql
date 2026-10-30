CREATE TABLE IF NOT EXISTS newsroom_sync_state (
    source_key VARCHAR(80) NOT NULL,
    last_synced_at DATETIME NOT NULL,
    PRIMARY KEY (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
