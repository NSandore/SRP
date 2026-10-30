ALTER TABLE communities
    ADD COLUMN directory_visibility VARCHAR(16) NOT NULL DEFAULT 'listed',
    ADD COLUMN directory_visibility_reason VARCHAR(64) NULL,
    ADD COLUMN directory_visibility_manual TINYINT(1) NOT NULL DEFAULT 0,
    ALGORITHM=INSTANT;

ALTER TABLE communities
    ADD KEY idx_communities_directory_visibility (
        community_type,
        directory_visibility,
        name
    ),
    ALGORITHM=INPLACE,
    LOCK=NONE;
