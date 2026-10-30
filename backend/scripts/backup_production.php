<?php
declare(strict_types=1);

/**
 * Create a local, owner-only database and upload backup before deployment.
 * Keep an off-host copy separately; this protects only against application and
 * migration mistakes, not loss of the server itself.
 */

require_once __DIR__ . '/../db_connection.php';

$backupDir = getenv('SRP_BACKUP_DIR') ?: '/home/nick/services/backups/srp';
$projectRoot = realpath(__DIR__ . '/../..');
if ($projectRoot === false) {
    fwrite(STDERR, "Could not resolve project root.\n");
    exit(1);
}

if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
    fwrite(STDERR, "Could not create backup directory.\n");
    exit(1);
}
chmod($backupDir, 0700);

$stamp = date('Ymd-His');
$prefix = $backupDir . '/studentsphere-' . $stamp;
$sqlPath = $prefix . '.sql';
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'srp_db';
$dbUser = getenv('DB_USER') ?: 'srp_user';
$dbPass = getenv('DB_PASS') ?: '';

$sqlHandle = fopen($sqlPath, 'xb');
if ($sqlHandle === false) {
    fwrite(STDERR, "Could not create SQL backup file.\n");
    exit(1);
}
chmod($sqlPath, 0600);

$dump = proc_open([
    '/usr/bin/mysqldump',
    '--single-transaction',
    '--quick',
    '--lock-tables=false',
    '--no-tablespaces',
    // The application DB user intentionally cannot inspect server-wide
    // routine metadata. Application tables, triggers, events, and data are
    // still backed up; routines must be recreated from versioned migrations.
    '--skip-routines',
    '--triggers',
    '--events',
    '--default-character-set=utf8mb4',
    '--host=' . $dbHost,
    '--user=' . $dbUser,
    $dbName,
], [0 => ['file', '/dev/null', 'r'], 1 => $sqlHandle, 2 => ['pipe', 'w']], $pipes, null, array_merge($_ENV, ['MYSQL_PWD' => $dbPass]));

if (!is_resource($dump)) {
    fclose($sqlHandle);
    @unlink($sqlPath);
    fwrite(STDERR, "Could not start mysqldump.\n");
    exit(1);
}
$dumpError = stream_get_contents($pipes[2]);
fclose($pipes[2]);
$dumpStatus = proc_close($dump);
fclose($sqlHandle);
if ($dumpStatus !== 0) {
    @unlink($sqlPath);
    fwrite(STDERR, "Database backup failed: " . trim((string)$dumpError) . "\n");
    exit(1);
}

$gzip = proc_open(['/usr/bin/gzip', '--force', $sqlPath], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['pipe', 'w']], $pipes);
$gzipError = is_resource($gzip) ? stream_get_contents($pipes[2]) : 'could not start gzip';
if (is_resource($gzip)) {
    fclose($pipes[2]);
}
$gzipStatus = is_resource($gzip) ? proc_close($gzip) : 1;
if ($gzipStatus !== 0) {
    fwrite(STDERR, "Backup compression failed: " . trim((string)$gzipError) . "\n");
    exit(1);
}
chmod($sqlPath . '.gz', 0600);

$uploadArchive = null;
$uploadsDir = $projectRoot . '/uploads';
if (is_dir($uploadsDir)) {
    $uploadArchive = $prefix . '-uploads.tar.gz';
    // Production releases link uploads to shared runtime storage. Dereference
    // that link so the backup contains the files, not only the symlink.
    $tar = proc_open(['/usr/bin/tar', '--dereference', '-C', $projectRoot, '-czf', $uploadArchive, 'uploads'], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['pipe', 'w']], $pipes);
    $tarError = is_resource($tar) ? stream_get_contents($pipes[2]) : 'could not start tar';
    if (is_resource($tar)) {
        fclose($pipes[2]);
    }
    $tarStatus = is_resource($tar) ? proc_close($tar) : 1;
    if ($tarStatus !== 0) {
        @unlink($uploadArchive);
        fwrite(STDERR, "Upload backup failed: " . trim((string)$tarError) . "\n");
        exit(1);
    }
    chmod($uploadArchive, 0600);
}

foreach (glob($backupDir . '/studentsphere-*') ?: [] as $oldBackup) {
    if (is_file($oldBackup) && filemtime($oldBackup) < time() - (14 * 86400)) {
        @unlink($oldBackup);
    }
}

echo "Database backup: " . $sqlPath . ".gz\n";
if ($uploadArchive !== null) {
    echo "Upload backup: " . $uploadArchive . "\n";
}
