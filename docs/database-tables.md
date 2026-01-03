# ************************************************************
# Sequel Ace SQL dump
# Version 20095
#
# https://sequel-ace.com/
# https://github.com/Sequel-Ace/Sequel-Ace
#
# Host: 172.16.11.133 (MySQL 8.0.44-0ubuntu0.24.04.1)
# Database: srp_db
# Generation Time: 2025-11-30 06:49:17 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
SET NAMES utf8mb4;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE='NO_AUTO_VALUE_ON_ZERO', SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Dump of table account_settings
# ------------------------------------------------------------

DROP TABLE IF EXISTS `account_settings`;

CREATE TABLE `account_settings` (
  `user_id` varchar(32) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_visibility` enum('network','followers','private') NOT NULL DEFAULT 'network',
  `show_online` tinyint(1) NOT NULL DEFAULT '1',
  `allow_messages_from` enum('followers','campus','everyone') NOT NULL DEFAULT 'followers',
  `show_email` tinyint(1) NOT NULL DEFAULT '0',
  `discoverable` tinyint(1) NOT NULL DEFAULT '1',
  `notif_in_app` tinyint(1) NOT NULL DEFAULT '1',
  `notif_email` tinyint(1) NOT NULL DEFAULT '1',
  `notif_mentions` tinyint(1) NOT NULL DEFAULT '1',
  `notif_replies` tinyint(1) NOT NULL DEFAULT '1',
  `notif_messages` tinyint(1) NOT NULL DEFAULT '1',
  `notif_community_announcements` tinyint(1) NOT NULL DEFAULT '1',
  `notif_weekly_digest` tinyint(1) NOT NULL DEFAULT '1',
  `security_2fa` tinyint(1) NOT NULL DEFAULT '0',
  `login_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `session_timeout_minutes` int NOT NULL DEFAULT '30',
  `trusted_devices_only` tinyint(1) NOT NULL DEFAULT '0',
  `default_feed` enum('yourFeed','explore','info') NOT NULL DEFAULT 'yourFeed',
  `autoplay_media` tinyint(1) NOT NULL DEFAULT '0',
  `open_links_new_tab` tinyint(1) NOT NULL DEFAULT '1',
  `prioritize_followed` tinyint(1) NOT NULL DEFAULT '1',
  `show_events` tinyint(1) NOT NULL DEFAULT '1',
  `auto_join_campus` tinyint(1) NOT NULL DEFAULT '1',
  `allow_invites` tinyint(1) NOT NULL DEFAULT '1',
  `show_achievements` tinyint(1) NOT NULL DEFAULT '1',
  `hide_nsfw` tinyint(1) NOT NULL DEFAULT '1',
  `mod_escalate_reports` tinyint(1) NOT NULL DEFAULT '1',
  `mod_lock_threads` tinyint(1) NOT NULL DEFAULT '0',
  `mod_approve_new_members` tinyint(1) NOT NULL DEFAULT '1',
  `amb_spotlight_feed` tinyint(1) NOT NULL DEFAULT '1',
  `amb_dm_office_hours` tinyint(1) NOT NULL DEFAULT '1',
  `amb_reply_templates` tinyint(1) NOT NULL DEFAULT '0',
  `admin_maintenance_mode` tinyint(1) NOT NULL DEFAULT '0',
  `admin_require_sso` tinyint(1) NOT NULL DEFAULT '0',
  `admin_enable_analytics` tinyint(1) NOT NULL DEFAULT '1',
  `last_export_requested_at` datetime DEFAULT NULL,
  `deactivated_at` datetime DEFAULT NULL,
  `extras` json NOT NULL DEFAULT (json_object()),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_account_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;





# Dump of table ambassadors
# ------------------------------------------------------------

DROP TABLE IF EXISTS `ambassadors`;

CREATE TABLE `ambassadors` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ambassador` (`user_id`,`community_id`),
  KEY `idx_ambassador_comm` (`community_id`),
  CONSTRAINT `fk_amb_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_ambassadors_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table announcement_dismissals
# ------------------------------------------------------------

DROP TABLE IF EXISTS `announcement_dismissals`;

CREATE TABLE `announcement_dismissals` (
  `id` varchar(32) NOT NULL,
  `announcement_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `dismissed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_announcement_dismissal` (`announcement_id`,`user_id`),
  KEY `idx_announcement_dismissals_user` (`user_id`),
  CONSTRAINT `fk_ann_dismissal_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table announcements
# ------------------------------------------------------------

DROP TABLE IF EXISTS `announcements`;

CREATE TABLE `announcements` (
  `announcement_id` varchar(32) NOT NULL,
  `community_id` varchar(32) DEFAULT NULL,
  `created_by` varchar(32) NOT NULL,
  `announcement_type` enum('general','maintenance','info','warning','urgent') DEFAULT 'general',
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `show_banner` tinyint(1) DEFAULT '0',
  `show_boolean` tinyint(1) DEFAULT '0',
  `show_login_overlay` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `is_dismissible` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`announcement_id`),
  KEY `idx_announcements_scope` (`community_id`,`is_active`,`starts_at`),
  KEY `idx_announcements_display` (`show_banner`,`show_boolean`,`show_login_overlay`),
  KEY `fk_ann_creator` (`created_by`),
  CONSTRAINT `fk_ann_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_announcements_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table audit_logs
# ------------------------------------------------------------

DROP TABLE IF EXISTS `audit_logs`;

CREATE TABLE `audit_logs` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `action` varchar(255) NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user` (`user_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table blocks
# ------------------------------------------------------------

DROP TABLE IF EXISTS `blocks`;

CREATE TABLE `blocks` (
  `block_id` varchar(32) NOT NULL,
  `thread_id` varchar(32) NOT NULL,
  `block_type` varchar(50) NOT NULL,
  `content` text,
  `media_url` varchar(255) DEFAULT NULL,
  `position` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`block_id`),
  KEY `idx_blocks_thread` (`thread_id`),
  CONSTRAINT `fk_blocks_thread` FOREIGN KEY (`thread_id`) REFERENCES `threads` (`thread_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table communities
# ------------------------------------------------------------

DROP TABLE IF EXISTS `communities`;

CREATE TABLE `communities` (
  `id` varchar(32) NOT NULL,
  `community_type` enum('university','group') NOT NULL,
  `name` varchar(100) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `tagline` varchar(150) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `logo_path` varchar(255) DEFAULT NULL,
  `primary_color` varchar(100) DEFAULT NULL,
  `secondary_color` varchar(100) DEFAULT NULL,
  `banner_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_communities_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table community_admins
# ------------------------------------------------------------

DROP TABLE IF EXISTS `community_admins`;

CREATE TABLE `community_admins` (
  `community_id` varchar(32) NOT NULL,
  `user_email` varchar(100) NOT NULL,
  PRIMARY KEY (`community_id`,`user_email`),
  KEY `idx_comm_admin_email` (`user_email`),
  CONSTRAINT `fk_comm_admin_user_email` FOREIGN KEY (`user_email`) REFERENCES `users` (`email`),
  CONSTRAINT `fk_community_admins_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table community_creation_requests
# ------------------------------------------------------------

DROP TABLE IF EXISTS `community_creation_requests`;

CREATE TABLE `community_creation_requests` (
  `id` varchar(32) NOT NULL,
  `user_email` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `community_type` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `tagline` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `primary_color` varchar(20) DEFAULT NULL,
  `secondary_color` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ccr_user_email` (`user_email`),
  CONSTRAINT `fk_ccr_user` FOREIGN KEY (`user_email`) REFERENCES `users` (`email`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table connections
# ------------------------------------------------------------

DROP TABLE IF EXISTS `connections`;

CREATE TABLE `connections` (
  `connection_id` varchar(32) NOT NULL,
  `user_id1` varchar(32) NOT NULL,
  `user_id2` varchar(32) NOT NULL,
  `status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`connection_id`),
  UNIQUE KEY `uq_connection_pair` (`user_id1`,`user_id2`),
  KEY `idx_connections_user1` (`user_id1`),
  KEY `idx_connections_user2` (`user_id2`),
  CONSTRAINT `fk_connections_user1` FOREIGN KEY (`user_id1`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_connections_user2` FOREIGN KEY (`user_id2`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table educational_experience
# ------------------------------------------------------------

DROP TABLE IF EXISTS `educational_experience`;

CREATE TABLE `educational_experience` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `major` varchar(100) DEFAULT NULL,
  `degree` varchar(100) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_edu_experience_comm` (`community_id`),
  KEY `idx_edu_experience_user` (`user_id`),
  CONSTRAINT `fk_educational_experience_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_eduexp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table event_registrations
# ------------------------------------------------------------

DROP TABLE IF EXISTS `event_registrations`;

CREATE TABLE `event_registrations` (
  `id` varchar(32) NOT NULL,
  `event_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `status` enum('registered','attended','cancelled','no_show') DEFAULT 'registered',
  `registered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `attended_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_registration` (`event_id`,`user_id`),
  KEY `idx_event_registrations_event` (`event_id`),
  KEY `idx_event_registrations_user` (`user_id`),
  CONSTRAINT `fk_event_reg_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`),
  CONSTRAINT `fk_event_reg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table events
# ------------------------------------------------------------

DROP TABLE IF EXISTS `events`;

CREATE TABLE `events` (
  `event_id` varchar(32) NOT NULL,
  `community_id` varchar(32) DEFAULT NULL,
  `created_by` varchar(32) NOT NULL,
  `event_type` enum('webinar') DEFAULT 'webinar',
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_at` datetime NOT NULL,
  `end_at` datetime DEFAULT NULL,
  `timezone` varchar(50) DEFAULT 'UTC',
  `is_virtual` tinyint(1) DEFAULT '1',
  `location` varchar(255) DEFAULT NULL,
  `meeting_provider` enum('zoom','teams','webex','other') DEFAULT 'zoom',
  `meeting_link` varchar(255) NOT NULL,
  `meeting_id` varchar(100) DEFAULT NULL,
  `passcode` varchar(100) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `requires_registration` tinyint(1) DEFAULT '1',
  `recording_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  KEY `idx_events_scope` (`community_id`,`start_at`),
  KEY `idx_events_type` (`event_type`,`start_at`),
  KEY `fk_events_creator` (`created_by`),
  CONSTRAINT `fk_events_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table followed_communities
# ------------------------------------------------------------

DROP TABLE IF EXISTS `followed_communities`;

CREATE TABLE `followed_communities` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_followed_communities` (`user_id`,`community_id`),
  KEY `idx_followed_comm` (`community_id`),
  CONSTRAINT `fk_followed_comm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_followed_communities_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table forum_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `forum_tags`;

CREATE TABLE `forum_tags` (
  `forum_id` varchar(32) NOT NULL,
  `tag_id` varchar(32) NOT NULL,
  PRIMARY KEY (`forum_id`,`tag_id`),
  KEY `idx_forum_tags_tag` (`tag_id`),
  KEY `idx_forum_tags_tag_forum` (`tag_id`,`forum_id`),
  CONSTRAINT `fk_forum_tags_forum` FOREIGN KEY (`forum_id`) REFERENCES `forums` (`forum_id`),
  CONSTRAINT `fk_forum_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table forum_votes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `forum_votes`;

CREATE TABLE `forum_votes` (
  `id` varchar(32) NOT NULL,
  `forum_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `vote_type` enum('up','down') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_forum_votes_forum` (`forum_id`),
  KEY `idx_forum_votes_user` (`user_id`),
  CONSTRAINT `fk_forum_votes_forum` FOREIGN KEY (`forum_id`) REFERENCES `forums` (`forum_id`),
  CONSTRAINT `fk_forum_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table forums
# ------------------------------------------------------------

DROP TABLE IF EXISTS `forums`;

CREATE TABLE `forums` (
  `forum_id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_activity_at` timestamp NULL DEFAULT NULL,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`forum_id`),
  KEY `idx_forums_community` (`community_id`),
  KEY `idx_forums_last_activity` (`is_pinned` DESC,`last_activity_at` DESC,`forum_id` DESC),
  CONSTRAINT `fk_forums_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table group_question_answers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `group_question_answers`;

CREATE TABLE `group_question_answers` (
  `answer_id` varchar(32) NOT NULL,
  `question_id` varchar(32) NOT NULL,
  `ambassador_id` varchar(32) NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`answer_id`),
  KEY `idx_gqa_question` (`question_id`),
  KEY `idx_gqa_ambassador` (`ambassador_id`),
  CONSTRAINT `fk_gqa_question` FOREIGN KEY (`question_id`) REFERENCES `group_questions` (`question_id`),
  CONSTRAINT `fk_gqa_user` FOREIGN KEY (`ambassador_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table group_questions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `group_questions`;

CREATE TABLE `group_questions` (
  `question_id` varchar(32) NOT NULL,
  `group_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` varchar(32) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`question_id`),
  KEY `idx_gq_group_status` (`group_id`,`status`),
  KEY `idx_gq_user` (`user_id`),
  KEY `idx_gq_approved_by` (`approved_by`),
  CONSTRAINT `fk_gq_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_gq_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_group_questions_community` FOREIGN KEY (`group_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table messages
# ------------------------------------------------------------

DROP TABLE IF EXISTS `messages`;

CREATE TABLE `messages` (
  `message_id` varchar(32) NOT NULL,
  `sender_id` varchar(32) NOT NULL,
  `recipient_id` varchar(32) NOT NULL,
  `conversation_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`message_id`),
  KEY `idx_messages_sender` (`sender_id`),
  KEY `idx_messages_recipient` (`recipient_id`),
  CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table notifications
# ------------------------------------------------------------

DROP TABLE IF EXISTS `notifications`;

CREATE TABLE `notifications` (
  `notification_id` varchar(32) NOT NULL,
  `recipient_user_id` varchar(32) NOT NULL,
  `actor_user_id` varchar(32) DEFAULT NULL,
  `notification_type` enum('follow','upvote','downvote','reply','message','connection','announcement','poll','survey','event') DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `message` text,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_recipient` (`recipient_user_id`),
  KEY `idx_notifications_actor` (`actor_user_id`),
  CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table pinned_items
# ------------------------------------------------------------

DROP TABLE IF EXISTS `pinned_items`;

CREATE TABLE `pinned_items` (
  `id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `item_type` enum('forum','thread','post','announcement','event') DEFAULT NULL,
  `item_id` int NOT NULL,
  `pinned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pinned_items_comm` (`community_id`),
  KEY `idx_pinned_items_item` (`item_type`,`item_id`),
  CONSTRAINT `fk_pinned_items_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table poll_options
# ------------------------------------------------------------

DROP TABLE IF EXISTS `poll_options`;

CREATE TABLE `poll_options` (
  `option_id` varchar(32) NOT NULL,
  `poll_id` varchar(32) NOT NULL,
  `option_text` varchar(255) NOT NULL,
  `position` int DEFAULT '0',
  PRIMARY KEY (`option_id`),
  KEY `idx_poll_options_poll` (`poll_id`,`position`),
  CONSTRAINT `fk_poll_options_poll` FOREIGN KEY (`poll_id`) REFERENCES `polls` (`poll_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table poll_votes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `poll_votes`;

CREATE TABLE `poll_votes` (
  `vote_id` varchar(32) NOT NULL,
  `poll_id` varchar(32) NOT NULL,
  `option_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vote_id`),
  UNIQUE KEY `uq_poll_vote` (`poll_id`,`user_id`,`option_id`),
  KEY `idx_poll_votes_option` (`option_id`),
  KEY `idx_poll_votes_user` (`user_id`),
  CONSTRAINT `fk_poll_votes_option` FOREIGN KEY (`option_id`) REFERENCES `poll_options` (`option_id`),
  CONSTRAINT `fk_poll_votes_poll` FOREIGN KEY (`poll_id`) REFERENCES `polls` (`poll_id`),
  CONSTRAINT `fk_poll_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table polls
# ------------------------------------------------------------

DROP TABLE IF EXISTS `polls`;

CREATE TABLE `polls` (
  `poll_id` varchar(32) NOT NULL,
  `community_id` varchar(32) DEFAULT NULL,
  `created_by` varchar(32) NOT NULL,
  `question` varchar(255) NOT NULL,
  `description` text,
  `is_anonymous` tinyint(1) DEFAULT '0',
  `allow_multiple_choices` tinyint(1) DEFAULT '0',
  `opens_at` datetime DEFAULT NULL,
  `closes_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`poll_id`),
  KEY `idx_polls_scope` (`community_id`,`opens_at`,`closes_at`),
  KEY `fk_polls_creator` (`created_by`),
  CONSTRAINT `fk_polls_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_polls_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table post_votes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `post_votes`;

CREATE TABLE `post_votes` (
  `id` varchar(32) NOT NULL,
  `post_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `vote_type` enum('up','down') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_post_votes_post` (`post_id`),
  KEY `idx_post_votes_user` (`user_id`),
  CONSTRAINT `fk_post_votes_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`),
  CONSTRAINT `fk_post_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table posts
# ------------------------------------------------------------

DROP TABLE IF EXISTS `posts`;

CREATE TABLE `posts` (
  `post_id` varchar(32) NOT NULL,
  `thread_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  `reply_to` varchar(32) DEFAULT NULL,
  `verified` tinyint(1) DEFAULT '0',
  `verified_by` varchar(32) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`post_id`),
  KEY `idx_posts_thread` (`thread_id`),
  KEY `idx_posts_reply_to` (`reply_to`),
  KEY `idx_posts_user` (`user_id`),
  CONSTRAINT `fk_posts_reply` FOREIGN KEY (`reply_to`) REFERENCES `posts` (`post_id`),
  CONSTRAINT `fk_posts_thread` FOREIGN KEY (`thread_id`) REFERENCES `threads` (`thread_id`),
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table roles
# ------------------------------------------------------------

DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `role_id` bigint NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` text,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table saved_forums
# ------------------------------------------------------------

DROP TABLE IF EXISTS `saved_forums`;

CREATE TABLE `saved_forums` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `forum_id` varchar(32) NOT NULL,
  `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_forums` (`user_id`,`forum_id`),
  KEY `idx_saved_forums_forum` (`forum_id`),
  CONSTRAINT `fk_saved_forums_forum` FOREIGN KEY (`forum_id`) REFERENCES `forums` (`forum_id`),
  CONSTRAINT `fk_saved_forums_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table saved_posts
# ------------------------------------------------------------

DROP TABLE IF EXISTS `saved_posts`;

CREATE TABLE `saved_posts` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `post_id` varchar(32) NOT NULL,
  `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_posts` (`user_id`,`post_id`),
  KEY `idx_saved_posts_post` (`post_id`),
  CONSTRAINT `fk_saved_posts_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`),
  CONSTRAINT `fk_saved_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table saved_threads
# ------------------------------------------------------------

DROP TABLE IF EXISTS `saved_threads`;

CREATE TABLE `saved_threads` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `thread_id` varchar(32) NOT NULL,
  `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_threads` (`user_id`,`thread_id`),
  KEY `idx_saved_threads_thread` (`thread_id`),
  CONSTRAINT `fk_saved_threads_thread` FOREIGN KEY (`thread_id`) REFERENCES `threads` (`thread_id`),
  CONSTRAINT `fk_saved_threads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table survey_answers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `survey_answers`;

CREATE TABLE `survey_answers` (
  `answer_id` varchar(32) NOT NULL,
  `response_id` varchar(32) NOT NULL,
  `question_id` varchar(32) NOT NULL,
  `option_id` varchar(32) DEFAULT NULL,
  `answer_text` text,
  `numeric_value` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`answer_id`),
  KEY `idx_survey_answers_response` (`response_id`),
  KEY `idx_survey_answers_question` (`question_id`),
  KEY `idx_survey_answers_option` (`option_id`),
  CONSTRAINT `fk_survey_answers_option` FOREIGN KEY (`option_id`) REFERENCES `survey_options` (`option_id`),
  CONSTRAINT `fk_survey_answers_question` FOREIGN KEY (`question_id`) REFERENCES `survey_questions` (`question_id`),
  CONSTRAINT `fk_survey_answers_response` FOREIGN KEY (`response_id`) REFERENCES `survey_responses` (`response_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table survey_options
# ------------------------------------------------------------

DROP TABLE IF EXISTS `survey_options`;

CREATE TABLE `survey_options` (
  `option_id` varchar(32) NOT NULL,
  `question_id` varchar(32) NOT NULL,
  `option_text` varchar(255) NOT NULL,
  `position` int DEFAULT '0',
  PRIMARY KEY (`option_id`),
  KEY `idx_survey_options_question` (`question_id`,`position`),
  CONSTRAINT `fk_survey_options_question` FOREIGN KEY (`question_id`) REFERENCES `survey_questions` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table survey_questions
# ------------------------------------------------------------

DROP TABLE IF EXISTS `survey_questions`;

CREATE TABLE `survey_questions` (
  `question_id` varchar(32) NOT NULL,
  `survey_id` varchar(32) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` enum('short_text','long_text','single_choice','multi_choice','scale') NOT NULL,
  `position` int DEFAULT '0',
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`question_id`),
  KEY `idx_survey_questions_survey` (`survey_id`,`position`),
  CONSTRAINT `fk_survey_questions_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`survey_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table survey_responses
# ------------------------------------------------------------

DROP TABLE IF EXISTS `survey_responses`;

CREATE TABLE `survey_responses` (
  `response_id` varchar(32) NOT NULL,
  `survey_id` varchar(32) NOT NULL,
  `user_id` varchar(32) DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`response_id`),
  KEY `idx_survey_responses_survey` (`survey_id`),
  KEY `idx_survey_responses_user` (`user_id`),
  CONSTRAINT `fk_survey_responses_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`survey_id`),
  CONSTRAINT `fk_survey_responses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table surveys
# ------------------------------------------------------------

DROP TABLE IF EXISTS `surveys`;

CREATE TABLE `surveys` (
  `survey_id` varchar(32) NOT NULL,
  `community_id` varchar(32) DEFAULT NULL,
  `created_by` varchar(32) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `is_anonymous` tinyint(1) DEFAULT '0',
  `allow_multiple_submissions` tinyint(1) DEFAULT '0',
  `opens_at` datetime DEFAULT NULL,
  `closes_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`survey_id`),
  KEY `idx_surveys_scope` (`community_id`,`opens_at`,`closes_at`),
  KEY `fk_surveys_creator` (`created_by`),
  CONSTRAINT `fk_surveys_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_surveys_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `tags`;

CREATE TABLE `tags` (
  `tag_id` varchar(32) NOT NULL,
  `name` varchar(50) NOT NULL,
  `slug` varchar(60) GENERATED ALWAYS AS (lower(replace(trim(`name`),_utf8mb4' ',_utf8mb4'-'))) VIRTUAL,
  `color_hex` char(7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` enum('general','forum','thread') NOT NULL DEFAULT 'general',
  `community_id` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `uq_tags_name` (`name`),
  UNIQUE KEY `uq_tags_comm_name` (`community_id`,`name`),
  UNIQUE KEY `uq_tags_slug` (`slug`),
  KEY `idx_tags_active` (`is_active`),
  KEY `idx_tags_type` (`type`),
  KEY `idx_tags_slug` (`slug`),
  CONSTRAINT `fk_tags_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_tags_color_hex` CHECK (((`color_hex` is null) or regexp_like(`color_hex`,_utf8mb4'^#[0-9A-Fa-f]{6}$')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table thread_tags
# ------------------------------------------------------------

DROP TABLE IF EXISTS `thread_tags`;

CREATE TABLE `thread_tags` (
  `thread_id` varchar(32) NOT NULL,
  `tag_id` varchar(32) NOT NULL,
  PRIMARY KEY (`thread_id`,`tag_id`),
  KEY `idx_thread_tags_tag` (`tag_id`),
  KEY `idx_thread_tags_tag_thread` (`tag_id`,`thread_id`),
  CONSTRAINT `fk_thread_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`),
  CONSTRAINT `fk_thread_tags_thread` FOREIGN KEY (`thread_id`) REFERENCES `threads` (`thread_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table thread_votes
# ------------------------------------------------------------

DROP TABLE IF EXISTS `thread_votes`;

CREATE TABLE `thread_votes` (
  `id` varchar(32) NOT NULL,
  `thread_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `vote_type` enum('up','down') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_thread_votes_thread` (`thread_id`),
  KEY `idx_thread_votes_user` (`user_id`),
  CONSTRAINT `fk_thread_votes_thread` FOREIGN KEY (`thread_id`) REFERENCES `threads` (`thread_id`),
  CONSTRAINT `fk_thread_votes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table threads
# ------------------------------------------------------------

DROP TABLE IF EXISTS `threads`;

CREATE TABLE `threads` (
  `thread_id` varchar(32) NOT NULL,
  `forum_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `title` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_activity_at` timestamp NULL DEFAULT NULL,
  `reply_count` int NOT NULL DEFAULT '0',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('open','resolved','archived') NOT NULL DEFAULT 'open',
  PRIMARY KEY (`thread_id`),
  KEY `idx_threads_forum` (`forum_id`),
  KEY `idx_threads_forum_sort` (`forum_id`,`last_activity_at` DESC),
  KEY `idx_threads_last_activity` (`is_locked`,`last_activity_at` DESC,`thread_id` DESC),
  KEY `idx_threads_user` (`user_id`),
  CONSTRAINT `fk_threads_forum` FOREIGN KEY (`forum_id`) REFERENCES `forums` (`forum_id`),
  CONSTRAINT `fk_threads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table user_education
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_education`;

CREATE TABLE `user_education` (
  `education_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `degree` varchar(255) DEFAULT NULL,
  `field_of_study` varchar(255) DEFAULT NULL,
  `gpa` decimal(3,2) DEFAULT NULL,
  `honors` varchar(255) DEFAULT NULL,
  `activities_societies` text,
  `achievements` json DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`education_id`),
  KEY `idx_user_education_user` (`user_id`),
  CONSTRAINT `fk_user_education_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table user_experience
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_experience`;

CREATE TABLE `user_experience` (
  `experience_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `employment_type` enum('Full-time','Part-time','Contract','Internship','Volunteer','Seasonal') DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `location_city` varchar(100) DEFAULT NULL,
  `location_state` varchar(100) DEFAULT NULL,
  `location_country` varchar(100) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `description` text,
  `responsibilities` json DEFAULT NULL,
  PRIMARY KEY (`experience_id`),
  KEY `idx_user_experience_user` (`user_id`),
  CONSTRAINT `fk_user_experience_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table user_follows
# ------------------------------------------------------------

DROP TABLE IF EXISTS `user_follows`;

CREATE TABLE `user_follows` (
  `id` varchar(32) NOT NULL,
  `follower_id` varchar(32) NOT NULL,
  `followed_user_id` varchar(32) NOT NULL,
  `followed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_follows` (`follower_id`,`followed_user_id`),
  KEY `idx_user_follows_followed` (`followed_user_id`),
  CONSTRAINT `fk_user_follows_followed` FOREIGN KEY (`followed_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_user_follows_follower` FOREIGN KEY (`follower_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table users
# ------------------------------------------------------------

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `user_id` varchar(32) NOT NULL,
  `role_id` bigint NOT NULL,
  `recent_university_id` varchar(32) DEFAULT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password_hash` text NOT NULL,
  `education_status` varchar(100) NOT NULL DEFAULT 'Prospect',
  `is_over_18` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `headline` varchar(255) DEFAULT '',
  `about` text,
  `skills` text,
  `avatar_path` varchar(255) NOT NULL DEFAULT 'DefaultAvatar.png',
  `banner_path` varchar(255) NOT NULL DEFAULT 'DefaultBanner.jpeg',
  `primary_color` varchar(7) NOT NULL DEFAULT '#0077B5',
  `secondary_color` varchar(7) NOT NULL DEFAULT '#005f8d',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_community_id` varchar(32) DEFAULT NULL,
  `is_ambassador` tinyint(1) DEFAULT '0',
  `follower_count` int NOT NULL DEFAULT '0',
  `following_count` int NOT NULL DEFAULT '0',
  `login_count` int DEFAULT '0',
  `verification_code` int DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `is_public` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_recent_university` (`recent_university_id`),
  KEY `idx_users_verified_community` (`verified_community_id`),
  CONSTRAINT `fk_users_recent_university` FOREIGN KEY (`recent_university_id`) REFERENCES `communities` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_users_verified_community` FOREIGN KEY (`verified_community_id`) REFERENCES `communities` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of table verified_users
# ------------------------------------------------------------

DROP TABLE IF EXISTS `verified_users`;

CREATE TABLE `verified_users` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `community_id` varchar(32) NOT NULL,
  `verified_by` varchar(32) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_verified_users_comm` (`community_id`),
  KEY `idx_verified_users_verifier` (`verified_by`),
  KEY `idx_verified_users_user` (`user_id`),
  CONSTRAINT `fk_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_verified_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_verified_users_community` FOREIGN KEY (`community_id`) REFERENCES `communities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



# Dump of view all_community_data
# ------------------------------------------------------------

DROP TABLE IF EXISTS `all_community_data`; DROP VIEW IF EXISTS `all_community_data`;

CREATE ALGORITHM=UNDEFINED DEFINER=`srp_user`@`localhost` SQL SECURITY DEFINER VIEW `all_community_data`
AS SELECT
   `c`.`id` AS `community_id`,
   `c`.`community_type` AS `community_type`,
   `c`.`name` AS `name`,
   `c`.`location` AS `location`,
   `c`.`tagline` AS `tagline`,
   `c`.`logo_path` AS `logo_path`,count(`fc`.`user_id`) AS `followers_count`
FROM (`communities` `c` left join `followed_communities` `fc` on((`fc`.`community_id` = `c`.`id`))) group by `c`.`id`,`c`.`community_type`,`c`.`name`,`c`.`location`,`c`.`tagline`,`c`.`logo_path`;


--
-- Dumping routines (PROCEDURE) for database 'srp_db'
--
DELIMITER ;;

# Dump of PROCEDURE set_forum_tags
# ------------------------------------------------------------

/*!50003 DROP PROCEDURE IF EXISTS `set_forum_tags` */;;
/*!50003 SET SESSION SQL_MODE="ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`srp_user`@`%`*/ /*!50003 PROCEDURE `set_forum_tags`(IN p_forum_id INT, IN p_tags_json JSON)
BEGIN
  -- Normalize: trim + lower + hyphenate from incoming names
  WITH norm AS (
    SELECT
      JSON_UNQUOTE(value) AS raw_name,
      LOWER(REPLACE(TRIM(JSON_UNQUOTE(value)), ' ', '-')) AS slug_norm,
      TRIM(JSON_UNQUOTE(value)) AS name_norm
    FROM JSON_TABLE(p_tags_json, '$[*]' COLUMNS (value JSON PATH '$')) jt
  )
  -- Upsert tags and collect their ids
  , upserted AS (
    SELECT n.name_norm AS name, n.slug_norm AS slug
    FROM norm n
    GROUP BY n.slug_norm
  )
  SELECT 1 INTO @noop; -- anchor

  -- Insert any missing names into tags (display name = name_norm)
  INSERT INTO tags (name)
  SELECT u.name FROM upserted u
  ON DUPLICATE KEY UPDATE name = VALUES(name);

  -- Temp table of desired tag_ids
  CREATE TEMPORARY TABLE IF NOT EXISTS _desired_forum_tag_ids(tag_id INT PRIMARY KEY);
  TRUNCATE _desired_forum_tag_ids;

  INSERT IGNORE INTO _desired_forum_tag_ids(tag_id)
  SELECT t.tag_id
  FROM upserted u
  JOIN tags t ON t.slug = u.slug;

  -- Insert missing links
  INSERT IGNORE INTO forum_tags (forum_id, tag_id)
  SELECT p_forum_id, d.tag_id
  FROM _desired_forum_tag_ids d;

  -- Delete links that are no longer desired
  DELETE ft
  FROM forum_tags ft
  LEFT JOIN _desired_forum_tag_ids d ON d.tag_id = ft.tag_id
  WHERE ft.forum_id = p_forum_id
    AND d.tag_id IS NULL;

  DROP TEMPORARY TABLE IF EXISTS _desired_forum_tag_ids;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
# Dump of PROCEDURE set_thread_tags
# ------------------------------------------------------------

/*!50003 DROP PROCEDURE IF EXISTS `set_thread_tags` */;;
/*!50003 SET SESSION SQL_MODE="ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`srp_user`@`%`*/ /*!50003 PROCEDURE `set_thread_tags`(IN p_thread_id INT, IN p_tags_json JSON)
BEGIN
  WITH norm AS (
    SELECT
      JSON_UNQUOTE(value) AS raw_name,
      LOWER(REPLACE(TRIM(JSON_UNQUOTE(value)), ' ', '-')) AS slug_norm,
      TRIM(JSON_UNQUOTE(value)) AS name_norm
    FROM JSON_TABLE(p_tags_json, '$[*]' COLUMNS (value JSON PATH '$')) jt
  )
  , upserted AS (
    SELECT n.name_norm AS name, n.slug_norm AS slug
    FROM norm n
    GROUP BY n.slug_norm
  )
  SELECT 1 INTO @noop;

  INSERT INTO tags (name)
  SELECT u.name FROM upserted u
  ON DUPLICATE KEY UPDATE name = VALUES(name);

  CREATE TEMPORARY TABLE IF NOT EXISTS _desired_thread_tag_ids(tag_id INT PRIMARY KEY);
  TRUNCATE _desired_thread_tag_ids;

  INSERT IGNORE INTO _desired_thread_tag_ids(tag_id)
  SELECT t.tag_id
  FROM upserted u
  JOIN tags t ON t.slug = u.slug;

  INSERT IGNORE INTO thread_tags (thread_id, tag_id)
  SELECT p_thread_id, d.tag_id
  FROM _desired_thread_tag_ids d;

  DELETE tt
  FROM thread_tags tt
  LEFT JOIN _desired_thread_tag_ids d ON d.tag_id = tt.tag_id
  WHERE tt.thread_id = p_thread_id
    AND d.tag_id IS NULL;

  DROP TEMPORARY TABLE IF EXISTS _desired_thread_tag_ids;
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
DELIMITER ;

--
-- Dumping routines (FUNCTION) for database 'srp_db'
--
DELIMITER ;;

# Dump of FUNCTION prefixed_hash
# ------------------------------------------------------------

/*!50003 DROP FUNCTION IF EXISTS `prefixed_hash` */;;
/*!50003 SET SESSION SQL_MODE="ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION"*/;;
/*!50003 CREATE*/ /*!50020 DEFINER=`srp_user`@`%`*/ /*!50003 FUNCTION `prefixed_hash`(pfx CHAR(1), n BIGINT) RETURNS char(32) CHARSET utf8mb4
    DETERMINISTIC
BEGIN
  RETURN CONCAT(pfx, LPAD(LOWER(HEX(n)), 31, '0'));
END */;;

/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;;
DELIMITER ;

/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
