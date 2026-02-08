ALTER TABLE communities
    ADD COLUMN aliases JSON NULL AFTER tagline;

-- Optional: for MySQL 8+, you can add a generated column and index for faster search.
-- Example (uncomment if desired):
-- ALTER TABLE communities
--     ADD COLUMN aliases_search TEXT
--         GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(aliases, '$')))
--         STORED;
-- CREATE INDEX idx_communities_aliases_search ON communities (aliases_search);
