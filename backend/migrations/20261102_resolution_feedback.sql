CREATE TABLE IF NOT EXISTS content_resolution_feedback (
    post_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    helpful ENUM('yes','no') NULL,
    resolved ENUM('yes','partly','no') NULL,
    knows_next_step ENUM('yes','unsure','no') NULL,
    missing_reason ENUM('more_detail','clearer_steps','institution_specific','source_or_contact','personal_help','other') NULL,
    missing_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    KEY idx_resolution_feedback_updated (updated_at),
    CONSTRAINT fk_resolution_feedback_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    CONSTRAINT fk_resolution_feedback_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
