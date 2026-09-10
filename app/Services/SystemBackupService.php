<?php

namespace App\Services;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use Throwable;
use ZipArchive;

class SystemBackupService
{
    public function __construct(private DatabaseBackupService $databaseBackups)
    {
    }

    public function create(): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('ZIP support is not available on this server.');
        }

        $zipPath = tempnam(sys_get_temp_dir(), 'rms-system-');
        if ($zipPath === false) {
            throw new RuntimeException('Unable to create a temporary system backup file.');
        }

        $databasePath = null;

        try {
            $databasePath = $this->databaseBackups->create();

            $zip = new ZipArchive();
            $opened = $zip->open($zipPath, ZipArchive::OVERWRITE);
            if ($opened !== true) {
                throw new RuntimeException('Unable to initialize the system backup archive.');
            }

            try {
                $this->addApplicationFiles($zip);
                $this->addStorageFiles($zip);

                if (! $zip->addFile($databasePath, 'database/rms-database.sql')) {
                    throw new RuntimeException('Unable to add the database backup to the archive.');
                }

                $zip->addFromString('BACKUP-INFO.txt', $this->backupInfo());
            } finally {
                if (! $zip->close()) {
                    throw new RuntimeException('Unable to finalize the system backup archive.');
                }
            }

            if (! is_file($zipPath) || filesize($zipPath) === false || filesize($zipPath) < 1) {
                throw new RuntimeException('The generated system backup archive is empty.');
            }

            $verification = new ZipArchive();
            $verificationResult = $verification->open($zipPath, ZipArchive::CHECKCONS);
            if ($verificationResult !== true) {
                throw new RuntimeException('The generated system backup archive failed integrity validation.');
            }
            $verification->close();

            return $zipPath;
        } catch (Throwable $exception) {
            @unlink($zipPath);
            throw $exception;
        } finally {
            if ($databasePath && is_file($databasePath)) {
                @unlink($databasePath);
            }
        }
    }

    private function addApplicationFiles(ZipArchive $zip): void
    {
        $root = base_path();
        $allowedRoots = [
            'app',
            'bootstrap',
            'config',
            'database',
            'docs',
            'public',
            'resources',
            'routes',
        ];

        foreach ($allowedRoots as $directory) {
            $path = $root.DIRECTORY_SEPARATOR.$directory;
            if (is_dir($path)) {
                $this->addDirectory($zip, $path, $directory, fn (string $relative) => $this->skipApplicationPath($relative));
            }
        }

        foreach ([
            '.editorconfig', '.env.example', '.gitattributes', '.gitignore', '.prettierrc.json',
            'artisan', 'composer.json', 'composer.lock', 'package.json', 'package-lock.json',
            'phpunit.xml', 'postcss.config.js', 'README.md', 'tailwind.config.js', 'tsconfig.json', 'vite.config.js',
        ] as $file) {
            $path = $root.DIRECTORY_SEPARATOR.$file;
            if (is_file($path) && ! $zip->addFile($path, 'application/'.$file)) {
                throw new RuntimeException("Unable to add [{$file}] to the system backup.");
            }
        }
    }

    private function addStorageFiles(ZipArchive $zip): void
    {
        $storageRoots = [
            storage_path('app/private') => 'storage/app/private',
            storage_path('app/public') => 'storage/app/public',
        ];

        foreach ($storageRoots as $path => $archivePath) {
            if (is_dir($path)) {
                $this->addDirectory($zip, $path, $archivePath, fn (string $relative) => false);
            }
        }
    }

    private function addDirectory(ZipArchive $zip, string $source, string $archiveRoot, callable $skip): void
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY,
        );

        foreach ($iterator as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile() || $file->isLink()) {
                continue;
            }

            $pathname = $file->getPathname();
            $relative = ltrim(str_replace('\\', '/', substr($pathname, strlen($source))), '/');
            if ($relative === '' || $skip($relative)) {
                continue;
            }

            $archivePath = trim($archiveRoot, '/').'/'.$relative;
            if (! $zip->addFile($pathname, $archivePath)) {
                throw new RuntimeException("Unable to add [{$archivePath}] to the system backup.");
            }
        }
    }

    private function skipApplicationPath(string $relative): bool
    {
        $normalized = str_replace('\\', '/', $relative);

        return str_starts_with($normalized, 'cache/')
            || str_starts_with($normalized, 'storage/')
            || str_contains($normalized, '/.DS_Store')
            || basename($normalized) === '.DS_Store';
    }

    private function backupInfo(): string
    {
        return implode("\n", [
            'RMS System and Database Backup',
            'Generated: '.now()->format('Y-m-d H:i:s'),
            '',
            'Included:',
            '- Laravel application source and configuration templates',
            '- Database SQL backup',
            '- storage/app/private files, including protected RMS documents',
            '- storage/app/public files',
            '',
            'Excluded intentionally:',
            '- .env and other secret environment files',
            '- vendor',
            '- node_modules',
            '- .git',
            '- runtime cache and logs',
        ])."\n";
    }
}
