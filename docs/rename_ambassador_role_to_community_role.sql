-- Rename ambassadors.role -> ambassadors.community_role
-- Safe to run once on MySQL 8+

START TRANSACTION;

SET @has_old := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ambassadors'
      AND COLUMN_NAME = 'role'
);

SET @has_new := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ambassadors'
      AND COLUMN_NAME = 'community_role'
);

SET @sql := IF(
    @has_old = 1 AND @has_new = 0,
    'ALTER TABLE ambassadors RENAME COLUMN role TO community_role',
    'SELECT \"No rename needed\"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
