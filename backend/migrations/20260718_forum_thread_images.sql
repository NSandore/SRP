ALTER TABLE forums
    ADD COLUMN image_layout ENUM('left', 'banner') NOT NULL DEFAULT 'banner' AFTER banner_path;

ALTER TABLE threads
    ADD COLUMN image_path VARCHAR(255) DEFAULT NULL AFTER title;

ALTER TABLE threads
    ADD COLUMN image_layout ENUM('left', 'banner') NOT NULL DEFAULT 'banner' AFTER image_path;
