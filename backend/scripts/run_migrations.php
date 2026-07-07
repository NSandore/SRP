<?php
/**
 * Minimal forward-only SQL migration runner.
 *
 * Applies every *.sql file in backend/migrations/ (sorted by name) that has not
 * already been recorded in the schema_migrations table. Idempotency errors
 * (object already exists / duplicate column) are treated as already-applied so
 * migrations that were run by hand before this runner existed are absorbed
 * cleanly on first run.
 *
 * Usage:  php backend/scripts/run_migrations.php
 */

require_once __DIR__ . '/../db_connection.php';

$migrationsDir = __DIR__ . '/../migrations';

function is_ignorable_sql_error(PDOException $e): bool {
    // 1050 table exists, 1060 duplicate column, 1061 duplicate key,
    // 1091 can't DROP (doesn't exist), 1826/1022 duplicate constraint/key.
    $ignorable = ['1050', '1060', '1061', '1091', '1022', '1826'];
    $driverCode = isset($e->errorInfo[1]) ? (string)$e->errorInfo[1] : '';
    return in_array($driverCode, $ignorable, true);
}

try {
    $db = getDB();
    $db->exec("
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(191) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $applied = $db->query("SELECT filename FROM schema_migrations")->fetchAll(PDO::FETCH_COLUMN);
    $applied = array_flip($applied);

    $files = glob($migrationsDir . '/*.sql') ?: [];
    sort($files);

    $record = $db->prepare("INSERT IGNORE INTO schema_migrations (filename) VALUES (:f)");
    $ran = 0;

    foreach ($files as $file) {
        $name = basename($file);
        if (isset($applied[$name])) {
            continue;
        }

        $sql = file_get_contents($file);
        if ($sql === false) {
            fwrite(STDERR, "Could not read {$name}\n");
            continue;
        }

        // Split on statement terminators. Migration files here use one
        // statement per ';' with no embedded semicolons in string literals.
        $statements = array_filter(array_map('trim', explode(';', $sql)), function ($s) {
            return $s !== '' && strpos($s, '--') !== 0;
        });

        $ok = true;
        foreach ($statements as $statement) {
            try {
                $db->exec($statement);
            } catch (PDOException $e) {
                if (is_ignorable_sql_error($e)) {
                    fwrite(STDOUT, "  (skipping already-applied part of {$name}: " . $e->errorInfo[1] . ")\n");
                    continue;
                }
                $ok = false;
                fwrite(STDERR, "FAILED {$name}: " . $e->getMessage() . "\n");
                break;
            }
        }

        if ($ok) {
            $record->execute([':f' => $name]);
            $ran++;
            fwrite(STDOUT, "Applied {$name}\n");
        }
    }

    fwrite(STDOUT, "Done. {$ran} migration(s) applied.\n");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'Migration runner error: ' . $e->getMessage() . "\n");
    exit(1);
}
