<?php
require_once __DIR__ . '/../session_bootstrap.php';
startSession();

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../tag_helpers.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/onboarding.php';

header('Content-Type: application/json');

function respond_json(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function onboarding_next_step(array $state, bool $isVerified): int {
    $hasRole = !empty($state['role_intent']);
    $hasInterests = !empty($state['interests_selected']);
    $hasProfileBasics = !empty($state['profile_basics_completed']);
    $wantsVerification = !empty($state['wants_verification_now']);
    $hasVerificationDecision = !empty($state['verification_requested']) || !empty($state['verification_skipped']);

    if ($state['status'] === 'completed') {
        return 9;
    }
    if (!$isVerified && empty($state['email_verification_skipped'])) {
        return 1;
    }
    if (!$hasRole) {
        return 2;
    }
    if (!$hasInterests) {
        return 3;
    }
    if (!$hasProfileBasics) {
        return 5;
    }
    if ($wantsVerification && !$hasVerificationDecision) {
        return 7;
    }
    return 9;
}

function fetch_verification_summary(PDO $db, string $userId): array {
    $stmt = $db->prepare("
        SELECT verification_type, status, verification_method, created_at
        FROM user_verification_requests
        WHERE user_id = :uid
        ORDER BY created_at DESC
    ");
    $stmt->execute([':uid' => $userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $summary = [
        'student' => null,
        'staff_representative' => null,
    ];
    foreach ($rows as $row) {
        $type = $row['verification_type'] ?? '';
        if (!isset($summary[$type]) || $summary[$type] !== null) {
            continue;
        }
        $summary[$type] = [
            'status' => $row['status'] ?? 'pending',
            'method' => $row['verification_method'] ?? '',
            'created_at' => $row['created_at'] ?? null,
        ];
    }
    return $summary;
}

function send_verification_review_notifications(PDO $db, string $actorUserId, string $verificationType, ?string $communityId, string $requestId): void {
    $superStmt = $db->prepare("SELECT user_id FROM users WHERE role_id = :role_id");
    $superStmt->execute([':role_id' => ROLE_SUPER_ADMIN]);
    $superAdmins = $superStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

    if (!$superAdmins) {
        return;
    }

    $communityName = '';
    if ($communityId) {
        $cStmt = $db->prepare("SELECT name FROM communities WHERE id = :cid LIMIT 1");
        $cStmt->execute([':cid' => $communityId]);
        $communityName = (string)($cStmt->fetchColumn() ?: '');
    }

    $typeLabel = $verificationType === 'staff_representative' ? 'staff/representative' : 'student';
    $suffix = $communityName !== '' ? " for {$communityName}" : '';
    $message = "New {$typeLabel} verification request submitted{$suffix}.";

    $insert = $db->prepare("
        INSERT INTO notifications (notification_id, recipient_user_id, actor_user_id, notification_type, reference_id, message)
        VALUES (:nid, :rid, :aid, 'verification_request', :ref, :message)
    ");

    foreach ($superAdmins as $recipientId) {
        if (!$recipientId) {
            continue;
        }
        $notificationId = generateUniqueId($db, 'notifications');
        $insert->execute([
            ':nid' => $notificationId,
            ':rid' => normalizeId($recipientId),
            ':aid' => $actorUserId,
            ':ref' => $requestId,
            ':message' => $message,
        ]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_SESSION['user_id'])) {
        respond_json([
            'success' => true,
            'logged_in' => false,
            'wizard' => srp_default_onboarding_state(),
        ]);
    }

    try {
        $db = getDB();
        srp_ensure_onboarding_tables($db);

        $userId = normalizeId($_SESSION['user_id']);
        $userStmt = $db->prepare("
            SELECT user_id, first_name, last_name, email, role_id, education_status, recent_university_id, is_verified, verified, verified_community_id, login_count
            FROM users
            WHERE user_id = :uid
            LIMIT 1
        ");
        $userStmt->execute([':uid' => $userId]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            respond_json(['success' => false, 'error' => 'User not found'], 404);
        }

        $state = srp_get_onboarding_state($db, $userId);
        $extras = srp_get_account_settings_extras($db, $userId);

        $interestCountStmt = $db->prepare("SELECT COUNT(*) FROM user_interests WHERE user_id = :uid");
        $interestCountStmt->execute([':uid' => $userId]);
        $interestCount = (int)$interestCountStmt->fetchColumn();
        if ($interestCount > 0) {
            $state['interests_selected'] = true;
            srp_mark_step_complete($state, 3);
        }

        $followCountStmt = $db->prepare("SELECT COUNT(*) FROM followed_communities WHERE user_id = :uid");
        $followCountStmt->execute([':uid' => $userId]);
        $followCount = (int)$followCountStmt->fetchColumn();
        if ($followCount > 0) {
            $state['follows_selected'] = true;
            srp_mark_step_complete($state, 4);
        }

        $posting = srp_get_posting_window($db, $userId);
        $isVerified = (int)($user['is_verified'] ?? 0) === 1;
        $state['current_step'] = onboarding_next_step($state, $isVerified);
        if ($state['current_step'] === 9 && $state['status'] !== 'completed') {
            $state['status'] = 'completed';
            $state['completed_at'] = gmdate('c');
        }
        srp_save_onboarding_state($db, $userId, $state);

        respond_json([
            'success' => true,
            'logged_in' => true,
            'user' => [
                'user_id' => $user['user_id'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'email' => $user['email'],
                'role_id' => (int)$user['role_id'],
                'education_status' => $user['education_status'],
                'recent_university_id' => $user['recent_university_id'],
                'is_verified' => (int)$user['is_verified'],
                'verified' => (int)$user['verified'],
                'verified_community_id' => $user['verified_community_id'],
                'login_count' => isset($user['login_count']) ? (int)$user['login_count'] : 0,
            ],
            'wizard' => $state,
            'metrics' => [
                'interest_count' => $interestCount,
                'follow_count' => $followCount,
                'posting' => $posting,
            ],
            'verification' => fetch_verification_summary($db, $userId),
            'context' => is_array($extras['onboarding_context'] ?? null) ? $extras['onboarding_context'] : null,
            'profile_basics' => is_array($extras['profile_basics'] ?? null) ? $extras['profile_basics'] : null,
        ]);
    } catch (Throwable $e) {
        respond_json(['success' => false, 'error' => 'Unable to load onboarding state'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_json(['success' => false, 'error' => 'Method not allowed'], 405);
}

if (!isset($_SESSION['user_id'])) {
    respond_json(['success' => false, 'error' => 'Unauthorized'], 403);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    respond_json(['success' => false, 'error' => 'Invalid payload'], 400);
}

$action = trim((string)($payload['action'] ?? ''));
if ($action === '') {
    respond_json(['success' => false, 'error' => 'Missing action'], 400);
}

try {
    $db = getDB();
    srp_ensure_onboarding_tables($db);

    $userId = normalizeId($_SESSION['user_id']);
    $state = srp_get_onboarding_state($db, $userId);
    $extras = srp_get_account_settings_extras($db, $userId);

    if ($action === 'set_role') {
        $roleIntent = srp_normalize_role_intent($payload['role_intent'] ?? '');
        if (!$roleIntent) {
            respond_json(['success' => false, 'error' => 'Invalid role selection'], 400);
        }

        $educationStatus = srp_role_label($roleIntent);
        $stmt = $db->prepare("UPDATE users SET education_status = :status WHERE user_id = :uid");
        $stmt->execute([
            ':status' => $educationStatus,
            ':uid' => $userId,
        ]);

        if ($roleIntent === 'student') {
            $communityId = normalizeId($payload['community_id'] ?? '');
            if ($communityId === '') {
                respond_json(['success' => false, 'error' => 'Select a university'], 400);
            }
            $startDate = trim((string)($payload['start_date'] ?? ''));
            if ($startDate === '') {
                respond_json(['success' => false, 'error' => 'Start date is required'], 400);
            }
            $checkCommunity = $db->prepare("
                SELECT 1 FROM communities
                WHERE id = :cid AND community_type = 'university'
                LIMIT 1
            ");
            $checkCommunity->execute([':cid' => $communityId]);
            if (!$checkCommunity->fetchColumn()) {
                respond_json(['success' => false, 'error' => 'Invalid university selection'], 400);
            }
            $upUser = $db->prepare("UPDATE users SET recent_university_id = :cid WHERE user_id = :uid");
            $upUser->execute([':cid' => $communityId, ':uid' => $userId]);

            $existsStmt = $db->prepare("
                SELECT 1
                FROM educational_experience
                WHERE user_id = :uid AND community_id = :cid
                LIMIT 1
            ");
            $existsStmt->execute([':uid' => $userId, ':cid' => $communityId]);
            if (!$existsStmt->fetchColumn()) {
                $insertEdu = $db->prepare("
                    INSERT INTO educational_experience (id, user_id, community_id, start_date, end_date, degree, major, still_attending)
                    VALUES (:id, :uid, :cid, :start_date, :end_date, :degree, :major, :still_attending)
                ");
                $insertEdu->execute([
                    ':id' => generateUniqueId($db, 'educational_experience'),
                    ':uid' => $userId,
                    ':cid' => $communityId,
                    ':start_date' => $startDate,
                    ':end_date' => '9999-12-31',
                    ':degree' => '',
                    ':major' => '',
                    ':still_attending' => 1,
                ]);
            }

            $checkFollow = $db->prepare("
                SELECT 1 FROM followed_communities
                WHERE user_id = :uid AND community_id = :cid
                LIMIT 1
            ");
            $checkFollow->execute([':uid' => $userId, ':cid' => $communityId]);
            if (!$checkFollow->fetchColumn()) {
                $insertFollow = $db->prepare("
                    INSERT INTO followed_communities (id, user_id, community_id)
                    VALUES (:id, :uid, :cid)
                ");
                $insertFollow->execute([
                    ':id' => generateUniqueId($db, 'followed_communities'),
                    ':uid' => $userId,
                    ':cid' => $communityId,
                ]);
            }

            $state['wants_verification_now'] = true;
            $state['verification_skipped'] = false;
        }

        $state['role_intent'] = $roleIntent;
        srp_mark_step_complete($state, 2);
        $state['current_step'] = 3;
    } elseif ($action === 'set_interests') {
        $tags = $payload['tags'] ?? [];
        if (!is_array($tags) || count($tags) < 1) {
            respond_json(['success' => false, 'error' => 'Select at least one interest'], 400);
        }

        $tagIds = srp_resolve_tag_ids($db, $tags);
        srp_sync_tag_mappings($db, 'user_interests', 'user_id', $userId, $tagIds);
        $state['interests_selected'] = true;
        srp_mark_step_complete($state, 3);
        $state['current_step'] = 5;
    } elseif ($action === 'set_follows') {
        $communityIds = $payload['community_ids'] ?? [];
        if (!is_array($communityIds) || count($communityIds) < 1) {
            respond_json(['success' => false, 'error' => 'Follow at least one university or group'], 400);
        }

        $communityIds = array_values(array_unique(array_filter(array_map('normalizeId', $communityIds))));
        if (!$communityIds) {
            respond_json(['success' => false, 'error' => 'No valid communities selected'], 400);
        }

        $checkCommunity = $db->prepare("SELECT id FROM communities WHERE id = :cid LIMIT 1");
        $checkFollow = $db->prepare("
            SELECT 1 FROM followed_communities
            WHERE user_id = :uid AND community_id = :cid
            LIMIT 1
        ");
        $insertFollow = $db->prepare("
            INSERT INTO followed_communities (id, user_id, community_id)
            VALUES (:id, :uid, :cid)
        ");
        foreach ($communityIds as $communityId) {
            $checkCommunity->execute([':cid' => $communityId]);
            if (!$checkCommunity->fetchColumn()) {
                continue;
            }
            $checkFollow->execute([':uid' => $userId, ':cid' => $communityId]);
            if ($checkFollow->fetchColumn()) {
                continue;
            }
            $followId = generateUniqueId($db, 'followed_communities');
            $insertFollow->execute([
                ':id' => $followId,
                ':uid' => $userId,
                ':cid' => $communityId,
            ]);
        }

        $state['follows_selected'] = true;
        srp_mark_step_complete($state, 4);
        $state['current_step'] = 5;
    } elseif ($action === 'save_profile_basics') {
        $locationCity = trim((string)($payload['location_city'] ?? ''));
        $locationState = trim((string)($payload['location_state'] ?? ''));
        $skills = $payload['skills'] ?? [];
        $skillsString = '';
        if (is_array($skills)) {
            $clean = array_values(array_filter(array_map(static function ($value) {
                return trim((string)$value);
            }, $skills)));
            $skillsString = implode(', ', $clean);
        } else {
            $skillsString = trim((string)$skills);
        }

        if ($skillsString !== '') {
            $updateSkills = $db->prepare("UPDATE users SET skills = :skills WHERE user_id = :uid");
            $updateSkills->execute([':skills' => $skillsString, ':uid' => $userId]);
        }

        $extras['profile_basics'] = [
            'location_city' => $locationCity,
            'location_state' => $locationState,
            'skills' => $skillsString,
            'updated_at' => gmdate('c'),
        ];
        srp_save_account_settings_extras($db, $userId, $extras);

        $state['profile_basics_completed'] = true;
        srp_mark_step_complete($state, 5);
        if (!empty($state['wants_verification_now'])) {
            $state['wants_verification_now'] = true;
            $state['verification_skipped'] = false;
            $state['current_step'] = 7;
        } else {
            $state['current_step'] = 9;
        }
    } elseif ($action === 'save_context') {
        $roleIntent = srp_normalize_role_intent($payload['role_intent'] ?? $state['role_intent'] ?? '');
        if (!$roleIntent) {
            respond_json(['success' => false, 'error' => 'Role context is required'], 400);
        }

        $context = [
            'role_intent' => $roleIntent,
            'updated_at' => gmdate('c'),
        ];

        if ($roleIntent === 'student' || $roleIntent === 'staff_representative') {
            $communityId = normalizeId($payload['community_id'] ?? '');
            if ($communityId === '') {
                respond_json(['success' => false, 'error' => 'Select a university'], 400);
            }
            $upUser = $db->prepare("UPDATE users SET recent_university_id = :cid WHERE user_id = :uid");
            $upUser->execute([':cid' => $communityId, ':uid' => $userId]);
            $context['community_id'] = $communityId;
            if ($roleIntent === 'staff_representative') {
                $context['position'] = trim((string)($payload['position'] ?? ''));
                $context['attestation_confirmed'] = (int)!empty($payload['attestation_confirmed']);
            }
        } elseif ($roleIntent === 'prospect') {
            $consideringIds = $payload['considering_ids'] ?? [];
            if (!is_array($consideringIds)) {
                $consideringIds = [];
            }
            $consideringIds = array_values(array_unique(array_filter(array_map('normalizeId', $consideringIds))));
            if ($consideringIds) {
                $checkFollow = $db->prepare("
                    SELECT 1 FROM followed_communities
                    WHERE user_id = :uid AND community_id = :cid
                    LIMIT 1
                ");
                $insertFollow = $db->prepare("
                    INSERT INTO followed_communities (id, user_id, community_id)
                    VALUES (:id, :uid, :cid)
                ");
                foreach ($consideringIds as $communityId) {
                    $checkFollow->execute([':uid' => $userId, ':cid' => $communityId]);
                    if ($checkFollow->fetchColumn()) {
                        continue;
                    }
                    $insertFollow->execute([
                        ':id' => generateUniqueId($db, 'followed_communities'),
                        ':uid' => $userId,
                        ':cid' => $communityId,
                    ]);
                }
            }
            $context['considering_ids'] = $consideringIds;
        } elseif ($roleIntent === 'alumni') {
            $communityId = normalizeId($payload['community_id'] ?? '');
            if ($communityId !== '') {
                $existsStmt = $db->prepare("
                    SELECT 1 FROM educational_experience
                    WHERE user_id = :uid AND community_id = :cid
                    LIMIT 1
                ");
                $existsStmt->execute([':uid' => $userId, ':cid' => $communityId]);
                if (!$existsStmt->fetchColumn()) {
                    $insertEdu = $db->prepare("
                        INSERT INTO educational_experience (id, user_id, community_id, start_date, end_date, degree, major)
                        VALUES (:id, :uid, :cid, :start_date, :end_date, :degree, :major)
                    ");
                    $insertEdu->execute([
                        ':id' => generateUniqueId($db, 'educational_experience'),
                        ':uid' => $userId,
                        ':cid' => $communityId,
                        ':start_date' => date('Y-01-01'),
                        ':end_date' => date('Y-12-31'),
                        ':degree' => trim((string)($payload['degree'] ?? '')),
                        ':major' => trim((string)($payload['major'] ?? '')),
                    ]);
                }
                $context['community_id'] = $communityId;
            }
            $context['graduation_year'] = trim((string)($payload['graduation_year'] ?? ''));
        }

        $verificationDecision = trim((string)($payload['verification_decision'] ?? ''));
        if ($verificationDecision === 'verify_now') {
            $state['wants_verification_now'] = true;
            $state['verification_skipped'] = false;
            $state['current_step'] = 7;
        } elseif ($verificationDecision === 'verify_later' || $verificationDecision === 'skip') {
            $state['wants_verification_now'] = false;
            $state['verification_skipped'] = true;
            srp_mark_step_complete($state, 7);
            $state['current_step'] = 9;
        }

        $extras['onboarding_context'] = $context;
        srp_save_account_settings_extras($db, $userId, $extras);
        $state['role_intent'] = $roleIntent;
        $state['context_completed'] = true;
        srp_mark_step_complete($state, 6);
    } elseif ($action === 'submit_verification_request') {
        $verificationType = srp_normalize_role_intent($payload['verification_type'] ?? '');
        if (!in_array($verificationType, ['student', 'staff_representative'], true)) {
            respond_json(['success' => false, 'error' => 'Invalid verification type'], 400);
        }

        $method = trim((string)($payload['verification_method'] ?? ''));
        $validMethods = ['id_photo', 'tuition_statement'];
        if (!in_array($method, $validMethods, true)) {
            respond_json(['success' => false, 'error' => 'Invalid verification method'], 400);
        }

        $communityId = normalizeId($payload['community_id'] ?? '');
        $staffPosition = trim((string)($payload['staff_position'] ?? ''));
        $selfiePath = trim((string)($payload['selfie_path'] ?? ''));
        $idFrontPath = trim((string)($payload['id_front_path'] ?? ''));
        $supportingDocPath = trim((string)($payload['supporting_doc_path'] ?? ''));

        if ($verificationType === 'staff_representative' && $method !== 'id_photo') {
            respond_json(['success' => false, 'error' => 'Staff verification currently supports ID photo only'], 400);
        }

        if ($method === 'id_photo') {
            if ($selfiePath === '' || $idFrontPath === '') {
                respond_json(['success' => false, 'error' => 'Selfie and ID front images are required'], 400);
            }
        }
        if ($method === 'tuition_statement') {
            if ($supportingDocPath === '') {
                respond_json(['success' => false, 'error' => 'Supporting document is required'], 400);
            }
        }

        $pendingStmt = $db->prepare("
            SELECT 1
            FROM user_verification_requests
            WHERE user_id = :uid
              AND verification_type = :vtype
              AND status = 'pending'
            LIMIT 1
        ");
        $pendingStmt->execute([
            ':uid' => $userId,
            ':vtype' => $verificationType,
        ]);
        if ($pendingStmt->fetchColumn()) {
            respond_json(['success' => false, 'error' => 'You already have a pending verification request'], 409);
        }

        $insert = $db->prepare("
            INSERT INTO user_verification_requests (
                request_id, user_id, community_id, verification_type, verification_method,
                staff_position, selfie_path, id_front_path, supporting_doc_path, status
            ) VALUES (
                :id, :uid, :cid, :vtype, :vmethod,
                :staff_position, :selfie_path, :id_front_path, :supporting_doc_path, 'pending'
            )
        ");
        $requestId = generateUniqueId($db, 'user_verification_requests');
        $insert->execute([
            ':id' => $requestId,
            ':uid' => $userId,
            ':cid' => $communityId !== '' ? $communityId : null,
            ':vtype' => $verificationType,
            ':vmethod' => $method,
            ':staff_position' => $staffPosition !== '' ? $staffPosition : null,
            ':selfie_path' => $selfiePath !== '' ? $selfiePath : null,
            ':id_front_path' => $idFrontPath !== '' ? $idFrontPath : null,
            ':supporting_doc_path' => $supportingDocPath !== '' ? $supportingDocPath : null,
        ]);

        send_verification_review_notifications($db, $userId, $verificationType, $communityId !== '' ? $communityId : null, $requestId);

        $state['verification_requested'] = true;
        $state['verification_skipped'] = false;
        $state['wants_verification_now'] = false;
        srp_mark_step_complete($state, 7);
        $state['current_step'] = 9;
        $state['status'] = 'completed';
        $state['completed_at'] = gmdate('c');
    } elseif ($action === 'skip_verification') {
        $state['verification_skipped'] = true;
        $state['wants_verification_now'] = false;
        srp_mark_step_complete($state, 7);
        $state['current_step'] = 9;
    } elseif ($action === 'skip_email_verification') {
        $state['email_verification_skipped'] = true;
        $state['current_step'] = 2;
    } elseif ($action === 'exit_wizard') {
        $state['status'] = 'paused';
    } elseif ($action === 'complete_wizard') {
        $state['status'] = 'completed';
        $state['completed_at'] = gmdate('c');
        $state['current_step'] = 9;
    } else {
        respond_json(['success' => false, 'error' => 'Unknown action'], 400);
    }

    $isVerified = srp_user_has_verified_email($db, $userId);
    if ($state['status'] === 'completed') {
        $state['current_step'] = 9;
    } else {
        $state['current_step'] = onboarding_next_step($state, $isVerified);
    }

    srp_save_onboarding_state($db, $userId, $state);
    respond_json(['success' => true, 'wizard' => $state]);
} catch (Throwable $e) {
    error_log('onboarding_wizard error: ' . $e->getMessage());
    respond_json(['success' => false, 'error' => 'Unable to update onboarding state'], 500);
}
