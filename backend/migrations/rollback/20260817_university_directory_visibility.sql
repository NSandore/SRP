ALTER TABLE communities
    DROP KEY idx_communities_directory_visibility,
    DROP COLUMN directory_visibility_manual,
    DROP COLUMN directory_visibility_reason,
    DROP COLUMN directory_visibility;
