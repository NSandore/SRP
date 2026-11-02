<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';

[$db] = srp_bootstrap(requireAuth: true);
srp_require_role(ROLE_ADMIN);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    srp_json(['success' => false, 'error' => 'GET is required.'], 405);
}

$allowedStatuses = ['all', 'open', 'in_progress', 'resolved'];
$status = strtolower(trim((string)($_GET['status'] ?? 'open')));
if (!in_array($status, $allowedStatuses, true)) {
    srp_json(['success' => false, 'error' => 'Invalid status filter.'], 400);
}

$search = trim((string)($_GET['q'] ?? ''));
if (mb_strlen($search) > 120) {
    srp_json(['success' => false, 'error' => 'Search is too long.'], 400);
}

try {
    $where = [];
    $params = [];
    if ($status !== 'all') {
        $where[] = 'g.status = :status';
        $params[':status'] = $status;
    }
    if ($search !== '') {
        $where[] = '(t.title LIKE :search OR f.name LIKE :search OR c.name LIKE :search OR g.missing_note LIKE :search OR g.admin_notes LIKE :search)';
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
            CASE g.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            g.updated_at DESC
         LIMIT 250"
    );
    $stmt->execute($params);

    $counts = ['open' => 0, 'in_progress' => 0, 'resolved' => 0];
    foreach ($db->query('SELECT status, COUNT(*) AS total FROM knowledge_gaps GROUP BY status')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[$row['status']] = (int)$row['total'];
    }

    $people = $db->query(
        'SELECT user_id, first_name, last_name, role_id
         FROM users
         WHERE role_id >= ' . ROLE_ADMIN . '
           AND (deletion_status IS NULL OR deletion_status = \'active\')
         ORDER BY first_name, last_name'
    )->fetchAll(PDO::FETCH_ASSOC);

    srp_json([
        'success' => true,
        'gaps' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'counts' => $counts,
        'assignees' => $people,
        'privacy' => 'Reporter identity is intentionally omitted.',
    ]);
} catch (Throwable $error) {
    error_log('[knowledge-gaps] fetch failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to load knowledge gaps.'], 500);
}
