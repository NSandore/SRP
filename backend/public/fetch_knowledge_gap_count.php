<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';

[$db, $userId, $roleId] = srp_bootstrap(requireAuth: true);
$isGlobalAdmin = isAdmin($roleId);

try {
    if ($isGlobalAdmin) {
        $stmt = $db->query("SELECT COUNT(*) FROM knowledge_gaps WHERE status <> 'resolved'");
    } else {
        $ambassadorCheck = $db->prepare('SELECT 1 FROM ambassadors WHERE user_id = :user_id LIMIT 1');
        $ambassadorCheck->execute([':user_id' => $userId]);
        if (!$ambassadorCheck->fetchColumn()) {
            srp_json(['success' => false, 'error' => 'You do not have permission to review knowledge gaps.'], 403);
        }
        $stmt = $db->prepare(
            "SELECT COUNT(*)
             FROM knowledge_gaps g
             JOIN posts p ON p.post_id = g.source_post_id
             JOIN threads t ON t.thread_id = p.thread_id
             JOIN forums f ON f.forum_id = t.forum_id
             WHERE g.status <> 'resolved'
               AND EXISTS (
                   SELECT 1 FROM ambassadors a
                   WHERE a.user_id = :user_id
                     AND a.community_id = f.community_id
               )"
        );
        $stmt->execute([':user_id' => $userId]);
    }

    srp_json(['success' => true, 'pending_count' => (int)$stmt->fetchColumn()]);
} catch (Throwable $error) {
    error_log('[knowledge-gaps] count failed: ' . $error->getMessage());
    srp_json(['success' => false, 'error' => 'Unable to load the knowledge gap count.'], 500);
}
