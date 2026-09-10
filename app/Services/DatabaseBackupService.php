<?php

namespace App\Services;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class DatabaseBackupService
{
    public function create(): string
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();

        if (! in_array($driver, ['mysql', 'sqlite'], true)) {
            throw new RuntimeException("Database backup is not supported for the [{$driver}] driver.");
        }

        $path = tempnam(sys_get_temp_dir(), 'rms-db-');

        if ($path === false) {
            throw new RuntimeException('Unable to create a temporary database backup file.');
        }

        try {
            $handle = fopen($path, 'wb');

            if ($handle === false) {
                throw new RuntimeException('Unable to open the temporary database backup file.');
            }

            try {
                $this->writeHeader($handle, $driver, (string) $connection->getDatabaseName());

                if ($driver === 'mysql') {
                    $this->writeMysqlBackup($handle, $connection);
                } else {
                    $this->writeSqliteBackup($handle, $connection);
                }
            } finally {
                fclose($handle);
            }

            return $path;
        } catch (Throwable $exception) {
            @unlink($path);
            throw $exception;
        }
    }

    private function writeHeader($handle, string $driver, string $database): void
    {
        $safeDatabase = preg_replace('/[^A-Za-z0-9_.-]/', '_', $database) ?: 'database';

        $this->write($handle, "-- RMS database backup\n");
        $this->write($handle, '-- Generated: '.now()->format('Y-m-d H:i:s')."\n");
        $this->write($handle, '-- Driver: '.$driver."\n");
        $this->write($handle, '-- Database: '.$safeDatabase."\n\n");
    }

    private function writeMysqlBackup($handle, ConnectionInterface $connection): void
    {
        $this->write($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

        $tables = collect($connection->select('SHOW TABLES'))
            ->map(fn ($row) => (string) array_values((array) $row)[0])
            ->sort()
            ->values();

        foreach ($tables as $table) {
            $quotedTable = $this->mysqlIdentifier($table);
            $createRows = $connection->select('SHOW CREATE TABLE '.$quotedTable);

            if ($createRows === []) {
                continue;
            }

            $create = array_values((array) $createRows[0])[1] ?? null;

            if (! is_string($create) || $create === '') {
                continue;
            }

            $this->write($handle, "-- Table: {$table}\n");
            $this->write($handle, 'DROP TABLE IF EXISTS '.$quotedTable.";\n");
            $this->write($handle, rtrim($create, ';').";\n\n");

            foreach ($connection->table($table)->orderByRaw('1')->cursor() as $row) {
                $values = array_map(fn ($value) => $this->sqlValue($connection, $value), array_values((array) $row));
                $this->write($handle, 'INSERT INTO '.$quotedTable.' VALUES ('.implode(', ', $values).");\n");
            }

            $this->write($handle, "\n");
        }

        $this->write($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
    }

    private function writeSqliteBackup($handle, ConnectionInterface $connection): void
    {
        $this->write($handle, "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n");

        $tables = collect($connection->select("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"));

        foreach ($tables as $tableRow) {
            $table = (string) $tableRow->name;
            $create = (string) ($tableRow->sql ?? '');

            if ($create === '') {
                continue;
            }

            $quotedTable = $this->sqliteIdentifier($table);
            $this->write($handle, "-- Table: {$table}\n");
            $this->write($handle, 'DROP TABLE IF EXISTS '.$quotedTable.";\n");
            $this->write($handle, rtrim($create, ';').";\n\n");

            foreach ($connection->table($table)->cursor() as $row) {
                $values = array_map(fn ($value) => $this->sqlValue($connection, $value), array_values((array) $row));
                $this->write($handle, 'INSERT INTO '.$quotedTable.' VALUES ('.implode(', ', $values).");\n");
            }

            $this->write($handle, "\n");
        }

        $this->write($handle, "COMMIT;\nPRAGMA foreign_keys=ON;\n");
    }

    private function sqlValue(ConnectionInterface $connection, mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        $quoted = $connection->getPdo()->quote((string) $value);

        if ($quoted === false) {
            throw new RuntimeException('Unable to quote a database value while generating the backup.');
        }

        return $quoted;
    }

    private function mysqlIdentifier(string $identifier): string
    {
        return '`'.str_replace('`', '``', $identifier).'`';
    }

    private function sqliteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function write($handle, string $contents): void
    {
        if (fwrite($handle, $contents) === false) {
            throw new RuntimeException('Unable to write the database backup file.');
        }
    }
}
