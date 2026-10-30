<?php
/**
 * Return polls visible to the current user, with options, live tallies, and
 * the user's own selections. Visibility:
 *   - global polls: everyone
 *   - community polls: super/global admins, ambassadors of the community, and
 *     users who follow that community
 */
require_once __DIR__ . '/../session_bootstrap.php';
startSession();
header('Content-Type: application/json');
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/roles.php';
require_once __DIR__ . '/../includes/permissions.php';

$userId = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
$roleId = (int)($_SESSION['role_id'] ?? 0);

try {
    $db = getDB();

    // Communities the user can see community-scoped polls for.
    $visibleCommunities = [];
    $isGlobalAdmin = isAdmin($roleId);
    if ($userId !== '' && !$isGlobalAdmin) {
        $cs = $db->prepare("SELECT community_id FROM followed_communities WHERE user_id = :uid");
        $cs->execute([':uid' => $userId]);
        $visibleCommunities = array_map('strval', $cs->fetchAll(PDO::FETCH_COLUMN));

        $as = $db->prepare("SELECT community_id FROM ambassadors WHERE user_id = :uid");
        $as->execute([':uid' => $userId]);
        foreach ($as->fetchAll(PDO::FETCH_COLUMN) as $cid) {
            $visibleCommunities[] = (string)$cid;
        }
        $visibleCommunities = array_values(array_unique($visibleCommunities));
    }

    $pollStmt = $db->query("
        SELECT p.poll_id, p.community_id, p.created_by, p.question, p.description,
               p.is_anonymous, p.allow_multiple_choices, p.opens_at, p.closes_at,
               c.name AS community_name
        FROM polls p
        LEFT JOIN communities c ON c.id = p.community_id
        ORDER BY p.created_at DESC
    ");
    $allPolls = $pollStmt->fetchAll(PDO::FETCH_ASSOC);

    // Preload the user's own votes.
    $userVotes = [];
    if ($userId !== '') {
        $vs = $db->prepare("SELECT poll_id, option_id FROM poll_votes WHERE user_id = :uid");
        $vs->execute([':uid' => $userId]);
        foreach ($vs->fetchAll(PDO::FETCH_ASSOC) as $v) {
            $userVotes[$v['poll_id']][] = $v['option_id'];
        }
    }

    $result = [];
    foreach ($allPolls as $poll) {
        $communityId = $poll['community_id'] !== null ? (string)$poll['community_id'] : '';

        // Visibility filter.
        if ($communityId !== '') {
            if (!$isGlobalAdmin && !in_array($communityId, $visibleCommunities, true)) {
                continue;
            }
        }

        // Options + tallies.
        $optStmt = $db->prepare("
            SELECT o.option_id, o.option_text, o.position,
                   (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.option_id) AS votes
            FROM poll_options o
            WHERE o.poll_id = :pid
            ORDER BY o.position ASC
        ");
        $optStmt->execute([':pid' => $poll['poll_id']]);
        $options = [];
        $total = 0;
        foreach ($optStmt->fetchAll(PDO::FETCH_ASSOC) as $o) {
            $votes = (int)$o['votes'];
            $total += $votes;
            $options[] = [
                'option_id' => $o['option_id'],
                'text' => $o['option_text'],
                'votes' => $votes,
            ];
        }

        $myChoices = $userVotes[$poll['poll_id']] ?? [];
        $closesTs = $poll['closes_at'] ? strtotime($poll['closes_at']) : null;

        $result[] = [
            'poll_id' => $poll['poll_id'],
            'question' => $poll['question'],
            'description' => $poll['description'],
            'scope' => $communityId !== '' ? 'community' : 'global',
            'community_id' => $communityId,
            'community_name' => $poll['community_name'] ?? '',
            'allow_multiple_choices' => (int)$poll['allow_multiple_choices'] === 1,
            'is_anonymous' => (int)$poll['is_anonymous'] === 1,
            'closes_at' => $poll['closes_at'],
            'closed' => $closesTs !== null && $closesTs < time(),
            'options' => $options,
            'total_votes' => $total,
            'user_choices' => $myChoices,
            'has_voted' => count($myChoices) > 0,
            'is_owner' => $userId !== '' && (string)$poll['created_by'] === $userId,
        ];
    }

    echo json_encode(['success' => true, 'polls' => $result]);
} catch (PDOException $e) {
    error_log('[SRP] fetch_polls error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load polls.', 'polls' => []]);
}
