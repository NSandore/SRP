# Roles and Permissions

This document describes the role hierarchy and how to use it across the codebase.

## Role Hierarchy

Role IDs are canonical and must match both backend and frontend:

- 0: guest (non-logged in)
- 1: member (default)
- 3: moderator (can moderate content)
- 4: admin (can manage communities and events)
- 5: super_admin (full system access)

These values are defined in:

- Backend: `backend/includes/roles.php`
- Frontend: `frontend/src/constants/roles.js`

## Backend Usage

Always use the role helpers instead of hardcoded IDs:

- `isSuperAdmin($role_id)`
- `isAdmin($role_id)`
- `isModerator($role_id)`
- `isAdminOrSuperAdmin($role_id)`
- `canManageForums($user_id, $role_id, $community_id, $db)`
- `canModerateContent($user_id, $role_id, $community_id, $db)`

These live in `backend/includes/permissions.php` and depend on the constants in
`backend/includes/roles.php`.

### Ambassador Roles

The `ambassadors` table includes a `community_role` column with values:

- `member`
- `admin`

Ambassador roles are community-scoped and are used alongside global roles. For
example, community ambassadors can manage content for their own community even
if they are not admins globally.

## Frontend Usage

Use helper functions from `frontend/src/constants/roles.js`:

- `isSuperAdmin(roleId)`
- `isAdmin(roleId)`
- `isModerator(roleId)`
- `getRoleLabel(roleId)`

Avoid hardcoded comparisons like `role_id === 1` or `role_id >= 7`.

## Database Notes

The roles table is seeded with fixed IDs as part of the role system migration.
Role IDs should never be changed without a data migration and corresponding code
updates.

Migration script: `docs/role_system_migration.sql`

## Guidelines

- Do not introduce new role checks with magic numbers.
- Always use the helper functions/constants.
- Keep backend and frontend role definitions in sync.
- If a new role is added, update `backend/includes/roles.php`, `backend/includes/permissions.php`, `frontend/src/constants/roles.js`, `docs/role_system_migration.sql`, and this document.
