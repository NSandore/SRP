<?php
session_start();
require_once __DIR__ . '/../reporting_utils.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$userId = normalizeId($_SESSION['user_id']);
$roleId = isset($_SESSION['role_id']) ? (int) $_SESSION['role_id'] : 0;
$isSuperAdmin = false;

try {
    $db = getDB();
    ensureReportsTable($db);

    $roleStmt = $db->prepare("
        SELECT CASE WHEN r.role_name = 'super_admin' OR :rid = 1 THEN 1 ELSE 0 END AS is_super
        FROM roles r
        WHERE r.role_id = :rid
        LIMIT 1
    ");
    $roleStmt->execute([':rid' => $roleId]);
    $isSuperAdmin = (bool)$roleStmt->fetchColumn() || $roleId === 1;

    // Determine accessible communities
    $accessibleCommunities = [];
    if ($isSuperAdmin) {
        $communityStmt = $db->query('SELECT id FROM communities');
        $accessibleCommunities = $communityStmt->fetchAll(PDO::FETCH_COLUMN);
    } else {
        $ambStmt = $db->prepare('SELECT community_id FROM ambassadors WHERE user_id = :uid');
        $ambStmt->execute([':uid' => $userId]);
        $accessibleCommunities = $ambStmt->fetchAll(PDO::FETCH_COLUMN);
    }

    if (!$isSuperAdmin && empty($accessibleCommunities)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You do not have access to reported items.']);
        exit;
    }

    $statusFilter = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : 'pending';
    $allowedStatus = ['pending', 'under_review', 'retained', 'removed', 'dismissed', 'all'];
    if (!in_array($statusFilter, $allowedStatus, true)) {
        $statusFilter = 'pending';
    }

    $where = [];
    $params = [];

    if ($statusFilter !== 'all') {
        $where[] = 'r.status = :status';
        $params['status'] = $statusFilter;
    }

    if (!$isSuperAdmin) {
        $placeholders = [];
        foreach ($accessibleCommunities as $idx => $cid) {
            $ph = ":cid{$idx}";
            $placeholders[] = $ph;
            $params["cid{$idx}"] = $cid;
        }
        if (!empty($placeholders)) {
            $where[] = 'r.community_id IN (' . implode(',', $placeholders) . ')';
        }
    }

    $whereSql = '';
    if (!empty($where)) {
        $whereSql = 'WHERE ' . implode(' AND ', $where);
    }

    $sql = "
        SELECT
            r.report_id,
            r.item_type,
            r.item_id,
            r.forum_id,
            r.thread_id,
            r.community_id,
            r.reported_by,
            r.reported_user_id,
            r.reason,
            r.reason_code,
            r.reason_text,
            r.severity,
            r.details,
            r.item_context,
            r.status,
            r.resolution_notes,
            r.resolved_by,
            r.resolved_at,
            r.created_at,
            r.updated_at,
            c.name AS community_name,
            u.first_name AS reporter_first,
            u.last_name AS reporter_last,
            res.first_name AS resolver_first,
            res.last_name AS resolver_last,
            f.name AS forum_name,
            f.description AS forum_description,
            f.is_hidden AS forum_hidden,
            t.title AS thread_title,
            t.is_hidden AS thread_hidden,
            p.content AS post_content,
            p.is_hidden AS post_hidden,
            a.title AS announcement_title,
            a.body AS announcement_body,
            a.is_hidden AS announcement_hidden,
            e.title AS event_title,
            e.description AS event_description,
            e.is_hidden AS event_hidden,
            targetUser.first_name AS reported_first,
            targetUser.last_name AS reported_last
        FROM reports r
        LEFT JOIN communities c ON c.id = r.community_id
        LEFT JOIN users u ON u.user_id = r.reported_by
        LEFT JOIN users res ON res.user_id = r.resolved_by
        LEFT JOIN forums f ON r.item_type = 'forum' AND f.forum_id = r.item_id
        LEFT JOIN threads t ON r.thread_id = t.thread_id
        LEFT JOIN posts p ON (r.item_type = 'post' OR r.item_type = 'comment') AND p.post_id = r.item_id
        LEFT JOIN announcements a ON r.item_type = 'announcement' AND a.announcement_id = r.item_id
        LEFT JOIN events e ON r.item_type = 'event' AND e.event_id = r.item_id
        LEFT JOIN users targetUser ON r.item_type = 'user' AND targetUser.user_id = r.item_id
        {$whereSql}
        ORDER BY r.created_at DESC
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'reports' => $reports]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
