ALTER TABLE events
    ADD COLUMN allowed_audiences JSON NULL AFTER requires_registration;

ALTER TABLE event_registrations
    ADD COLUMN confirmation_sent_at DATETIME NULL AFTER registered_at,
    ADD COLUMN creator_notified_at DATETIME NULL AFTER confirmation_sent_at,
    ADD COLUMN reminder_sent_at DATETIME NULL AFTER creator_notified_at;

CREATE TABLE IF NOT EXISTS event_invitations (
    id VARCHAR(32) NOT NULL,
    event_id VARCHAR(32) NOT NULL,
    invited_user_id VARCHAR(32) NOT NULL,
    invited_by VARCHAR(32) NOT NULL,
    notification_sent_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_event_invited_user (event_id, invited_user_id),
    KEY idx_event_invited_user (invited_user_id, event_id),
    KEY idx_event_invited_by (invited_by),
    CONSTRAINT fk_event_invitation_event
        FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    CONSTRAINT fk_event_invitation_user
        FOREIGN KEY (invited_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_event_invitation_actor
        FOREIGN KEY (invited_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
