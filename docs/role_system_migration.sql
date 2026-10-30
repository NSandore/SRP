-- Role System Migration
-- This script migrates the role system to the new hierarchy:
-- 0 = guest, 1 = member, 3 = moderator, 4 = admin, 5 = super_admin
--
-- IMPORTANT: Backup your database before running this migration!
--
-- Migration steps:
-- 1. Add missing 'community_role' column to ambassadors table
-- 2. Update existing user role_ids to new values
-- 3. Update roles table with new role definitions

-- Start transaction for safety
START TRANSACTION;

-- Step 1: Add missing 'community_role' column to ambassadors table
-- This column is used extensively in the code but was missing from the schema
ALTER TABLE ambassadors
ADD COLUMN community_role ENUM('member', 'admin') NOT NULL DEFAULT 'member'
AFTER community_id;

-- Step 2: Update existing user role_ids to new values
-- Order matters here! We need to update in a way that doesn't conflict

-- First, move super admins from role_id 1 to a temporary value (99)
-- to avoid conflicts with the next step
UPDATE users SET role_id = 99 WHERE role_id = 1;

-- Then, update existing members from role_id 2 to role_id 1
UPDATE users SET role_id = 1 WHERE role_id = 2;

-- Finally, move super admins from temporary value (99) to role_id 5
UPDATE users SET role_id = 5 WHERE role_id = 99;

-- Handle any users with role_id >= 7 (old admin level) -> map to role_id 4 (new admin)
UPDATE users SET role_id = 4 WHERE role_id >= 7 AND role_id < 99;

-- Handle any users with role_id >= 5 (old moderator level) -> map to role_id 3 (new moderator)
UPDATE users SET role_id = 3 WHERE role_id >= 5 AND role_id < 99;

-- Handle any users with role_id >= 3 (old staff level) -> map to role_id 3 (new moderator)
-- This is already handled by the previous step

-- Step 3: Update the roles table to reflect new structure
-- Clear existing roles and insert new ones
TRUNCATE TABLE roles;

INSERT INTO roles (role_id, role_name, description) VALUES
(0, 'guest', 'Non-logged in user'),
(1, 'member', 'Default member user'),
(3, 'moderator', 'Can moderate content within communities'),
(4, 'admin', 'Can manage communities and events'),
(5, 'super_admin', 'Full system access and management')
ON DUPLICATE KEY UPDATE
    role_name = VALUES(role_name),
    description = VALUES(description);

-- Reset AUTO_INCREMENT to prevent future conflicts
ALTER TABLE roles AUTO_INCREMENT = 6;

-- Commit the transaction
COMMIT;

-- Verification queries (run these after migration to verify success)
-- SELECT role_id, role_name, description FROM roles ORDER BY role_id;
-- SELECT role_id, COUNT(*) as user_count FROM users GROUP BY role_id ORDER BY role_id;
-- SELECT COUNT(*) as ambassadors_with_role FROM ambassadors WHERE community_role IS NOT NULL;
