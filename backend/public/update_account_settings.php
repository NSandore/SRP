<?php
// update_account_settings.php
// Handles account settings updates for profile visibility and syncs the users.is_public flag.

require_once __DIR__ . '/../session_bootstrap.php';

startSession();
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
$notifyRepliesProvided = array_key_exists('notify_replies', $input);
$notifyEventsProvided = array_key_exists('notify_events', $input);
$defaultFeedProvided = array_key_exists('default_feed', $input);
$twoFactorProvided = array_key_exists('two_factor_enabled', $input);
$autoJoinProvided = array_key_exists('auto_join_campus', $input);
$ambassadorSpecialtiesProvided = array_key_exists('ambassador_specialties', $input);
$ambassadorAcceptingProvided = array_key_exists('ambassador_accepting_questions', $input);

if (
    !$profileVisibilityProvided &&
    !$showOnlineProvided &&
    !$dmSettingProvided &&
    !$showEmailProvided &&
    !$discoverableProvided &&
    !$sessionTimeoutProvided &&
    !$notifyVotesProvided &&
    !$notifyRepliesProvided &&
    !$notifyEventsProvided &&
    !$defaultFeedProvided &&
    !$twoFactorProvided &&
    !$autoJoinProvided &&
    !$ambassadorSpecialtiesProvided &&
    !$ambassadorAcceptingProvided
) {
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

$notifyReplies = null;
if ($notifyRepliesProvided) {
    $parsed = filter_var($input['notify_replies'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['notify_replies'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid notify_replies value']);
        exit;
    }
    $notifyReplies = $parsed === null ? (intval($input['notify_replies']) ? 1 : 0) : ($parsed ? 1 : 0);
}

$notifyEvents = null;
if ($notifyEventsProvided) {
    $parsed = filter_var($input['notify_events'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['notify_events'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid notify_events value']);
        exit;
    }
    $notifyEvents = $parsed === null ? (intval($input['notify_events']) ? 1 : 0) : ($parsed ? 1 : 0);
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

$twoFactorEnabled = null;
if ($twoFactorProvided) {
    $parsed = filter_var($input['two_factor_enabled'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['two_factor_enabled'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid two_factor_enabled value']);
        exit;
    }
    $twoFactorEnabled = $parsed === null ? (intval($input['two_factor_enabled']) ? 1 : 0) : ($parsed ? 1 : 0);
}

$autoJoinCampus = null;
if ($autoJoinProvided) {
    $parsed = filter_var($input['auto_join_campus'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['auto_join_campus'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid auto_join_campus value']);
        exit;
    }
    $autoJoinCampus = $parsed === null ? (intval($input['auto_join_campus']) ? 1 : 0) : ($parsed ? 1 : 0);
}

$allowedAmbassadorSpecialties = [
    'applications', 'financial-aid', 'scholarships', 'paying-for-school',
    'academics', 'housing-and-dining', 'academic-support',
    'disability-and-accessibility', 'mental-health-and-wellness',
    'student-rights-and-policies', 'career-services', 'peer-support',
    'getting-started',
];
$ambassadorSpecialties = null;
if ($ambassadorSpecialtiesProvided) {
    if (!is_array($input['ambassador_specialties'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid ambassador_specialties value']);
        exit;
    }
    $ambassadorSpecialties = array_values(array_unique(array_map('trim', $input['ambassador_specialties'])));
    if (count($ambassadorSpecialties) > 4 || array_diff($ambassadorSpecialties, $allowedAmbassadorSpecialties)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Choose up to four valid specialties']);
        exit;
    }
}

$ambassadorAcceptingQuestions = null;
if ($ambassadorAcceptingProvided) {
    $parsed = filter_var($input['ambassador_accepting_questions'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($parsed === null && !is_numeric($input['ambassador_accepting_questions'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid ambassador_accepting_questions value']);
        exit;
    }
    $ambassadorAcceptingQuestions = $parsed === null ? (intval($input['ambassador_accepting_questions']) ? 1 : 0) : ($parsed ? 1 : 0);
}

try {
    $db = getDB();

    if ($ambassadorSpecialtiesProvided || $ambassadorAcceptingProvided) {
        $ambassadorStmt = $db->prepare('SELECT COUNT(*) FROM ambassadors WHERE user_id = :uid');
        $ambassadorStmt->execute([':uid' => $userId]);
        if ((int)$ambassadorStmt->fetchColumn() === 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Ambassador settings are only available to ambassadors']);
            exit;
        }
    }
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

$extrasUpdates = [];
if ($dmSettingProvided) {
    $extrasUpdates['allow_messages_from'] = $allowMessagesFrom;
}
if ($twoFactorProvided) {
    $extrasUpdates['two_factor_enabled'] = $twoFactorEnabled;
}
if ($autoJoinProvided) {
    $extrasUpdates['auto_join_campus'] = $autoJoinCampus;
}
if ($notifyVotesProvided) {
    $extrasUpdates['notify_votes'] = $notifyVotes;
}
if ($notifyRepliesProvided) {
    $extrasUpdates['notify_replies'] = $notifyReplies;
}
if ($notifyEventsProvided) {
    $extrasUpdates['notify_events'] = $notifyEvents;
}
if ($ambassadorAcceptingProvided) {
    $extrasUpdates['ambassador_accepting_questions'] = $ambassadorAcceptingQuestions;
}
if (!empty($extrasUpdates)) {
    $jsonSetParts = [];
    foreach ($extrasUpdates as $key => $value) {
        $param = ':extras_' . $key;
            $jsonSetParts[] = "'$." . $key . "', " . $param;
            $params[$param] = $value;
        }
        $jsonSetUpdate = "JSON_SET(COALESCE(extras, JSON_OBJECT()), " . implode(', ', $jsonSetParts) . ")";
        $jsonSetInsert = "JSON_SET(COALESCE(:extras, JSON_OBJECT()), " . implode(', ', $jsonSetParts) . ")";
        $updateParts[] = "extras = {$jsonSetUpdate}";
        $insertColumns[] = 'extras';
        $insertValues[] = $jsonSetInsert;
        $params[':extras'] = null;
    }

    if ($ambassadorSpecialtiesProvided) {
        $specialtiesJson = json_encode($ambassadorSpecialties, JSON_UNESCAPED_SLASHES);
        $updateParts[] = "extras = JSON_SET(COALESCE(extras, JSON_OBJECT()), '$.ambassador_specialties', CAST(:ambassador_specialties AS JSON))";
        $extrasColumnIndex = array_search('extras', $insertColumns, true);
        if ($extrasColumnIndex === false) {
            $insertColumns[] = 'extras';
            $insertValues[] = "JSON_SET(COALESCE(:extras, JSON_OBJECT()), '$.ambassador_specialties', CAST(:ambassador_specialties AS JSON))";
            $params[':extras'] = null;
        } else {
            $insertValues[$extrasColumnIndex] = "JSON_SET({$insertValues[$extrasColumnIndex]}, '$.ambassador_specialties', CAST(:ambassador_specialties AS JSON))";
        }
        $params[':ambassador_specialties'] = $specialtiesJson;
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
    if ($notifyRepliesProvided) {
        $response['notify_replies'] = $notifyReplies;
    }
    if ($notifyEventsProvided) {
        $response['notify_events'] = $notifyEvents;
    }
    if ($defaultFeedProvided) {
        $response['default_feed'] = $defaultFeed;
    }
    if ($ambassadorSpecialtiesProvided) {
        $response['ambassador_specialties'] = $ambassadorSpecialties;
    }
    if ($ambassadorAcceptingProvided) {
        $response['ambassador_accepting_questions'] = $ambassadorAcceptingQuestions;
    }

    echo json_encode($response);
} catch (PDOException $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ']);
}
?>
