# Database Tables

Documentation of current tables. Defaults are based on MySQL 8 (utf8mb4_0900_ai_ci) and the schemas presently in use.

## users
- **Purpose:** Core identity row for each member.
- **Primary key:** `user_id INT AUTO_INCREMENT`.
- **Columns (selected)**
  - `role_id BIGINT` — FK to `roles.role_id`.
  - `recent_university_id INT` — FK to `communities.id`, nullable.
  - `first_name VARCHAR(50)`, `last_name VARCHAR(50)` — required.
  - `email VARCHAR(100)` — unique.
  - `phone VARCHAR(15)` — optional.
  - `password_hash TEXT`.
  - `education_status VARCHAR(100)` — default `'Prospect'`.
  - `is_over_18 TINYINT(1)` — default `0`.
  - `headline VARCHAR(255)` — default `''`.
  - `about TEXT`, `skills TEXT`.
  - `avatar_path VARCHAR(255)` — default `'/uploads/avatars/default-avatar.png'`.
  - `banner_path VARCHAR(255)` — default `'/uploads/banners/default-banner.jpg'`.
  - `primary_color VARCHAR(7)` — default `'#0077B5'`.
  - `secondary_color VARCHAR(7)` — default `'#005f8d'`.
  - `verified TINYINT(1)` — default `0`.
  - `verified_community_id INT` — FK to `communities.id`, nullable.
  - `is_ambassador TINYINT(1)` — default `0`.
  - `follower_count INT` — default `0`.
  - `following_count INT` — default `0`.
  - `login_count INT` — default `0`.
  - `verification_code INT` — nullable.
  - `is_verified TINYINT(1)` — default `0`.
  - `is_public TINYINT(1)` — default `1`.
  - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
  - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
- **Indexes / constraints**
  - Unique: `email`.
  - FKs: `role_id` → `roles.role_id` (CASCADE); `recent_university_id` → `communities.id` (SET NULL); `verified_community_id` → `communities.id` (SET NULL).

## account_settings
- **Purpose:** Per-user preferences for privacy, notifications, security, feed, and role-specific controls.
- **Primary key:** `user_id INT` (FK to `users.user_id` ON DELETE CASCADE).
- **Columns**
  - Timestamps: `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
  - Profile/privacy: `profile_visibility ENUM('network','followers','private') DEFAULT 'network'`; `show_online TINYINT(1) DEFAULT 1`; `allow_messages_from ENUM('followers','campus','everyone') DEFAULT 'followers'`; `show_email TINYINT(1) DEFAULT 0`; `discoverable TINYINT(1) DEFAULT 1`.
  - Notifications: `notif_in_app`, `notif_email`, `notif_mentions`, `notif_replies`, `notif_messages`, `notif_community_announcements`, `notif_weekly_digest` (all TINYINT(1), default 1).
  - Security: `security_2fa TINYINT(1) DEFAULT 0`; `login_alerts TINYINT(1) DEFAULT 1`; `session_timeout_minutes INT DEFAULT 30`; `trusted_devices_only TINYINT(1) DEFAULT 0`.
  - Feed/content: `default_feed ENUM('yourFeed','explore','info') DEFAULT 'yourFeed'`; `autoplay_media TINYINT(1) DEFAULT 0`; `open_links_new_tab TINYINT(1) DEFAULT 1`; `prioritize_followed TINYINT(1) DEFAULT 1`; `show_events TINYINT(1) DEFAULT 1`.
  - Community: `auto_join_campus TINYINT(1) DEFAULT 1`; `allow_invites TINYINT(1) DEFAULT 1`; `show_achievements TINYINT(1) DEFAULT 1`; `hide_nsfw TINYINT(1) DEFAULT 1`.
  - Moderation (for moderator roles): `mod_escalate_reports TINYINT(1) DEFAULT 1`; `mod_lock_threads TINYINT(1) DEFAULT 0`; `mod_approve_new_members TINYINT(1) DEFAULT 1`.
  - Ambassador: `amb_spotlight_feed TINYINT(1) DEFAULT 1`; `amb_dm_office_hours TINYINT(1) DEFAULT 1`; `amb_reply_templates TINYINT(1) DEFAULT 0`.
  - Admin: `admin_maintenance_mode TINYINT(1) DEFAULT 0`; `admin_require_sso TINYINT(1) DEFAULT 0`; `admin_enable_analytics TINYINT(1) DEFAULT 1`.
  - Data controls: `last_export_requested_at DATETIME NULL`; `deactivated_at DATETIME NULL`.
  - Extensibility: `extras JSON DEFAULT (JSON_OBJECT())`.

## all_community_data (view)
- **Purpose:** Aggregated community info with follower counts.
- **Definition:** `SELECT c.id AS community_id, c.community_type, c.name, c.location, c.tagline, c.logo_path, COUNT(fc.user_id) AS followers_count FROM communities c LEFT JOIN followed_communities fc ON fc.community_id = c.id GROUP BY c.id, c.community_type, c.name, c.location, c.tagline, c.logo_path;`
- **Notes:** Read-only view; follower count uses LEFT JOIN so communities with zero followers are included.

## ambassadors
- **Purpose:** Map ambassadors to communities.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Constraints:** UNIQUE (`user_id`,`community_id`); FK `user_id` → `users.user_id` (CASCADE); FK `community_id` → `communities.id` (CASCADE).
- **Columns:** `user_id INT`; `community_id INT`; `added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## audit_logs
- **Purpose:** Track user actions for auditing.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id` CASCADE); `action VARCHAR(255)`; `timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## blocks
- **Purpose:** Content blocks within threads.
- **Primary key:** `block_id INT AUTO_INCREMENT`.
- **Columns:** `thread_id INT` (FK `threads.thread_id` CASCADE); `block_type VARCHAR(50)`; `content TEXT`; `media_url VARCHAR(255)`; `position INT`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## communities
- **Purpose:** Core community records (university or group).
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `community_type ENUM('university','group')`; `name VARCHAR(100)` UNIQUE; `location VARCHAR(255)`; `website VARCHAR(255)`; `tagline VARCHAR(150)`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`; `logo_path VARCHAR(255)`; `primary_color VARCHAR(100)`; `secondary_color VARCHAR(100)`; `banner_path VARCHAR(255)`.

## community_admins
- **Purpose:** Whitelist of admin emails per community.
- **Primary key:** (`community_id`,`user_email`).
- **Columns:** `community_id INT` (FK `communities.id`); `user_email VARCHAR(100)` (FK `users.email`).

## community_creation_requests
- **Purpose:** Queue of requested communities pending approval.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `user_email VARCHAR(100)` (FK `users.email` CASCADE ON UPDATE); `name VARCHAR(100)`; `community_type VARCHAR(50)`; `description TEXT`; `status ENUM('pending','approved','rejected') DEFAULT 'pending'`; `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`; optional `tagline`, `location`, `website`, `primary_color`, `secondary_color`.

## community_forums_list (view)
- **Purpose:** Forums with pin state per community.
- **Definition:** `SELECT f.forum_id, f.community_id, f.name, f.description, f.upvotes, f.downvotes, f.created_at, p.pinned_at, (p.id IS NOT NULL) AS is_pinned FROM forums f LEFT JOIN pinned_items p ON f.forum_id = p.item_id AND p.item_type = 'forum' AND f.community_id = p.community_id;`

## community_posts_list (view)
- **Purpose:** Posts with community context and pin state.
- **Definition:** Join posts → threads → forums plus pinned_items for posts in same community; exposes post/community/thread/user/vote counts, reply/verification, pinned flag and timestamp.

## community_threads_list (view)
- **Purpose:** Threads with community context and pin state.
- **Definition:** `SELECT t.thread_id, f.community_id, t.forum_id, t.user_id, t.title, t.created_at, t.upvotes, t.downvotes, p.pinned_at, (p.id IS NOT NULL) AS is_pinned FROM threads t JOIN forums f ON t.forum_id = f.forum_id LEFT JOIN pinned_items p ON t.thread_id = p.item_id AND p.item_type = 'thread' AND f.community_id = p.community_id;`

## connections
- **Purpose:** User-to-user connections with status.
- **Primary key:** `connection_id INT AUTO_INCREMENT`.
- **Constraints:** UNIQUE (`user_id1`,`user_id2`); FKs `user_id1`, `user_id2` → `users.user_id` (CASCADE).
- **Columns:** `user_id1 INT`; `user_id2 INT`; `status ENUM('pending','accepted','declined') DEFAULT 'pending'`; `requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `accepted_at TIMESTAMP NULL`.

## educational_experience
- **Purpose:** User education history tied to a community (university).
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id` CASCADE); `community_id INT` (FK `communities.id` CASCADE); `major VARCHAR(100)`; `degree VARCHAR(100)`; `start_date DATE`; `end_date DATE`; `description TEXT`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## followed_communities
- **Purpose:** Follow relationships between users and communities.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id` CASCADE); `community_id INT` (FK `communities.id` CASCADE); `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- **Indexes:** (`user_id`,`community_id`) for fast existence checks.

## forum_tags
- **Purpose:** Many-to-many between forums and tags.
- **Primary key:** (`forum_id`,`tag_id`).
- **Columns:** `forum_id INT` (FK `forums.forum_id` CASCADE); `tag_id INT` (FK `tags.tag_id` CASCADE).

## forum_votes
- **Purpose:** Votes on forums.
- **Primary key:** `vote_id INT AUTO_INCREMENT`.
- **Columns:** `forum_id INT` (FK `forums.forum_id` CASCADE); `user_id INT` (FK `users.user_id` CASCADE); `vote_type ENUM('up','down')`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## forums
- **Purpose:** Discussion forums scoped to a community.
- **Primary key:** `forum_id INT AUTO_INCREMENT`.
- **Columns:** `community_id INT` (FK `communities.id` CASCADE/UPDATE); `name VARCHAR(255)`; `description TEXT`; `upvotes INT DEFAULT 0`; `downvotes INT DEFAULT 0`; `created_at DATETIME`; `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`; `last_activity_at TIMESTAMP`; `is_locked TINYINT(1) DEFAULT 0`; `is_pinned TINYINT(1) DEFAULT 0`.
- **Indexes:** `idx_forums_last_activity` on `is_pinned`, `last_activity_at`, `forum_id`.

## messages
- **Purpose:** Direct messages between users.
- **Primary key:** `message_id INT AUTO_INCREMENT`.
- **Columns:** `sender_id INT` (FK `users.user_id` CASCADE); `recipient_id INT` (FK `users.user_id` CASCADE); `conversation_id INT NULL`; `content TEXT`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`; `is_read TINYINT(1) DEFAULT 0`.

## notifications
- **Purpose:** User notifications for social/activity events.
- **Primary key:** `notification_id INT AUTO_INCREMENT`.
- **Columns:** `recipient_user_id INT` (FK `users.user_id` CASCADE); `actor_user_id INT NULL` (FK `users.user_id` SET NULL); `notification_type ENUM('follow','upvote','downvote','reply','message','connection')`; `reference_id INT`; `message TEXT`; `is_read TINYINT(1) DEFAULT 0`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## pinned_items
- **Purpose:** Generic pinning registry for forums/threads/posts per community.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `community_id INT`; `item_type ENUM('forum','thread','post')`; `item_id INT`; `pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- **Indexes:** `community_id`; `item_type,item_id`.

## post_votes
- **Purpose:** Votes on posts.
- **Primary key:** `vote_id INT AUTO_INCREMENT`.
- **Columns:** `post_id INT` (FK `posts.post_id` CASCADE); `user_id INT` (FK `users.user_id` CASCADE); `vote_type ENUM('up','down')`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## posts
- **Purpose:** Posts within threads.
- **Primary key:** `post_id INT AUTO_INCREMENT`.
- **Columns:** `thread_id INT` (FK `threads.thread_id` CASCADE); `user_id INT` (FK `users.user_id` CASCADE); `content TEXT`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`; `upvotes INT DEFAULT 0`; `downvotes INT DEFAULT 0`; `reply_to INT NULL` (self-FK CASCADE/UPDATE); `verified TINYINT(1) DEFAULT 0`; `verified_by INT`; `verified_at TIMESTAMP NULL`.

## roles
- **Purpose:** Role definitions (admin/mod/member, etc.).
- **Primary key:** `role_id BIGINT AUTO_INCREMENT`.
- **Columns:** `role_name VARCHAR(50)` UNIQUE; `description TEXT`.

## saved_forums
- **Purpose:** User-saved forums.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Constraints:** UNIQUE (`user_id`,`forum_id`); FKs `user_id` → `users.user_id` (CASCADE), `forum_id` → `forums.forum_id` (CASCADE).
- **Columns:** `user_id INT`; `forum_id INT`; `saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## saved_posts
- **Purpose:** User-saved posts.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Constraints:** UNIQUE (`user_id`,`post_id`); FKs `user_id` → `users.user_id` (CASCADE), `post_id` → `posts.post_id` (CASCADE).
- **Columns:** `user_id INT`; `post_id INT`; `saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## saved_threads
- **Purpose:** User-saved threads.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Constraints:** UNIQUE (`user_id`,`thread_id`); FKs `user_id` → `users.user_id` (CASCADE), `thread_id` → `threads.thread_id` (CASCADE).
- **Columns:** `user_id INT`; `thread_id INT`; `saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## tags
- **Purpose:** Tags for forums/threads.
- **Primary key:** `tag_id INT AUTO_INCREMENT`.
- **Columns:** `name VARCHAR(50)` UNIQUE; `slug VARCHAR(60)` generated from name; `color_hex CHAR(7)` with regex check; `is_active TINYINT(1) DEFAULT 1`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `type ENUM('general','forum','thread') DEFAULT 'general'`; `community_id INT NULL` (FK `communities.id` CASCADE).
- **Constraints/Indexes:** Unique on `name`, `(community_id,name)`, and `slug`; indexes on active/type/slug.

## thread_tags
- **Purpose:** Many-to-many between threads and tags.
- **Primary key:** (`thread_id`,`tag_id`).
- **Columns:** `thread_id INT` (FK `threads.thread_id` CASCADE); `tag_id INT` (FK `tags.tag_id` CASCADE).

## thread_votes
- **Purpose:** Votes on threads.
- **Primary key:** `vote_id INT AUTO_INCREMENT`.
- **Columns:** `thread_id INT` (FK `threads.thread_id` CASCADE); `user_id INT` (FK `users.user_id` CASCADE); `vote_type ENUM('up','down')`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.

## threads
- **Purpose:** Threads within forums.
- **Primary key:** `thread_id INT AUTO_INCREMENT`.
- **Columns:** `forum_id INT` (FK `forums.forum_id` CASCADE); `user_id INT` (FK `users.user_id` CASCADE); `title VARCHAR(255)`; `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `upvotes INT DEFAULT 0`; `downvotes INT DEFAULT 0`; `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`; `last_activity_at TIMESTAMP`; `reply_count INT DEFAULT 0`; `is_locked TINYINT(1) DEFAULT 0`; `status ENUM('open','resolved','archived') DEFAULT 'open'`.
- **Indexes:** `idx_threads_forum_sort` on `forum_id,last_activity_at`; `idx_threads_last_activity` on `is_locked,last_activity_at,thread_id`.

## user_education
- **Purpose:** Educational entries (general, not tied to community).
- **Primary key:** `education_id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id`); `degree VARCHAR(255)`; `field_of_study VARCHAR(255)`; `gpa DECIMAL(3,2)`; `honors VARCHAR(255)`; `activities_societies TEXT`; `achievements JSON`; `institution VARCHAR(255)`; `start_date DATE`; `end_date DATE`; `duration VARCHAR(100)`.

## user_experience
- **Purpose:** Work/experience entries.
- **Primary key:** `experience_id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id`); `title VARCHAR(255)`; `company VARCHAR(255)`; `industry VARCHAR(255)`; `employment_type ENUM('Full-time','Part-time','Contract','Internship','Volunteer','Seasonal')`; `start_date DATE`; `end_date DATE`; `location_city/state/country VARCHAR(100)`; `duration VARCHAR(100)`; `description TEXT`; `responsibilities JSON`.

## user_follows
- **Purpose:** User-to-user follows.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `follower_id INT` (FK `users.user_id` CASCADE); `followed_user_id INT` (FK `users.user_id` CASCADE); `followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- **Indexes:** (`follower_id`,`followed_user_id`) for uniqueness checks.

## user_profiles (view)
- **Purpose:** Convenience view for user profile data plus role/community and ambassador communities.
- **Definition:** Selects core `users` columns, joins `communities` for `recent_university_id`, joins `roles` for `role_name`, and aggregates ambassador community IDs into JSON via `ambassadors`.

## verified_users
- **Purpose:** Records users verified within a community.
- **Primary key:** `id INT AUTO_INCREMENT`.
- **Columns:** `user_id INT` (FK `users.user_id` CASCADE); `community_id INT` (FK `communities.id` CASCADE); `verified_by INT NULL` (FK `users.user_id` SET NULL); `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
