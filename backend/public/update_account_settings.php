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

if (!$profileVisibilityProvided && !$showOnlineProvided) {
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

    echo json_encode($response);
} catch (PDOException $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
