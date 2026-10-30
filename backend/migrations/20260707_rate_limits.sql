CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key VARCHAR(191) NOT NULL,
    window_start INT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    PRIMARY KEY (rl_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
