<?php
// fetch_user.php

session_start();

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Include your database connection function
require_once __DIR__ . '/../db_connection.php';

// Check that a user_id is provided
if (!isset($_GET['user_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user_id']);
    exit;
}

// Safely retrieve and sanitize the user_id
$user_id = normalizeId($_GET['user_id']);

try {
    // Call getDB() to get the PDO connection
    $db = getDB();

    // Fetch user data directly from users (avoid view dependency/mismatched schema)
    $query = "
        SELECT 
            user_id,
            role_id,
            first_name,
            last_name,
            email,
            phone,
            headline,
            about,
            skills,
            avatar_path,
            banner_path,
            primary_color,
            secondary_color,
            verified,
            verified_community_id,
            is_public,
            is_ambassador,
            recent_university_id,
            login_count,
            NULL AS community_ambassador_of
        FROM users
        WHERE user_id = :user_id
        LIMIT 1
    ";
    $stmt = $db->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'User not found'
        ]);
        exit;
    }

    // Retrieve privacy setting for this user
    $pstmt = $db->prepare("SELECT is_public FROM users WHERE user_id = :uid");
    $pstmt->execute([':uid' => $user_id]);
    $is_public = (int)($pstmt->fetchColumn());
    $user['is_public'] = $is_public;

    // Account settings: visibility + online preference + last_seen
    $settingsStmt = $db->prepare("
        SELECT 
            profile_visibility, 
            show_online, 
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.last_seen_at')) AS last_seen_at,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.allow_messages_from')) AS allow_messages_from,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.notify_votes')) AS notify_votes,
            JSON_UNQUOTE(JSON_EXTRACT(extras, '$.default_feed')) AS default_feed_json,
            default_feed,
            show_email,
            discoverable,
            session_timeout_minutes
        FROM account_settings 
        WHERE user_id = :uid
    ");
    $settingsStmt->execute([':uid' => $user_id]);
    $settings = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $profile_visibility = $settings['profile_visibility'] ?? 'network';
    $show_online = isset($settings['show_online']) ? (int)$settings['show_online'] : 1;
    $last_seen_at = $settings['last_seen_at'] ?? null;
    $allow_messages_from = $settings['allow_messages_from'] ?? 'everyone';
    $notify_votes = isset($settings['notify_votes']) ? (int)$settings['notify_votes'] : 1;
    $default_feed = $settings['default_feed'] ?? ($settings['default_feed_json'] ?? null);
    $show_email = isset($settings['show_email']) ? (int)$settings['show_email'] : 0; // 0=hidden,1=connections,2=everyone
    $discoverable = isset($settings['discoverable']) ? (int)$settings['discoverable'] : 2;
    $session_timeout_minutes = isset($settings['session_timeout_minutes']) ? (int)$settings['session_timeout_minutes'] : 30;

    $isOnline = false;
    if ($last_seen_at) {
        $lastSeenTs = strtotime($last_seen_at);
        if ($lastSeenTs !== false) {
            $isOnline = (time() - $lastSeenTs) <= 300; // 5 minute window
        }
    }

    $user['profile_visibility'] = $profile_visibility;
    $user['show_online'] = $show_online;
    $user['is_online'] = $show_online ? $isOnline : false;
    $user['allow_messages_from'] = $allow_messages_from;
    $user['notify_votes'] = $notify_votes;
    $user['default_feed'] = $default_feed;
    $user['show_email'] = $show_email;
    $user['discoverable'] = $discoverable;
    $user['session_timeout_minutes'] = $session_timeout_minutes;

    $viewer_id = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    $isOwnProfile = $viewer_id === $user_id;

    // Determine if the viewer is connected to this user
    $isConnected = false;
    if ($viewer_id && $viewer_id !== $user_id) {
        $cstmt = $db->prepare("SELECT COUNT(*) FROM connections WHERE ((user_id1 = :viewer AND user_id2 = :user) OR (user_id1 = :user AND user_id2 = :viewer)) AND status = 'accepted'");
        $cstmt->execute([':viewer' => $viewer_id, ':user' => $user_id]);
        $isConnected = $cstmt->fetchColumn() > 0;
    }

    // Decode JSON field (community_ambassador_of) if it's not null
    if (!empty($user['community_ambassador_of'])) {
        $user['community_ambassador_of'] = json_decode($user['community_ambassador_of'], true);
    } else {
        $user['community_ambassador_of'] = [];
    }

    // Email visibility: 0 hidden, 1 connections only, 2 everyone
    $canViewEmail = $isOwnProfile;
    if (!$canViewEmail) {
        if ($show_email === 2) {
            $canViewEmail = true;
        } elseif ($show_email === 1 && $isConnected) {
            $canViewEmail = true;
        }
    }

    if ($is_public === 0 && !$isOwnProfile && !$isConnected) {
        if (isset($user['last_name'])) {
            $user['last_name'] = substr($user['last_name'], 0, 1) . '.';
        }
        if (isset($user['email'])) {
            $canViewEmail = false;
        }
        if (isset($user['phone'])) {
            $user['phone'] = null;
        }
    }

    if (!$canViewEmail) {
        $user['email'] = null;
    }
    $user['email_visible'] = $canViewEmail ? 1 : 0;

    // Normalize media paths
    $user['avatar_path'] = appendAvatarPath($user['avatar_path'] ?? null);
    $user['banner_path'] = appendBannerPath($user['banner_path'] ?? null);

    // Return the user data
    echo json_encode([
        'success' => true,
        'user'    => $user
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Database error: ' . $e->getMessage()
    ]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Server error: ' . $e->getMessage()
    ]);
    exit;
}
?>
