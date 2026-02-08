/**
 * Role System Constants
 *
 * These constants define the role hierarchy for the application.
 * IMPORTANT: These values MUST match the backend role constants in backend/includes/roles.php
 *
 * Role Hierarchy:
 * 0 = Guest (non-logged in user)
 * 1 = Member (default for new users)
 * 3 = Moderator (can moderate content)
 * 4 = Admin (can manage communities and events)
 * 5 = Super Admin (full system access)
 */

// Role ID constants - DO NOT MODIFY these values
export const ROLE_GUEST = 0;
export const ROLE_MEMBER = 1;
export const ROLE_MODERATOR = 3;
export const ROLE_ADMIN = 4;
export const ROLE_SUPER_ADMIN = 5;

/**
 * Check if user is a super admin
 * @param {number|string} roleId - The user's role ID
 * @returns {boolean} True if user is super admin
 */
export const isSuperAdmin = (roleId) => Number(roleId) === ROLE_SUPER_ADMIN;

/**
 * Check if user is an admin or higher
 * @param {number|string} roleId - The user's role ID
 * @returns {boolean} True if user is admin or super admin
 */
export const isAdmin = (roleId) => Number(roleId) >= ROLE_ADMIN;

/**
 * Check if user is a moderator or higher
 * @param {number|string} roleId - The user's role ID
 * @returns {boolean} True if user is moderator, admin, or super admin
 */
export const isModerator = (roleId) => Number(roleId) >= ROLE_MODERATOR;

/**
 * Get human-readable label for a role ID
 * @param {number|string} roleId - The user's role ID
 * @returns {string} The role label
 */
export const getRoleLabel = (roleId) => {
  const role = Number(roleId);
  if (role === ROLE_SUPER_ADMIN) return 'Super Admin';
  if (role === ROLE_ADMIN) return 'Admin';
  if (role === ROLE_MODERATOR) return 'Moderator';
  return 'Member';
};
