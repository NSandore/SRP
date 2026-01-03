<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
header('Content-Type: application/json');

$term = isset($_GET['term']) ? trim($_GET['term']) : '';
$excludeCommunity = isset($_GET['exclude_admins_of']) ? (int)$_GET['exclude_admins_of'] : 0;
if ($term === '') {
    echo json_encode(['success' => true, 'users' => []]);
    exit;
}

try {
    $db = getDB();
    $like = '%' . $term . '%';

    if ($excludeCommunity > 0) {
        $query = "SELECT u.user_id, u.first_name, u.last_name, u.email, u.avatar_path, u.is_public, COALESCE(s.discoverable, 2) AS discoverable, u.verified, u.verified_community_id, c.name AS verified_community_name
                  FROM users u
                  LEFT JOIN account_settings s ON s.user_id = u.user_id
                  LEFT JOIN communities c ON c.id = u.verified_community_id
                  WHERE (u.first_name LIKE :term OR u.last_name LIKE :term OR u.email LIKE :term)
                    AND u.user_id NOT IN (
                        SELECT a.user_id
                        FROM ambassadors a
                        WHERE a.community_id = :community_id
                    )
                  ORDER BY u.first_name
                  LIMIT 10";
        $stmt = $db->prepare($query);
        $stmt->bindValue(':term', $like, PDO::PARAM_STR);
        $stmt->bindValue(':community_id', $excludeCommunity, PDO::PARAM_INT);
    } else {
        $stmt = $db->prepare(
            "SELECT u.user_id, u.first_name, u.last_name, u.email, u.avatar_path, u.is_public, COALESCE(s.discoverable, 2) AS discoverable, u.verified, u.verified_community_id, c.name AS verified_community_name
             FROM users u
             LEFT JOIN account_settings s ON s.user_id = u.user_id
             LEFT JOIN communities c ON c.id = u.verified_community_id
             WHERE (u.first_name LIKE :term OR u.last_name LIKE :term OR u.email LIKE :term)
             ORDER BY u.first_name LIMIT 10"
        );
        $stmt->bindValue(':term', $like, PDO::PARAM_STR);
    }

    $viewer_id = isset($_SESSION['user_id']) ? normalizeId($_SESSION['user_id']) : '';
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch connections for viewer (for discoverability=1)
    $connections = [];
    if ($viewer_id) {
        $cstmt = $db->prepare("
            SELECT CASE WHEN user_id1 = :vid THEN user_id2 ELSE user_id1 END AS other_id
            FROM connections
            WHERE (user_id1 = :vid OR user_id2 = :vid) AND status = 'accepted'
        ");
        $cstmt->execute([':vid' => $viewer_id]);
        $connections = $cstmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    $filtered = [];
    foreach ($users as $u) {
        $isViewer = $viewer_id !== '' && $u['user_id'] === $viewer_id;
        $disc = (int)$u['discoverable'];
        $isConnection = $isViewer ? false : in_array($u['user_id'], $connections, true);
        $canShow = $disc === 2 || ($disc === 1 && $isConnection) || $isViewer;
        if (!$canShow) {
            continue;
        }
        if ((int)$u['is_public'] === 0 && !$isViewer) {
            $u['last_name'] = substr($u['last_name'], 0, 1) . '.';
        }
        unset($u['is_public'], $u['discoverable']);
        $filtered[] = $u;
    }
    echo json_encode(['success' => true, 'users' => $filtered]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}
?>
