CREATE TABLE IF NOT EXISTS reels (
    reel_id VARCHAR(32) NOT NULL,
    creator_user_id VARCHAR(32) NOT NULL,
    community_id VARCHAR(32) DEFAULT NULL,
    caption VARCHAR(500) NOT NULL DEFAULT '',
    video_path VARCHAR(500) DEFAULT NULL,
    thumbnail_path VARCHAR(500) DEFAULT NULL,
    duration_ms INT UNSIGNED DEFAULT NULL,
    width INT UNSIGNED DEFAULT NULL,
    height INT UNSIGNED DEFAULT NULL,
    file_size BIGINT UNSIGNED DEFAULT NULL,
    status ENUM('processing', 'ready', 'failed') NOT NULL DEFAULT 'processing',
    processing_error VARCHAR(500) DEFAULT NULL,
    is_intro TINYINT(1) NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    featured_at DATETIME DEFAULT NULL,
    featured_by VARCHAR(32) DEFAULT NULL,
    feed_sort_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    like_count INT UNSIGNED NOT NULL DEFAULT 0,
    comment_count INT UNSIGNED NOT NULL DEFAULT 0,
    save_count INT UNSIGNED NOT NULL DEFAULT 0,
    is_hidden TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id),
    KEY idx_reels_feed (status, is_hidden, deleted_at, is_featured, feed_sort_at, reel_id),
    KEY idx_reels_creator (creator_user_id, status, is_hidden, created_at, reel_id),
    KEY idx_reels_community (community_id, status, is_hidden, created_at, reel_id),
    KEY idx_reels_featured_by (featured_by),
    CONSTRAINT fk_reels_creator
        FOREIGN KEY (creator_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reels_community
        FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL,
    CONSTRAINT fk_reels_featured_by
        FOREIGN KEY (featured_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_likes (
    reel_like_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_like_id),
    UNIQUE KEY uq_reel_likes_user (reel_id, user_id),
    KEY idx_reel_likes_user (user_id, created_at),
    CONSTRAINT fk_reel_likes_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_likes_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_saves (
    reel_save_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_save_id),
    UNIQUE KEY uq_reel_saves_user (reel_id, user_id),
    KEY idx_reel_saves_user (user_id, created_at, reel_id),
    CONSTRAINT fk_reel_saves_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_saves_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_comments (
    reel_comment_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    parent_comment_id VARCHAR(32) DEFAULT NULL,
    body VARCHAR(2000) NOT NULL,
    is_hidden TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_comment_id),
    KEY idx_reel_comments_reel (reel_id, is_hidden, created_at, reel_comment_id),
    KEY idx_reel_comments_user (user_id, created_at),
    KEY idx_reel_comments_parent (parent_comment_id),
    CONSTRAINT fk_reel_comments_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_comments_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_comments_parent
        FOREIGN KEY (parent_comment_id) REFERENCES reel_comments(reel_comment_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_community_pins (
    reel_pin_id VARCHAR(32) NOT NULL,
    community_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) NOT NULL,
    pinned_by VARCHAR(32) NOT NULL,
    pinned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_pin_id),
    UNIQUE KEY uq_reel_community_pin (community_id, reel_id),
    KEY idx_reel_pins_reel (reel_id, pinned_at),
    KEY idx_reel_pins_actor (pinned_by),
    CONSTRAINT fk_reel_pins_community
        FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_pins_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_pins_actor
        FOREIGN KEY (pinned_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_intro_reels (
    user_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_user_intro_reel (reel_id),
    CONSTRAINT fk_user_intro_reels_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_intro_reels_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_upload_sessions (
    upload_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    reel_id VARCHAR(32) DEFAULT NULL,
    file_name VARCHAR(255) NOT NULL,
    expected_mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    chunk_size INT UNSIGNED NOT NULL,
    total_chunks INT UNSIGNED NOT NULL,
    received_chunks INT UNSIGNED NOT NULL DEFAULT 0,
    caption VARCHAR(500) NOT NULL DEFAULT '',
    community_id VARCHAR(32) DEFAULT NULL,
    is_intro TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM(
        'uploading', 'assembling', 'queued', 'processing',
        'complete', 'failed', 'cancelled', 'expired'
    ) NOT NULL DEFAULT 'uploading',
    error_message VARCHAR(500) DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (upload_id),
    UNIQUE KEY uq_reel_upload_reel (reel_id),
    KEY idx_reel_upload_user (user_id, created_at),
    KEY idx_reel_upload_status (status, expires_at),
    KEY idx_reel_upload_community (community_id),
    CONSTRAINT fk_reel_upload_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_reel_upload_reel
        FOREIGN KEY (reel_id) REFERENCES reels(reel_id) ON DELETE SET NULL,
    CONSTRAINT fk_reel_upload_community
        FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reel_upload_chunks (
    upload_id VARCHAR(32) NOT NULL,
    chunk_index INT UNSIGNED NOT NULL,
    chunk_size INT UNSIGNED NOT NULL,
    sha256 CHAR(64) NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (upload_id, chunk_index),
    CONSTRAINT fk_reel_upload_chunks_session
        FOREIGN KEY (upload_id) REFERENCES reel_upload_sessions(upload_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE reports
    MODIFY COLUMN item_type ENUM(
        'forum', 'thread', 'post', 'comment', 'announcement', 'event', 'user',
        'reel', 'reel_comment'
    ) NOT NULL;

ALTER TABLE notifications
    MODIFY COLUMN notification_type ENUM(
        'follow', 'upvote', 'downvote', 'reply', 'message', 'connection',
        'announcement', 'poll', 'survey', 'event', 'verify',
        'verification_request', 'verification_result', 'reel_like', 'reel_comment'
    ) DEFAULT NULL;
