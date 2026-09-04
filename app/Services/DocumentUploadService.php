<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\FileType;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DocumentUploadService
{
    public function upload(Folder $folder, array $originals, array $viewers, User $actor, array $context): array
    {
        if (! $actor->can('upload', $folder)) {
            abort(403);
        }

        $results = [];
        foreach ($originals as $index => $original) {
            $viewer = $viewers[$index] ?? null;
            try {
                $results[] = ['ok' => true, 'document' => $this->storeOne($folder, $original, $viewer, $actor, $context)];
            } catch (\Throwable $exception) {
                report($exception);
                $results[] = ['ok' => false, 'name' => $original->getClientOriginalName(), 'error' => $exception instanceof ValidationException ? collect($exception->errors())->flatten()->first() : 'This file could not be uploaded safely.'];
            }
        }

        return $results;
    }

    private function storeOne(Folder $folder, UploadedFile $original, ?UploadedFile $viewer, User $actor, array $context): Document
    {
        $originalMeta = $this->validateFile($original);
        $viewerMeta = $viewer ? $this->validateFile($viewer) : null;

        if ($viewer) {
            $originalExtension = $originalMeta['extension'] === 'jpeg' ? 'jpg' : $originalMeta['extension'];
            $viewerExtension = $viewerMeta['extension'] === 'jpeg' ? 'jpg' : $viewerMeta['extension'];
            if ($viewerExtension !== $originalExtension) {
                throw ValidationException::withMessages(['viewer_files' => 'Viewer file type must match the original file type. JPG and JPEG are treated as the same type.']);
            }
        }

        $displayName = pathinfo($originalMeta['name'], PATHINFO_FILENAME);
        if (Document::query()->where('folder_id', $folder->id)->where('title', $displayName)->exists()) {
            throw ValidationException::withMessages(['original_files' => 'A document with this name already exists in this folder.']);
        }

        $operation = (string) Str::uuid();
        $disk = Storage::disk('documents');
        $written = [];

        try {
            $originalKey = 'originals/'.$operation.'/'.Str::uuid().'.'.$originalMeta['extension'];
            $disk->putFileAs(dirname($originalKey), $original, basename($originalKey));
            $written[] = $originalKey;

            $viewerKey = null;
            if ($viewer) {
                $viewerKey = 'viewers/'.$operation.'/'.Str::uuid().'.'.$viewerMeta['extension'];
                $disk->putFileAs(dirname($viewerKey), $viewer, basename($viewerKey));
                $written[] = $viewerKey;
            }

            $document = DB::transaction(function () use ($folder, $displayName, $actor, $originalMeta, $originalKey, $viewerKey, $operation, $context): Document {
                $document = Document::query()->create([
                    'folder_id' => $folder->id,
                    'title' => $displayName,
                    'status' => $viewerKey ? 'ready' : 'processing',
                    'created_by' => $actor->id,
                ]);

                DocumentVersion::query()->create([
                    'document_id' => $document->id,
                    'version_number' => 1,
                    'original_filename' => $originalMeta['name'],
                    'storage_disk' => 'documents',
                    'storage_path' => $originalKey,
                    'watermark_path' => $viewerKey,
                    'preview_path' => $viewerKey,
                    'mime_type' => $originalMeta['mime'],
                    'extension' => $originalMeta['extension'],
                    'size_bytes' => $originalMeta['size'],
                    'sha256' => $originalMeta['sha256'],
                    'scan_status' => $viewerKey ? 'ready' : 'processing',
                    'scanned_at' => $viewerKey ? now() : null,
                    'uploaded_by' => $actor->id,
                ]);

                $this->audit($actor, 'document.uploaded', $document, ['operation_id' => $operation, 'viewer_ready' => (bool) $viewerKey], $context);

                return $document;
            });

            return $document;
        } catch (\Throwable $exception) {
            foreach ($written as $key) {
                $disk->delete($key);
            }
            throw $exception;
        }
    }

    private function validateFile(UploadedFile $file): array
    {
        $originalName = trim($file->getClientOriginalName());
        if ($originalName === '' || strlen($originalName) > 250 || preg_match('/[\\x00-\\x1F\\x7F]/u', $originalName) || str_contains($originalName, '..') || str_contains($originalName, '/') || str_contains($originalName, '\\\\')) {
            throw ValidationException::withMessages(['original_files' => 'The filename is invalid.']);
        }

        $extension = strtolower((string) $file->getClientOriginalExtension());
        if (! preg_match('/^[a-z0-9]{1,10}$/', $extension)) {
            throw ValidationException::withMessages(['original_files' => 'The file extension is invalid.']);
        }

        $baseName = pathinfo($originalName, PATHINFO_FILENAME);
        if ($baseName === '' || preg_match('/[<>:"\/\\|?*]/', $baseName) || preg_match('/[\.\s]$/', $baseName)) {
            throw ValidationException::withMessages(['original_files' => 'The filename contains characters that are not allowed by Windows.']);
        }

        $reserved = ['CON', 'PRN', 'AUX', 'NUL'];
        foreach (range(1, 9) as $number) {
            $reserved[] = 'COM'.$number;
            $reserved[] = 'LPT'.$number;
        }
        if (in_array(strtoupper($baseName), $reserved, true)) {
            throw ValidationException::withMessages(['original_files' => 'This filename is reserved by Windows and cannot be used.']);
        }

        $normalizedBaseName = preg_replace('/\\s+/', '_', trim($baseName));
        if (! is_string($normalizedBaseName) || $normalizedBaseName === '') {
            throw ValidationException::withMessages(['original_files' => 'The filename is invalid.']);
        }

        $name = $normalizedBaseName.'.'.$extension;

        $type = FileType::query()->where('extension', $extension)->where('is_active', true)->first();
        if (! $type) {
            throw ValidationException::withMessages(['original_files' => 'This file type is not allowed.']);
        }

        $mime = (string) $file->getMimeType();
        if (! in_array($mime, $type->mime_types, true)) {
            throw ValidationException::withMessages(['original_files' => 'The actual file type does not match an approved format.']);
        }

        if ($file->getSize() === false || $file->getSize() < 1 || $file->getSize() > ($type->maximum_size_kb * 1024)) {
            throw ValidationException::withMessages(['original_files' => 'The file size is not allowed.']);
        }

        $path = $file->getRealPath();
        $hash = $path ? hash_file('sha256', $path) : false;
        if (! $hash) {
            throw ValidationException::withMessages(['original_files' => 'The uploaded file could not be verified.']);
        }

        return ['name' => $name, 'extension' => $extension, 'mime' => $mime, 'size' => $file->getSize(), 'sha256' => $hash];
    }

    private function audit(User $actor, string $event, Document $document, array $values, array $context): void
    {
        $document->loadMissing('folder');
        $path = $this->folderPath($document->folder);
        $description = $event === 'document.uploaded'
            ? 'Uploaded document "'.$document->title.'"'.($path ? ' inside '.implode(' / ', $path) : '').'.'
            : 'Updated document "'.$document->title.'".';

        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => $event,
            'auditable_type' => Document::class,
            'auditable_id' => $document->id,
            'description' => $description,
            'new_values' => array_merge($values, [
                'item_name' => $document->title,
                'parent_folder_id' => $document->folder_id,
                'parent_name' => $document->folder?->name,
                'path' => array_merge($path, [$document->title]),
            ]),
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
        ]);
    }

    private function folderPath(?Folder $folder): array
    {
        $path = [];
        $visited = [];
        while ($folder && ! isset($visited[$folder->id])) {
            $visited[$folder->id] = true;
            array_unshift($path, $folder->name);
            $folder = $folder->parent_id ? Folder::query()->find($folder->parent_id) : null;
        }
        return $path;
    }
}
