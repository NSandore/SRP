<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);
$isGlobalAdmin = isAdmin($roleId);
$isAmbassador = false;
if (!$isGlobalAdmin) {
    $ambassadorCheck = $db->prepare('SELECT 1 FROM ambassadors WHERE user_id = :user_id LIMIT 1');
    $ambassadorCheck->execute([':user_id' => $userId]);
    $isAmbassador = (bool)$ambassadorCheck->fetchColumn();
    if (!$isAmbassador) {
        srp_json(['success' => false, 'error' => 'You do not have permission to review knowledge gaps.'], 403);
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    srp_json(['success' => false, 'error' => 'GET is required.'], 405);
}

$allowedStatuses = ['all', 'open', 'in_progress', 'ready_for_review', 'resolved'];
$status = strtolower(trim((string)($_GET['status'] ?? 'open')));
if (!in_array($status, $allowedStatuses, true)) {
    srp_json(['success' => false, 'error' => 'Invalid status filter.'], 400);
}

$search = trim((string)($_GET['q'] ?? ''));
if (mb_strlen($search) > 120) {
    srp_json(['success' => false, 'error' => 'Search is too long.'], 400);
}
$communityId = normalizeId($_GET['community_id'] ?? '');
if (mb_strlen($communityId) > 32) {
    srp_json(['success' => false, 'error' => 'Invalid community filter.'], 400);
}

try {
    $where = [];
    $params = [];
    if (!$isGlobalAdmin) {
        $where[] = 'EXISTS (
            SELECT 1 FROM ambassadors viewer_scope
            WHERE viewer_scope.user_id = :viewer_id
              AND viewer_scope.community_id = c.id
        )';
        $params[':viewer_id'] = $userId;
    }
    if ($status !== 'all') {
        $where[] = 'g.status = :status';
        $params[':status'] = $status;
    }
    if ($communityId !== '') {
        $where[] = 'c.id = :community_id';
        $params[':community_id'] = $communityId;
    }
    if ($search !== '') {
        $noteSearch = $isGlobalAdmin
            ? 'g.admin_notes LIKE :search OR g.contributor_notes LIKE :search'
            : 'g.contributor_notes LIKE :search';
        $where[] = "(t.title LIKE :search OR f.name LIKE :search OR c.name LIKE :search OR g.missing_note LIKE :search OR {$noteSearch})";
        $params[':search'] = '%' . $search . '%';
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $db->prepare(
        "SELECT
            g.gap_id,
            g.source_post_id,
            g.helpful,
            g.resolved_signal,
            g.next_step_signal,
            g.missing_reason,
            g.missing_note,
            g.status,
            g.assigned_to,
            g.contributor_notes,
            g.admin_notes,
            g.resolution_url,
            g.resolved_at,
            g.created_at,
            g.updated_at,
            p.content AS answer_content,
            t.thread_id,
            t.title AS thread_title,
            f.forum_id,
            f.name AS forum_name,
            c.id AS community_id,
            c.name AS community_name,
            assignee.first_name AS assignee_first_name,
            assignee.last_name AS assignee_last_name,
            updater.first_name AS updater_first_name,
            updater.last_name AS updater_last_name
         FROM knowledge_gaps g
         JOIN posts p ON p.post_id = g.source_post_id
         JOIN threads t ON t.thread_id = p.thread_id
         JOIN forums f ON f.forum_id = t.forum_id
         JOIN communities c ON c.id = f.community_id
         LEFT JOIN users assignee ON assignee.user_id = g.assigned_to
         LEFT JOIN users updater ON updater.user_id = g.updated_by
         {$whereSql}
         ORDER BY
            CASE g.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'ready_for_review' THEN 2 ELSE 3 END,
            g.updated_at DESC
         LIMIT 250"
    );
    $stmt->execute($params);

    $counts = ['open' => 0, 'in_progress' => 0, 'ready_for_review' => 0, 'resolved' => 0];
    $countSql = 'SELECT g.status, COUNT(*) AS total
        FROM knowledge_gaps g
        JOIN posts p ON p.post_id = g.source_post_id
        JOIN threads t ON t.thread_id = p.thread_id
        JOIN forums f ON f.forum_id = t.forum_id
        JOIN communities c ON c.id = f.community_id';
    $countWhere = [];
    $countParams = [];
    if (!$isGlobalAdmin) {
        $countWhere[] = 'EXISTS (
            SELECT 1 FROM ambassadors viewer_scope
            WHERE viewer_scope.user_id = :count_viewer_id
              AND viewer_scope.community_id = c.id
        )';
        $countParams[':count_viewer_id'] = $userId;
    }
    if ($communityId !== '') {
        $countWhere[] = 'c.id = :count_community_id';
        $countParams[':count_community_id'] = $communityId;
    }
    if ($countWhere) {
        $countSql .= ' WHERE ' . implode(' AND ', $countWhere);
    }
    $countSql .= ' GROUP BY g.status';
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($countParams);
    foreach ($countStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[$row['status']] = (int)$row['total'];
    }

    $overviewWhere = ["g.status <> 'resolved'"];
    $overviewParams = [];
    if (!$isGlobalAdmin) {
        $overviewWhere[] = 'EXISTS (
            SELECT 1 FROM ambassadors overview_scope
            WHERE overview_scope.user_id = :overview_viewer_id
              AND overview_scope.community_id = c.id
        )';
        $overviewParams[':overview_viewer_id'] = $userId;
    }
    if ($communityId !== '') {
        $overviewWhere[] = 'c.id = :overview_community_id';
        $overviewParams[':overview_community_id'] = $communityId;
    }
    $overviewWhereSql = 'WHERE ' . implode(' AND ', $overviewWhere);
    $overviewFrom = 'FROM knowledge_gaps g
        JOIN posts p ON p.post_id = g.source_post_id
        JOIN threads t ON t.thread_id = p.thread_id
        JOIN forums f ON f.forum_id = t.forum_id
        JOIN communities c ON c.id = f.community_id';
    $statusTotalsSql = "COUNT(*) AS total,
        SUM(g.status = 'open') AS open_count,
        SUM(g.status = 'in_progress') AS in_progress_count,
        SUM(g.status = 'ready_for_review') AS ready_for_review_count";

    $topicStmt = $db->prepare(
        "SELECT f.forum_id AS id, COALESCE(NULLIF(f.name, ''), 'General guidance') AS label, {$statusTotalsSql}
         {$overviewFrom}
         {$overviewWhereSql}
         GROUP BY f.forum_id, f.name
         ORDER BY total DESC, label ASC
         LIMIT 7"
    );
    $topicStmt->execute($overviewParams);

    $communityStmt = $db->prepare(
        "SELECT c.id, c.name AS label, {$statusTotalsSql}
         {$overviewFrom}
         {$overviewWhereSql}
         GROUP BY c.id, c.name
         ORDER BY total DESC, label ASC
         LIMIT 7"
    );
    $communityStmt->execute($overviewParams);

    $reasonStmt = $db->prepare(
        "SELECT g.missing_reason, COUNT(*) AS total
         {$overviewFrom}
         {$overviewWhereSql}
           AND g.missing_reason IS NOT NULL
         GROUP BY g.missing_reason
         ORDER BY total DESC, g.missing_reason ASC
         LIMIT 1"
    );
    $reasonStmt->execute($overviewParams);
    $commonReason = $reasonStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    $presentOverviewRows = static function (array $rows): array {
        return array_map(static function (array $row): array {
            return [
                'id' => (string)$row['id'],
                'label' => (string)$row['label'],
                'total' => (int)$row['total'],
                'open' => (int)$row['open_count'],
                'in_progress' => (int)$row['in_progress_count'],
                'ready_for_review' => (int)$row['ready_for_review_count'],
            ];
        }, $rows);
    };

    $communityFilterWhere = [];
    $communityFilterParams = [];
    if (!$isGlobalAdmin) {
        $communityFilterWhere[] = 'EXISTS (
            SELECT 1 FROM ambassadors filter_scope
            WHERE filter_scope.user_id = :filter_viewer_id
              AND filter_scope.community_id = c.id
        )';
        $communityFilterParams[':filter_viewer_id'] = $userId;
    }
    $communityFilterSql = 'SELECT DISTINCT c.id, c.name
        FROM knowledge_gaps g
        JOIN posts p ON p.post_id = g.source_post_id
        JOIN threads t ON t.thread_id = p.thread_id
        JOIN forums f ON f.forum_id = t.forum_id
        JOIN communities c ON c.id = f.community_id';
    if ($communityFilterWhere) {
        $communityFilterSql .= ' WHERE ' . implode(' AND ', $communityFilterWhere);
    }
    $communityFilterSql .= ' ORDER BY c.name ASC';
    $communityFilterStmt = $db->prepare($communityFilterSql);
    $communityFilterStmt->execute($communityFilterParams);
    $communityFilters = $communityFilterStmt->fetchAll(PDO::FETCH_ASSOC);

    if ($isGlobalAdmin) {
        $peopleStmt = $db->query(
            'SELECT u.user_id, u.first_name, u.last_name, u.role_id,
                    GROUP_CONCAT(DISTINCT a.community_id ORDER BY a.community_id SEPARATOR \',\') AS community_ids
             FROM users u
             LEFT JOIN ambassadors a ON a.user_id = u.user_id
             WHERE (u.role_id >= ' . ROLE_ADMIN . ' OR a.user_id IS NOT NULL)
               AND (u.deletion_status IS NULL OR u.deletion_status = \'active\')
             GROUP BY u.user_id, u.first_name, u.last_name, u.role_id
             ORDER BY u.first_name, u.last_name'
        );
        $people = $peopleStmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $peopleStmt = $db->prepare(
            'SELECT u.user_id, u.first_name, u.last_name, u.role_id,
                    GROUP_CONCAT(DISTINCT a.community_id ORDER BY a.community_id SEPARATOR \',\') AS community_ids
             FROM users u
             JOIN ambassadors a ON a.user_id = u.user_id
             WHERE u.user_id = :user_id
             GROUP BY u.user_id, u.first_name, u.last_name, u.role_id'
        );
        $peopleStmt->execute([':user_id' => $userId]);
        $people = $peopleStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    foreach ($people as &$person) {
        $person['community_ids'] = array_values(array_filter(explode(',', (string)($person['community_ids'] ?? ''))));
    }
    unset($person);

    $gaps = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$isGlobalAdmin) {
        foreach ($gaps as &$gap) {
            unset($gap['admin_notes']);
        }
        unset($gap);
    }

    srp_json([
        'success' => true,
        'gaps' => $gaps,
        'counts' => $counts,
        'overview' => [
            'by_topic' => $presentOverviewRows($topicStmt->fetchAll(PDO::FETCH_ASSOC)),
            'by_community' => $presentOverviewRows($communityStmt->fetchAll(PDO::FETCH_ASSOC)),
            'common_reason' => $commonReason ? [
                'reason' => (string)$commonReason['missing_reason'],
                'total' => (int)$commonReason['total'],
            ] : null,
        ],
        'communities' => $communityFilters,
        'assignees' => $people,
        'viewer_scope' => $isGlobalAdmin ? 'global_admin' : 'ambassador',
        'privacy' => 'Reporter identity is intentionally omitted.',
    ]);
} catch (Throwable $error) {
    error_log('[knowledge-gaps] fetch failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to load knowledge gaps.'], 500);
}
