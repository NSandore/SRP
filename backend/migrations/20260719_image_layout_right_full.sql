ALTER TABLE forums
    MODIFY COLUMN image_layout ENUM('left', 'right', 'banner', 'full') NOT NULL DEFAULT 'banner';

ALTER TABLE threads
    MODIFY COLUMN image_layout ENUM('left', 'right', 'banner', 'full') NOT NULL DEFAULT 'banner';

UPDATE forums SET image_layout = 'right' WHERE image_layout = 'left';
UPDATE threads SET image_layout = 'right' WHERE image_layout = 'left';

ALTER TABLE forums
    MODIFY COLUMN image_layout ENUM('right', 'banner', 'full') NOT NULL DEFAULT 'banner';

ALTER TABLE threads
    MODIFY COLUMN image_layout ENUM('right', 'banner', 'full') NOT NULL DEFAULT 'banner';
