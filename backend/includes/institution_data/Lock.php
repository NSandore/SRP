<?php

declare(strict_types=1);

/**
 * Prevents overlapping refreshes without adding a pipeline-run table.
 */
final class SrpInstitutionRunLock
{
    private PDO $db;
    private string $lockName;
    /** @var resource|null */
    private $fileHandle = null;
    private bool $databaseLockHeld = false;

    public function __construct(
        PDO $db,
        string $runtimePath,
        string $lockName = 'srp:institution-data:refresh'
    ) {
        $this->db = $db;
        $this->lockName = $lockName;
        if (!preg_match('/^[A-Za-z0-9:._-]{1,64}$/', $lockName)) {
            throw new InvalidArgumentException('Invalid institution lock name.');
        }

        if (!is_dir($runtimePath) && !mkdir($runtimePath, 0770, true) && !is_dir($runtimePath)) {
            throw new RuntimeException('Unable to create the institution runtime directory.');
        }
        $lockPath = rtrim($runtimePath, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'refresh.lock';
        $handle = fopen($lockPath, 'c+');
        if ($handle === false) {
            throw new RuntimeException('Unable to open the institution refresh lock.');
        }
        @chmod($lockPath, 0660);
        $this->fileHandle = $handle;
    }

    public function acquire(): void
    {
        if ($this->databaseLockHeld) {
            return;
        }
        if (!is_resource($this->fileHandle) || !flock($this->fileHandle, LOCK_EX | LOCK_NB)) {
            throw new RuntimeException('Another institution data refresh is already running.');
        }

        try {
            $stmt = $this->db->prepare('SELECT GET_LOCK(:lock_name, 0)');
            $stmt->execute([':lock_name' => $this->lockName]);
            if ((int)$stmt->fetchColumn() !== 1) {
                flock($this->fileHandle, LOCK_UN);
                throw new RuntimeException('Another institution data refresh holds the database lock.');
            }
            $this->databaseLockHeld = true;
            ftruncate($this->fileHandle, 0);
            rewind($this->fileHandle);
            fwrite($this->fileHandle, json_encode([
                'pid' => getmypid(),
                'acquired_at' => gmdate(DATE_ATOM),
            ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
            fflush($this->fileHandle);
        } catch (Throwable $error) {
            if (is_resource($this->fileHandle)) {
                flock($this->fileHandle, LOCK_UN);
            }
            throw $error;
        }
    }

    public function release(): void
    {
        if ($this->databaseLockHeld) {
            try {
                $stmt = $this->db->prepare('SELECT RELEASE_LOCK(:lock_name)');
                $stmt->execute([':lock_name' => $this->lockName]);
            } finally {
                $this->databaseLockHeld = false;
            }
        }
        if (is_resource($this->fileHandle)) {
            ftruncate($this->fileHandle, 0);
            fflush($this->fileHandle);
            flock($this->fileHandle, LOCK_UN);
        }
    }

    public function __destruct()
    {
        try {
            $this->release();
        } catch (Throwable $ignored) {
            // The MySQL connection closing also releases its advisory lock.
        }
        if (is_resource($this->fileHandle)) {
            fclose($this->fileHandle);
        }
    }
}
