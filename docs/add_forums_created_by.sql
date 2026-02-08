-- Track which user created each forum.
ALTER TABLE forums
    ADD COLUMN created_by VARCHAR(32) NULL AFTER created_at;
