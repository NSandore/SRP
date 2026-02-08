-- Track which user last edited each post.
ALTER TABLE posts
    ADD COLUMN updated_by VARCHAR(32) NULL AFTER updated_at;
