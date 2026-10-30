<?php
declare(strict_types=1);

/**
 * Clone production structure into the development database. The default mode
 * copies no user data; --include-data creates a point-in-time functional clone
 * while removing active sessions and integration credentials.
 */

function readEnv(string $path): array {
    if (!is_readable($path)) {
        throw new RuntimeException("Environment file is not readable: {$path}");
    }
    $result = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key);
        $value = trim($value);
        if ($key === '') {
            continue;
        }
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        $result[$key] = $value;
    }
    return $result;
}

function requireKeys(array $env, array $keys, string $label): void {
    foreach ($keys as $key) {
        if (!isset($env[$key]) || $env[$key] === '') {
            throw new RuntimeException("{$label} is missing {$key}");
        }
    }
}

function runProcess(array $command, array $environment, $stdin, $stdout): void {
    $process = proc_open($command, [
        0 => $stdin,
        1 => $stdout,
        2 => ['pipe', 'w'],
    ], $pipes, null, $environment);
    if (!is_resource($process)) {
        throw new RuntimeException('Could not start: ' . implode(' ', $command));
    }
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[2]);
    $status = proc_close($process);
    if ($status !== 0) {
        throw new RuntimeException(trim((string)$error) ?: ('Command failed: ' . $command[0]));
    }
}

$productionPath = $argv[1] ?? '/home/nick/.config/srp/production.env';
$developmentPath = $argv[2] ?? '/home/nick/.config/srp/development.env';
$allowReset = in_array('--reset-development', $argv, true);
$includeData = in_array('--include-data', $argv, true);
$temporaryDump = tempnam(sys_get_temp_dir(), 'srp-dev-schema-');
if ($temporaryDump === false) {
    fwrite(STDERR, "Could not create temporary schema file.\n");
    exit(1);
}
chmod($temporaryDump, 0600);

try {
    $production = readEnv($productionPath);
    $development = readEnv($developmentPath);
    $required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];
    requireKeys($production, $required, 'Production environment');
    requireKeys($development, $required, 'Development environment');
    if ($production['DB_NAME'] === $development['DB_NAME']) {
        throw new RuntimeException('Development and production database names must differ.');
    }

    $dev = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $development['DB_HOST'], $development['DB_NAME']),
        $development['DB_USER'],
        $development['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $existingObjects = $dev->query(
        'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    )->fetchAll(PDO::FETCH_ASSOC);
    if ($existingObjects !== [] && !$allowReset) {
        throw new RuntimeException('Development database is not empty; pass --reset-development to rebuild it.');
    }
    if ($existingObjects !== []) {
        $dev->exec('SET FOREIGN_KEY_CHECKS=0');
        // Views must be removed before their underlying tables.
        usort($existingObjects, static fn(array $left, array $right): int =>
            ($left['TABLE_TYPE'] === 'VIEW' ? 0 : 1) <=> ($right['TABLE_TYPE'] === 'VIEW' ? 0 : 1)
        );
        foreach ($existingObjects as $object) {
            $name = str_replace('`', '``', (string)$object['TABLE_NAME']);
            $kind = $object['TABLE_TYPE'] === 'VIEW' ? 'VIEW' : 'TABLE';
            $dev->exec("DROP {$kind} IF EXISTS `{$name}`");
        }
        $dev->exec('SET FOREIGN_KEY_CHECKS=1');
    }

    $dumpHandle = fopen($temporaryDump, 'wb');
    if ($dumpHandle === false) {
        throw new RuntimeException('Could not open temporary schema file.');
    }
    $dumpCommand = [
        '/usr/bin/mysqldump',
        '--skip-triggers',
        '--skip-routines',
        '--skip-events',
        '--single-transaction',
        '--no-tablespaces',
        '--default-character-set=utf8mb4',
        '--host=' . $production['DB_HOST'],
        '--user=' . $production['DB_USER'],
        $production['DB_NAME'],
    ];
    if (!$includeData) {
        array_splice($dumpCommand, 1, 0, ['--no-data']);
    }
    runProcess($dumpCommand, array_merge($_ENV, ['MYSQL_PWD' => $production['DB_PASS']]), ['file', '/dev/null', 'r'], $dumpHandle);
    fclose($dumpHandle);

    // Views exported by MySQL carry the production account as their DEFINER.
    // A least-privilege development user must not impersonate that account.
    $schemaSql = file_get_contents($temporaryDump);
    if ($schemaSql === false) {
        throw new RuntimeException('Could not read temporary schema file.');
    }
    $schemaSql = preg_replace(
        '/DEFINER\s*=\s*`[^`]+`@`[^`]+`/i',
        'DEFINER=CURRENT_USER',
        $schemaSql
    );
    if ($schemaSql === null || file_put_contents($temporaryDump, $schemaSql, LOCK_EX) === false) {
        throw new RuntimeException('Could not normalize schema definers.');
    }

    runProcess([
        '/usr/bin/mysql',
        '--default-character-set=utf8mb4',
        '--host=' . $development['DB_HOST'],
        '--user=' . $development['DB_USER'],
        $development['DB_NAME'],
    ], array_merge($_ENV, ['MYSQL_PWD' => $development['DB_PASS']]), ['file', $temporaryDump, 'r'], ['file', '/dev/null', 'w']);

    if ($includeData) {
        // Never duplicate live authentication sessions, throttling state, or
        // encrypted external-service credentials into development. User and
        // content records remain intact for realistic application testing.
        $dev->exec('DELETE FROM user_sessions');
        $dev->exec('DELETE FROM rate_limits');
        $dev->exec("
            UPDATE account_settings
            SET extras = JSON_REMOVE(
                COALESCE(extras, JSON_OBJECT()),
                '$.zoom_access_token',
                '$.zoom_refresh_token',
                '$.zoom_expires_at',
                '$.zoom_user_id',
                '$.zoom_email',
                '$.zoom_account_id',
                '$.two_factor_code',
                '$.two_factor_expires_at'
            )
        ");
        fwrite(STDOUT, "Development database refreshed from production data with sessions and integrations neutralized.\n");
    } else {
        $dev->exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(191) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $recordMigration = $dev->prepare('INSERT IGNORE INTO schema_migrations (filename) VALUES (:filename)');
        foreach (glob(__DIR__ . '/../backend/migrations/*.sql') ?: [] as $migration) {
            $recordMigration->execute([':filename' => basename($migration)]);
        }

        // Copy only non-personal reference data required by onboarding and role
        // displays. No users, sessions, messages, content, or documents are copied.
        $prod = new PDO(
            sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $production['DB_HOST'], $production['DB_NAME']),
            $production['DB_USER'],
            $production['DB_PASS'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        $dev->exec('SET FOREIGN_KEY_CHECKS=0');
        foreach (['roles', 'tags'] as $table) {
            $columnMetadata = $dev->query("SHOW COLUMNS FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
            $columns = array_values(array_map(
                static fn(array $column): string => (string)$column['Field'],
                array_filter(
                    $columnMetadata,
                    static fn(array $column): bool => stripos((string)($column['Extra'] ?? ''), 'GENERATED') === false
                )
            ));
            if ($columns === []) {
                throw new RuntimeException("No writable columns found for {$table}");
            }
            $quoted = implode(', ', array_map(static fn(string $column): string => "`{$column}`", $columns));
            $rows = $prod->query("SELECT {$quoted} FROM `{$table}`")->fetchAll();
            $dev->exec("DELETE FROM `{$table}`");
            if ($rows !== []) {
                $bindings = implode(', ', array_map(static fn(string $column): string => ":{$column}", $columns));
                $insert = $dev->prepare("INSERT INTO `{$table}` ({$quoted}) VALUES ({$bindings})");
                foreach ($rows as $row) {
                    $insert->execute($row);
                }
            }
        }
        $dev->exec('SET FOREIGN_KEY_CHECKS=1');

        fwrite(STDOUT, "Development schema initialized without production user data.\n");
    }
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
} finally {
    @unlink($temporaryDump);
}
