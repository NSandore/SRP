ALTER TABLE forums
    ADD COLUMN is_system_container TINYINT(1) NOT NULL DEFAULT 0 AFTER is_hidden;

ALTER TABLE threads
    ADD COLUMN content_kind ENUM('discussion', 'article', 'megathread') NOT NULL DEFAULT 'discussion' AFTER status;
