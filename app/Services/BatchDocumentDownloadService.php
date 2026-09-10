<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;
use ZipArchive;

class BatchDocumentDownloadService
{
    /**
     * @param  Collection<int, Document>  $documents
     */
    public function create(Collection $documents): string
    {
        if ($documents->isEmpty()) {
            throw ValidationException::withMessages([
                'document_ids' => 'Select at least one document to download.',
            ]);
        }

        $path = tempnam(sys_get_temp_dir(), 'rms-documents-');

        if ($path === false) {
            throw new RuntimeException('Unable to create a temporary ZIP file.');
        }

        try {
            $zip = new ZipArchive();
            $result = $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);

            if ($result !== true) {
                throw new RuntimeException('Unable to create the document ZIP archive.');
            }

            try {
                $usedNames = [];

                foreach ($documents as $document) {
                    $version = $document->latestVersion;

                    if (! $version || $version->scan_status !== 'ready' || ! $version->watermark_path) {
                        throw ValidationException::withMessages([
                            'document_ids' => 'One or more selected documents are not ready for download.',
                        ]);
                    }

                    $disk = Storage::disk($version->storage_disk);

                    if (! $disk->exists($version->watermark_path)) {
                        throw ValidationException::withMessages([
                            'document_ids' => 'One or more selected document files could not be found.',
                        ]);
                    }

                    $sourcePath = $disk->path($version->watermark_path);

                    if (! is_file($sourcePath) || ! is_readable($sourcePath)) {
                        throw ValidationException::withMessages([
                            'document_ids' => 'One or more selected document files could not be read.',
                        ]);
                    }

                    $archiveName = $this->uniqueArchiveName(
                        $document->title,
                        (string) $version->extension,
                        $usedNames,
                    );

                    if (! $zip->addFile($sourcePath, $archiveName)) {
                        throw new RuntimeException('Unable to add a selected document to the ZIP archive.');
                    }
                }
            } finally {
                if (! $zip->close()) {
                    throw new RuntimeException('Unable to finalize the document ZIP archive.');
                }
            }

            if (! is_file($path) || filesize($path) === 0) {
                throw new RuntimeException('The generated document ZIP archive is empty or invalid.');
            }

            $verification = new ZipArchive();
            $verificationResult = $verification->open($path, ZipArchive::CHECKCONS);

            if ($verificationResult !== true) {
                throw new RuntimeException('The generated document ZIP archive failed its integrity check.');
            }

            $verification->close();

            return $path;
        } catch (Throwable $exception) {
            @unlink($path);
            throw $exception;
        }
    }

    /**
     * @param  array<string, bool>  $usedNames
     */
    private function uniqueArchiveName(string $title, string $extension, array &$usedNames): string
    {
        $base = preg_replace('/[^A-Za-z0-9._ -]/', '_', trim($title)) ?: 'document';
        $base = trim($base, ". ");
        $extension = strtolower(preg_replace('/[^A-Za-z0-9]/', '', $extension) ?: 'file');
        $candidate = $base.'.'.$extension;
        $counter = 2;

        while (isset($usedNames[strtolower($candidate)])) {
            $candidate = $base.' ('.$counter.').'.$extension;
            $counter++;
        }

        $usedNames[strtolower($candidate)] = true;

        return $candidate;
    }
}
