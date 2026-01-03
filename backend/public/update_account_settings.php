<?php
// update_account_settings.php
// Handles account settings updates for profile visibility and syncs the users.is_public flag.

session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$userId = isset($input['user_id']) ? normalizeId($input['user_id']) : normalizeId($_SESSION['user_id']);
if ($userId !== normalizeId($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Cannot update another user']);
    exit;
}

$profileVisibilityProvided = array_key_exists('profile_visibility', $input);
$showOnlineProvided = array_key_exists('show_online', $input);
$dmSettingProvided = array_key_exists('allow_messages_from', $input);
$showEmailProvided = array_key_exists('show_email', $input);
$discoverableProvided = array_key_exists('discoverable', $input);
$sessionTimeoutProvided = array_key_exists('session_timeout_minutes', $input);
$notifyVotesProvided = array_key_exists('notify_votes', $input);
$defaultFeedProvided = array_key_exists('default_feed', $input);

if (!$profileVisibilityProvided && !$showOnlineProvided && !$dmSettingProvided && !$showEmailProvided && !$discoverableProvided && !$sessionTimeoutProvided && !$notifyVotesProvided && !$defaultFeedProvided) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No settings provided']);
    exit;
}

$profileVisibility = null;
$isPublic = null;
if ($profileVisibilityProvided) {
    $profileVisibility = trim($input['profile_visibility']);
    $allowedVisibilities = ['network', 'followers', 'private'];
    if (!$profileVisibility || !in_array($profileVisibility, $allowedVisibilities, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid profile_visibility']);
        exit;
    }
    $isPublic = $profileVisibility === 'private' ? 0 : 1;
}

$showOnline = null;
if ($showOnlineProvided) {
    $parsed = filter_var($input['show_online'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['show_online'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid show_online value']);
        exit;
    }
    $showOnline = $parsed === null ? (intval($input['show_online']) ? 1 : 0) : ($parsed ? 1 : 0);
}

$allowMessagesFrom = null;
if ($dmSettingProvided) {
    $allowMessagesFrom = trim(strtolower($input['allow_messages_from']));
    $allowedDms = ['connections', 'community', 'everyone'];
    if (!in_array($allowMessagesFrom, $allowedDms, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid allow_messages_from value']);
        exit;
    }
}

$showEmail = null;
if ($showEmailProvided) {
    $rawShowEmail = is_string($input['show_email']) ? strtolower(trim($input['show_email'])) : $input['show_email'];
    $map = [
        'hidden' => 0,
        '0' => 0,
        0 => 0,
        false => 0,
        'false' => 0,
        'connections' => 1,
        '1' => 1,
        1 => 1,
        'everyone' => 2,
        '2' => 2,
        2 => 2,
        true => 2,
        'true' => 2,
    ];
    if (!array_key_exists($rawShowEmail, $map)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid show_email value']);
        exit;
    }
    $showEmail = $map[$rawShowEmail];
}

$discoverable = null;
if ($discoverableProvided) {
    $raw = is_string($input['discoverable']) ? strtolower(trim($input['discoverable'])) : $input['discoverable'];
    $map = [
        'no_one' => 0,
        '0' => 0,
        0 => 0,
        'connections' => 1,
        '1' => 1,
        1 => 1,
        'everyone' => 2,
        '2' => 2,
        2 => 2,
    ];
    if (!array_key_exists($raw, $map)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid discoverable value']);
        exit;
    }
    $discoverable = $map[$raw];
}

$sessionTimeoutMinutes = null;
if ($sessionTimeoutProvided) {
    $sessionTimeoutMinutes = intval($input['session_timeout_minutes']);
    if ($sessionTimeoutMinutes < 5 || $sessionTimeoutMinutes > 1440) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid session_timeout_minutes value']);
        exit;
    }
}

$notifyVotes = null;
if ($notifyVotesProvided) {
    $parsed = filter_var($input['notify_votes'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['notify_votes'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid notify_votes value']);
        exit;
    }
    $notifyVotes = $parsed === null ? (intval($input['notify_votes']) ? 1 : 0) : ($parsed ? 1 : 0);
}

$defaultFeed = null;
if ($defaultFeedProvided) {
    $defaultFeed = trim($input['default_feed']);
    $allowedFeeds = ['yourFeed', 'explore', 'info'];
    if (!in_array($defaultFeed, $allowedFeeds, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid default_feed value']);
        exit;
    }
}

try {
    $db = getDB();
    $db->beginTransaction();

    $insertColumns = ['user_id', 'updated_at'];
    $insertValues = [':uid', 'NOW()'];
    $updateParts = ['updated_at = NOW()'];
    $params = [':uid' => $userId];

    if ($profileVisibilityProvided) {
        $insertColumns[] = 'profile_visibility';
        $insertValues[] = ':vis';
        $updateParts[] = 'profile_visibility = VALUES(profile_visibility)';
        $params[':vis'] = $profileVisibility;
    }

    if ($showOnlineProvided) {
        $insertColumns[] = 'show_online';
        $insertValues[] = ':show_online';
        $updateParts[] = 'show_online = VALUES(show_online)';
        $params[':show_online'] = $showOnline;
    }

    if ($dmSettingProvided) {
        $updateParts[] = "extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.allow_messages_from', :allow_messages_from)";
        $insertColumns[] = 'extras';
        $insertValues[] = "JSON_SET(COALESCE(:extras, JSON_OBJECT()), '$.allow_messages_from', :allow_messages_from)";
        $params[':allow_messages_from'] = $allowMessagesFrom;
        $params[':extras'] = null;
    }

    if ($showEmailProvided) {
        $insertColumns[] = 'show_email';
        $insertValues[] = ':show_email';
        $updateParts[] = 'show_email = VALUES(show_email)';
        $params[':show_email'] = $showEmail;
    }

    if ($discoverableProvided) {
        $insertColumns[] = 'discoverable';
        $insertValues[] = ':discoverable';
        $updateParts[] = 'discoverable = VALUES(discoverable)';
        $params[':discoverable'] = $discoverable;
    }

    if ($sessionTimeoutProvided) {
        $insertColumns[] = 'session_timeout_minutes';
        $insertValues[] = ':session_timeout_minutes';
        $updateParts[] = 'session_timeout_minutes = VALUES(session_timeout_minutes)';
        $params[':session_timeout_minutes'] = $sessionTimeoutMinutes;
    }

    if ($notifyVotesProvided) {
        $updateParts[] = "extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.notify_votes', :notify_votes)";
        $insertColumns[] = 'extras';
        $insertValues[] = "JSON_SET(COALESCE(:extras, JSON_OBJECT()), '$.notify_votes', :notify_votes)";
        $params[':notify_votes'] = $notifyVotes;
        $params[':extras'] = null;
    }

    if ($defaultFeedProvided) {
        $insertColumns[] = 'default_feed';
        $insertValues[] = ':default_feed';
        $updateParts[] = 'default_feed = VALUES(default_feed)';
        $updateParts[] = "extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.default_feed', :default_feed)";
        if (!in_array('extras', $insertColumns, true)) {
            $insertColumns[] = 'extras';
            $insertValues[] = "JSON_SET(COALESCE(:extras, JSON_OBJECT()), '$.default_feed', :default_feed)";
            $params[':extras'] = null;
        }
        $params[':default_feed'] = $defaultFeed;
    }

    $insertSql = sprintf(
        "INSERT INTO account_settings (%s) VALUES (%s) ON DUPLICATE KEY UPDATE %s",
        implode(', ', $insertColumns),
        implode(', ', $insertValues),
        implode(', ', $updateParts)
    );

    $stmt = $db->prepare($insertSql);
    $stmt->execute($params);

    if ($profileVisibilityProvided) {
        // Sync is_public on users table
        $uStmt = $db->prepare("UPDATE users SET is_public = :is_public WHERE user_id = :uid");
        $uStmt->execute([
            ':is_public' => $isPublic,
            ':uid' => $userId,
        ]);
        $_SESSION['is_public'] = $isPublic;
    }

    $db->commit();

    $response = ['success' => true];
    if ($profileVisibilityProvided) {
        $response['is_public'] = $isPublic;
        $response['profile_visibility'] = $profileVisibility;
    }
    if ($showOnlineProvided) {
        $response['show_online'] = $showOnline;
    }
    if ($showEmailProvided) {
        $response['show_email'] = $showEmail;
    }
    if ($discoverableProvided) {
        $response['discoverable'] = $discoverable;
    }
    if ($sessionTimeoutProvided) {
        $response['session_timeout_minutes'] = $sessionTimeoutMinutes;
    }
    if ($notifyVotesProvided) {
        $response['notify_votes'] = $notifyVotes;
    }
    if ($defaultFeedProvided) {
        $response['default_feed'] = $defaultFeed;
    }

    echo json_encode($response);
} catch (PDOException $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
