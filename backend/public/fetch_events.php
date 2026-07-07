<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/event_notifications.php';

try {
    $db = getDB();
    $viewerId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    $viewer = $viewerId !== '' ? eventUserContext($db, $viewerId) : null;

    $stmt = $db->query("
        SELECT
            e.*,
            c.name AS community_name,
            c.parent_community_id,
            c.primary_color AS community_primary_color,
            c.secondary_color AS community_secondary_color,
            parent.id AS parent_community_id_resolved,
            parent.name AS parent_community_name,
            u.first_name AS creator_first_name,
            u.last_name AS creator_last_name,
            (
                SELECT COUNT(*)
                FROM event_registrations er
                WHERE er.event_id = e.event_id AND er.status = 'registered'
            ) AS rsvp_count
        FROM events e
        LEFT JOIN communities c ON c.id = e.community_id
        LEFT JOIN communities parent ON parent.id = c.parent_community_id
        LEFT JOIN users u ON u.user_id = e.created_by
        WHERE e.is_hidden = 0
          AND COALESCE(e.end_at, e.start_at) >= UTC_TIMESTAMP()
        ORDER BY e.start_at ASC
        LIMIT 200
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $registrationStmt = null;
    if ($viewerId !== '') {
        $registrationStmt = $db->prepare("
            SELECT 1 FROM event_registrations
            WHERE event_id = :eid AND user_id = :uid AND status = 'registered'
            LIMIT 1
        ");
    }

    $events = [];
    foreach ($rows as $row) {
        if (!eventUserCanAccess($db, $row, $viewer)) continue;

        $viewerRsvped = false;
        if ($registrationStmt) {
            $registrationStmt->execute([':eid' => $row['event_id'], ':uid' => $viewerId]);
            $viewerRsvped = (bool)$registrationStmt->fetchColumn();
        }

        $canManage = $viewer
            && ($viewerId === normalizeId($row['created_by']) || isAdmin((int)$viewer['role_id']));
        $canSeeMeetingLink = $viewerRsvped || $canManage;
        $startTs = strtotime((string)$row['start_at']);
        $endTs = $row['end_at'] ? strtotime((string)$row['end_at']) : false;
        $duration = $startTs && $endTs ? max(1, (int)round(($endTs - $startTs) / 60)) : 60;

        $hasParentCommunity = !empty($row['parent_community_id']);
        $events[] = [
            'id' => (string)$row['event_id'],
            'type' => 'event',
            'title' => (string)$row['title'],
            'description' => (string)($row['description'] ?? ''),
            'date' => gmdate('Y-m-d\TH:i:s\Z', $startTs ?: time()),
            'endDate' => $endTs ? gmdate('Y-m-d\TH:i:s\Z', $endTs) : null,
            'timezone' => (string)($row['timezone'] ?? 'UTC'),
            'location' => (string)($row['location'] ?? ''),
            'scope' => $row['community_id'] ? 'community' : 'global',
            'communityId' => (string)(
                $hasParentCommunity
                    ? ($row['parent_community_id_resolved'] ?? '')
                    : ($row['community_id'] ?? '')
            ),
            'communityName' => (string)(
                $hasParentCommunity
                    ? ($row['parent_community_name'] ?? 'Community')
                    : ($row['community_name'] ?? 'Global')
            ),
            'subCommunityId' => $hasParentCommunity ? (string)($row['community_id'] ?? '') : '',
            'subCommunityName' => $hasParentCommunity ? (string)($row['community_name'] ?? '') : '',
            'sourceCommunityId' => (string)($row['community_id'] ?? ''),
            'communityPrimaryColor' => (string)($row['community_primary_color'] ?? ''),
            'communitySecondaryColor' => (string)($row['community_secondary_color'] ?? ''),
            'zoomJoinUrl' => $canSeeMeetingLink ? (string)($row['meeting_link'] ?? '') : '',
            'meetingProvider' => (string)($row['meeting_provider'] ?? 'other'),
            'zoomDuration' => $duration,
            'createdBy' => trim(($row['creator_first_name'] ?? '') . ' ' . ($row['creator_last_name'] ?? '')),
            'createdById' => (string)$row['created_by'],
            'allowedAudiences' => eventAllowedAudiences($row['allowed_audiences'] ?? null),
            'rsvpCount' => (int)$row['rsvp_count'],
            'viewerRsvped' => $viewerRsvped,
            'canManage' => (bool)$canManage,
            'isRemote' => true,
        ];
    }

    echo json_encode(['success' => true, 'events' => $events]);
} catch (Throwable $e) {
    error_log('Fetch events failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load events']);
}
