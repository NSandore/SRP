<?php
/**
 * Role System Constants
 *
 * This file defines the role hierarchy for the application.
 * DO NOT MODIFY these values without running the corresponding database migration.
 *
 * Role Hierarchy:
 * 0 = Guest (non-logged in user)
 * 1 = Member (default for new users)
 * 3 = Moderator (can moderate content)
 * 4 = Admin (can manage communities and events)
 * 5 = Super Admin (full system access)
 */

// Role ID constants - DO NOT MODIFY these values
const ROLE_GUEST = 0;        // Non-logged in user
const ROLE_MEMBER = 1;       // Default member
const ROLE_MODERATOR = 3;    // Can moderate content
const ROLE_ADMIN = 4;        // Can manage communities/events
const ROLE_SUPER_ADMIN = 5;  // Full system access

// Role name constants
const ROLE_NAME_GUEST = 'guest';
const ROLE_NAME_MEMBER = 'member';
const ROLE_NAME_MODERATOR = 'moderator';
const ROLE_NAME_ADMIN = 'admin';
const ROLE_NAME_SUPER_ADMIN = 'super_admin';
