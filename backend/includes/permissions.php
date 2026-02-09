<?php
/**
 * Permission Helper Functions
 *
 * Centralized permission checking logic for the application.
 * All role-based permission checks should use these functions instead of
 * hardcoded role_id comparisons.
 */

require_once __DIR__ . '/roles.php';

/**
 * Check if user is a super admin
 * @param int $role_id The user's role ID
 * @return bool True if user is super admin
 */
function isSuperAdmin($role_id) {
    return (int)$role_id === ROLE_SUPER_ADMIN;
}

/**
 * Check if user is an admin or higher
 * @param int $role_id The user's role ID
 * @return bool True if user is admin or super admin
 */
function isAdmin($role_id) {
    return (int)$role_id >= ROLE_ADMIN;
}

/**
 * Check if user is a moderator or higher
 * @param int $role_id The user's role ID
 * @return bool True if user is moderator, admin, or super admin
 */
function isModerator($role_id) {
    return (int)$role_id >= ROLE_MODERATOR;
}

/**
 * Alias for isAdmin() - checks if user is admin or super admin
 * @param int $role_id The user's role ID
 * @return bool True if user is admin or super admin
 */
function isAdminOrSuperAdmin($role_id) {
    return isAdmin($role_id);
}

/**
 * Check whether a user has a verified email.
 */
function hasVerifiedEmail($user_id, $db): bool {
    $stmt = $db->prepare("SELECT is_verified FROM users WHERE user_id = :uid LIMIT 1");
    $stmt->execute([':uid' => $user_id]);
    return (int)$stmt->fetchColumn() === 1;
}

/**
 * Normalize ambassador community role values.
 * Accepts legacy values to avoid breaking existing rows.
 *
 * @param mixed $role
 * @return string
 */
function normalizeCommunityRole($role): string {
    $value = strtolower(trim((string)$role));
    if ($value === 'admin') return 'admin';
    if ($value === 'moderator') return 'moderator';
    // Legacy compatibility: treat member as moderator-level ambassador.
    if ($value === 'member') return 'moderator';
    return '';
}

/**
 * Fetch ambassador community role for a user in a community.
 *
 * @param string $user_id
 * @param string $community_id
 * @param PDO $db
 * @return string Empty string when not an ambassador
 */
function getCommunityRole($user_id, $community_id, $db): string {
    $stmt = $db->prepare("SELECT community_role FROM ambassadors WHERE user_id = :uid AND community_id = :cid LIMIT 1");
    $stmt->execute([':uid' => $user_id, ':cid' => $community_id]);
    return normalizeCommunityRole($stmt->fetchColumn());
}

/**
 * Check if user can manage forums in a specific community
 * Requires either super admin role OR ambassador admin role for the community
 *
 * @param string $user_id The user's ID
 * @param int $role_id The user's role ID
 * @param string $community_id The community ID
 * @param PDO $db Database connection
 * @return bool True if user can manage forums
 */
function canManageForums($user_id, $role_id, $community_id, $db) {
    if (!hasVerifiedEmail($user_id, $db)) {
        return false;
    }

    // Super admins can manage all forums
    if (isSuperAdmin($role_id)) {
        return true;
    }

    // Check if user is ambassador admin for this community
    return getCommunityRole($user_id, $community_id, $db) === 'admin';
}

/**
 * Check if user can moderate content in a specific community
 * Requires either moderator+ role OR ambassador status for the community
 *
 * @param string $user_id The user's ID
 * @param int $role_id The user's role ID
 * @param string $community_id The community ID
 * @param PDO $db Database connection
 * @return bool True if user can moderate content
 */
function canModerateContent($user_id, $role_id, $community_id, $db) {
    // Moderators, admins, and super admins can moderate all content
    if (isModerator($role_id)) {
        return true;
    }

    // Ambassadors with community moderation role for this community.
    return in_array(getCommunityRole($user_id, $community_id, $db), ['admin', 'moderator'], true);
}

/**
 * Check if user is an ambassador admin for a specific community
 *
 * @param string $user_id The user's ID
 * @param string $community_id The community ID
 * @param PDO $db Database connection
 * @return bool True if user is ambassador admin
 */
function isAmbassadorAdmin($user_id, $community_id, $db) {
    return getCommunityRole($user_id, $community_id, $db) === 'admin';
}

/**
 * Check if user is an ambassador (any role) for a specific community
 *
 * @param string $user_id The user's ID
 * @param string $community_id The community ID
 * @param PDO $db Database connection
 * @return bool True if user is an ambassador
 */
function isAmbassador($user_id, $community_id, $db) {
    return getCommunityRole($user_id, $community_id, $db) !== '';
}

/**
 * Admin-only community settings permissions.
 */
function canEditCommunitySettings($user_id, $role_id, $community_id, $db) {
    if (!hasVerifiedEmail($user_id, $db)) return false;
    if (isSuperAdmin($role_id)) return true;
    return getCommunityRole($user_id, $community_id, $db) === 'admin';
}

/**
 * Admin-only ambassador management permissions.
 */
function canManageAmbassadors($user_id, $role_id, $community_id, $db) {
    if (!hasVerifiedEmail($user_id, $db)) return false;
    if (isSuperAdmin($role_id)) return true;
    return getCommunityRole($user_id, $community_id, $db) === 'admin';
}

/**
 * Moderator+ community moderation permissions (content/report workflows).
 */
function canModerateCommunityContent($user_id, $role_id, $community_id, $db) {
    if (isSuperAdmin($role_id)) return true;
    return in_array(getCommunityRole($user_id, $community_id, $db), ['admin', 'moderator'], true);
}
