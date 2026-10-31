<?php
declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../includes/account_deletion.php';

$db = getDB();
$stmt = $db->query("
    SELECT * FROM users
    WHERE deletion_status = 'pending'
      AND scheduled_purge_at IS NOT NULL
      AND scheduled_purge_at <= UTC_TIMESTAMP()
    ORDER BY scheduled_purge_at
");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
$purged = 0;
foreach ($users as $user) {
    try {
        $db->beginTransaction();
        $lock = $db->prepare("SELECT * FROM users WHERE user_id = :uid FOR UPDATE");
        $lock->execute([':uid' => $user['user_id']]);
        $current = $lock->fetch(PDO::FETCH_ASSOC);
        if (!$current || ($current['deletion_status'] ?? '') !== 'pending') {
            $db->rollBack();
            continue;
        }
        srp_purge_account($db, $current, false);
        $db->commit();
        $purged++;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        fwrite(STDERR, "Failed to purge {$user['user_id']}: {$e->getMessage()}\n");
    }
}
fwrite(STDOUT, "Purged {$purged} account(s).\n");
