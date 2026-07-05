# Roles and Permissions

This document describes the permission model that is currently implemented in
the platform. The important point is that there is not one single role system.
There are four separate layers that interact:

1. Global role IDs on `users.role_id`
2. Community-scoped ambassador roles on `ambassadors.community_role`
3. Email verification on `users.is_verified`
4. Community/user verification badge state on `users.verified` and
   `users.verified_community_id`

## Canonical Global `role_id` Values

These role IDs are the canonical values used by backend, web, and mobile:

| `role_id` | Name | Meaning |
| --- | --- | --- |
| `0` | guest | Not logged in |
| `1` | member | Default logged-in user |
| `3` | moderator | Global moderation role |
| `4` | admin | Global admin role |
| `5` | super_admin | Full system access |

Notes:

- `2` is intentionally unused in the current role hierarchy.
- `isModerator(role_id)` means `role_id >= 3`.
- `isAdmin(role_id)` means `role_id >= 4`.
- `isSuperAdmin(role_id)` means `role_id === 5`.

Source of truth:

- Backend constants: `backend/includes/roles.php`
- Backend helpers: `backend/includes/permissions.php`
- Web constants: `frontend/src/constants/roles.js`
- Mobile constants: `mobile/constants/roles.ts`
- Migration: `docs/role_system_migration.sql`

## Community Ambassador Roles

The `ambassadors` table adds community-scoped permissions on top of the global
`role_id`.

Documented/schema-backed values:

| `ambassadors.community_role` | Meaning |
| --- | --- |
| `member` | Default ambassador membership |
| `admin` | Community ambassador admin |

What the permission helper currently normalizes:

| Stored value | Normalized value in `getCommunityRole()` |
| --- | --- |
| `admin` | `admin` |
| `moderator` | `moderator` |
| `member` | `moderator` |

This means the helper layer currently treats `member` ambassadors as
moderator-level ambassadors for helper-based moderation checks.

Important caveat:

- The schema and migration only define `member` and `admin`.
- Some direct SQL checks look for literal `moderator` rows.
- As a result, "ambassador moderator" is partially supported in code, but not
  fully represented in the documented schema.

## Verification Flags

There are two different "verified" concepts in the platform.

### 1. Email Verification

Field: `users.is_verified`

This is the email/account verification flag. It is set by
`backend/public/verify_user.php`.

What it is used for:

- Completing email verification during signup/onboarding
- Unlocking management actions that explicitly require
  `hasVerifiedEmail($user_id, $db)`
- Removing the unverified daily posting limit in onboarding logic

### 2. Community/User Verification Badge

Fields:

- `users.verified`
- `users.verified_community_id`

This is a separate badge-like verification that is approved through
`user_verification_requests` and reviewed by a super admin.

What it is used for:

- Showing a "Verified" badge on profiles
- Associating that badge with a community/university
- Marking author records as verified in feed/thread queries

Important distinction:

- `is_verified` controls email/account verification and some permission gates.
- `verified` controls profile/community verification badges.
- They are not interchangeable.

## Session / Client Permission Fields

The session and client payloads expose several permission-related fields:

| Field | Meaning | Where it comes from |
| --- | --- | --- |
| `role_id` | Global role level | `users.role_id` |
| `is_ambassador` | Boolean flag for any ambassador membership | Derived from ambassador rows |
| `admin_community_ids` | Communities where the user is an ambassador `admin` | Populated at login / 2FA from `ambassadors.community_role = 'admin'` |
| `ambassador_communities` | Community list with `community_role` | Derived in `check_session.php` |
| `is_verified` | Email verified | `users.is_verified` |
| `verified` | Profile/community verified badge | `users.verified` |
| `verified_community_id` | Community backing the verification badge | `users.verified_community_id` |

## Global Role Matrix

This table describes the intended helper-level meaning of each global role.
Actual endpoint enforcement is more mixed, so use the feature matrix below for
real platform behavior.

| Global level | Core helper meaning | `isModerator()` | `isAdmin()` | Can create global announcements | Can review user verification requests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Guest (`0`) | Limited public/guest access only | No | No | No | No | Not logged in |
| Member (`1`) | Default logged-in user | No | No | No | No | Default user |
| Moderator (`3`) | Moderator-level global role | Yes | No | No | No | Not all moderation endpoints honor this directly |
| Admin (`4`) | Admin-level global role | Yes | Yes | No | No | Not all community-management endpoints honor this directly |
| Super admin (`5`) | Full system role | Yes | Yes | Yes | Yes | Full access |

## Permission Matrix By Ambassador Level

This table describes community-scoped behavior.

| Community scope | Manage forums in that community | Edit community settings | Manage ambassadors | Moderate community content | Verify posts in that community | Pin/unpin community items | Publish community announcements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| No ambassador role | No | No | No | No | No | No | No |
| Ambassador `member` | No | No | No | Yes in helper-based checks | Yes in helper-based checks | Yes | No |
| Ambassador `admin` | Yes, requires verified email | Yes, requires verified email | Yes, requires verified email | Yes | Yes | Yes | Yes |
| Ambassador `moderator` | Intended yes for moderation-only flows | No | No | Yes | Yes | Yes if treated as ambassador | Not granted by current checks |

Notes:

- `member` ambassadors are the default schema value.
- `admin` ambassadors are the only ambassador level included in
  `admin_community_ids`.
- `moderator` is recognized by helper code, but is not part of the documented
  migration/schema and is not assigned by the current promotion flow.

## Usage Matrix In The Platform

The following matrix summarizes the main permissioned features and what unlocks
them in the current implementation.

| Feature / endpoint | Guest | Member | Verified email only | Ambassador `member` | Ambassador `admin` | Global moderator | Global admin | Super admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create forum | No | No | No | No | Yes | No | No | Yes |
| Edit forum | No | No | No | No | Yes | No | No | Yes |
| Delete forum | No | No | No | No | No | No | No | Yes, also requires verified email |
| Create thread in a forum | No | No | No | No | Yes | No | No | Yes |
| Edit/delete thread | No | Own only | Own only | Own only unless also community admin | Own plus community scope | Own only | Own only | Yes |
| Edit post | No | Own only | Own only | Yes, any ambassador | Yes, any ambassador admin | No special global grant in this endpoint | No special global grant in this endpoint | Yes |
| Moderate reports | No | No | No | Yes via helper-based resolve flow, but report queue fetch is inconsistent | Yes | No | No | Yes |
| Verify / unverify posts | No | No | No | Yes in community scope | Yes | No | No | Yes |
| Create/update events | No | No | No | Yes | Yes | No | Yes | Yes |
| Delete event | No | Existing event owner only | Existing event owner only | Yes | Yes | Existing event owner only | Yes | Yes |
| Use Zoom event tools | No | No | No | Yes | Yes | No special moderator path | Yes | Yes |
| Create community announcements | No | No | No | No | Yes | No | No | Yes |
| Create top-level community | No | No | No | No | No | No | No | Yes, requires verified email |
| Create sub-community under parent | No | No | No | No | Yes for parent community, requires verified email | No | No | Yes |
| Promote/remove ambassadors | No | No | No | No | Yes, requires verified email | No | No | Yes |
| Review verification requests | No | No | No | No | No | No | No | Yes |

## Verified User Matrix

This table separates "verified email" from "verified profile/community badge".

| State | Stored as | What it changes |
| --- | --- | --- |
| Email verified | `users.is_verified = 1` | Enables email-gated management actions and removes the unverified post cap |
| Community/profile verified | `users.verified = 1` | Adds profile/feed "Verified" treatment and links the user to `verified_community_id` |
| Both | Both fields set | User has both the account-verification unlocks and the public verification badge |

## Current Implementation Caveats

These are important if you are using this document for product, admin, or
cleanup work.

### 1. Ambassador moderator support is inconsistent

- `backend/includes/permissions.php` accepts `moderator` and maps `member` to
  moderator-level behavior.
- `docs/role_system_migration.sql` and `docs/database-tables.md` only define
  `member` and `admin`.
- `backend/public/fetch_reported_items.php` only grants queue access to
  `community_role IN ('admin', 'moderator')`.
- Because of that mismatch, a default `member` ambassador can pass helper-based
  moderation checks, but may still fail some direct-SQL moderation screens.

### 2. Some ambassador checks are not community-scoped enough

- `backend/public/edit_post.php` allows any ambassador to edit posts, based on
  the session-wide `is_ambassador` flag rather than same-community scope.
- Event and Zoom management rely heavily on `is_ambassador` and
  `admin_community_ids`, so they behave more like "any ambassador" privileges
  than strict same-community permissions.

### 3. Global moderator/admin roles are not honored consistently

- The role hierarchy defines moderator (`3`) and admin (`4`) levels.
- However, report resolution and post verification rely on
  `canModerateCommunityContent()`, which is effectively super-admin-or-community
  ambassador scoped.
- In practice, a plain global moderator/admin account does not currently get
  broad community moderation powers from those endpoints.

### 4. Two different verified concepts exist

- `is_verified` is email verification.
- `verified` is the public/community verification badge.
- Any documentation, UI copy, or admin tooling should name these separately.

### 5. `admin_community_ids` is session-populated, not fully recalculated on `check_session`

- `check_session.php` recalculates `is_ambassador` and `ambassador_communities`.
- It does not recalculate `admin_community_ids`; that field is still read from
  the session payload.
- UI that depends on `admin_community_ids` may lag behind a role change until a
  fresh login/session refresh path updates it.

### 6. `verified_users` exists in schema docs but is not the active source of truth

- The active code uses `users.verified` and `users.verified_community_id`.
- The `verified_users` table appears in schema docs, but is not the main
  permission or profile-badge source used by current application code.

## Recommended Usage In Code

- Do not hardcode role numbers.
- Prefer helper functions in `backend/includes/permissions.php`.
- Keep backend, web, mobile, and migration definitions synchronized.
- If community moderator is intended to be a first-class role, update:
  - database schema
  - migrations
  - helper functions
  - direct SQL permission checks
  - this document
