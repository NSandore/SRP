-- Track which user last edited each thread.
ALTER TABLE threads
    ADD COLUMN updated_by VARCHAR(32) NULL AFTER updated_at;
