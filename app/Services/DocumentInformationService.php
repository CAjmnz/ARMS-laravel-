<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Support\Collection;

class DocumentInformationService
{
    public function folder(Folder $folder): array
    {
        $folder->loadMissing(['creator:id,name,email,position', 'subsidiary:id,name', 'department:id,name']);
        $folder->loadCount(['children', 'documents']);

        return [
            'kind' => 'folder',
            'name' => $folder->name,
            'type' => $folder->depth === 0 ? 'Filename' : 'Subfolder'.$folder->depth,
            'size' => null,
            'description' => null,
            'path' => $this->folderPath($folder),
            'created_at' => $folder->created_at?->toIso8601String(),
            'created_by' => $this->person($folder->creator),
            'updated_at' => $folder->updated_at?->toIso8601String(),
            'modified_by' => $this->lastActor(Folder::class, $folder->id) ?? $this->person($folder->creator),
            'status' => $folder->is_published ? 'Published' : 'Unpublished',
            'children_count' => (int) $folder->children_count,
            'documents_count' => (int) $folder->documents_count,
            'preview_url' => null,
            'activity' => $this->activity(Folder::class, $folder->id),
            'access' => $this->accessForFolder($folder),
        ];
    }

    public function document(Document $document): array
    {
        $document->loadMissing(['creator:id,name,email,position', 'folder', 'latestVersion.uploader:id,name,email,position']);
        $version = $document->latestVersion;

        return [
            'kind' => 'document',
            'name' => $document->title,
            'type' => strtoupper($version?->extension ?? 'Document'),
            'mime_type' => $version?->mime_type,
            'size' => $version?->size_bytes,
            'description' => $document->description,
            'path' => array_merge($this->folderPath($document->folder), [$document->title]),
            'created_at' => $document->created_at?->toIso8601String(),
            'created_by' => $this->person($document->creator),
            'uploaded_by' => $this->person($version?->uploader),
            'updated_at' => $document->updated_at?->toIso8601String(),
            'modified_by' => $this->lastActor(Document::class, $document->id) ?? $this->person($document->creator),
            'status' => $document->status,
            'version' => $version?->version_number,
            'children_count' => null,
            'documents_count' => null,
            'preview_url' => $version?->scan_status === 'ready' ? route('documents.viewer', $document) : null,
            'activity' => $this->activity(Document::class, $document->id),
            'access' => $this->accessForDocument($document),
        ];
    }

    private function folderPath(?Folder $folder): array
    {
        if (! $folder) return [];
        $path = [];
        $visited = [];
        $current = $folder;
        while ($current && ! isset($visited[$current->id])) {
            $visited[$current->id] = true;
            array_unshift($path, $current->name);
            $current = $current->parent_id ? Folder::query()->find($current->parent_id) : null;
        }
        return $path;
    }

    private function activity(string $type, int $id): array
    {
        return ActivityLog::query()
            ->where('auditable_type', $type)
            ->where('auditable_id', $id)
            ->with('user:id,name,email,position')
            ->latest('created_at')
            ->limit(50)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'event' => $log->event,
                'description' => $log->description ?: str_replace(['.', '_'], ' ', $log->event),
                'created_at' => $log->created_at?->toIso8601String(),
                'actor' => $this->person($log->user),
            ])->values()->all();
    }

    private function accessForFolder(Folder $folder): array
    {
        return $this->accessRows(
            DocumentAccess::query()->where('folder_id', $folder->id)->where('can_view', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->get(),
            'Direct folder access'
        );
    }

    private function accessForDocument(Document $document): array
    {
        $direct = $this->accessRows(
            DocumentAccess::query()->where('document_id', $document->id)->where('can_view', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->get(),
            'Direct document access'
        );
        $folderIds = [];
        $current = $document->folder;
        while ($current) {
            $folderIds[] = $current->id;
            $current = $current->parent_id ? Folder::query()->find($current->parent_id) : null;
        }
        $inherited = $this->accessRows(
            DocumentAccess::query()->whereIn('folder_id', $folderIds)->where('can_view', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->get(),
            'Folder access'
        );
        return collect(array_merge($direct, $inherited))->unique(fn ($row) => ($row['user']['id'] ?? 'none').':'.$row['source'])->values()->all();
    }

    private function accessRows(Collection $grants, string $source): array
    {
        $userIds = $grants->pluck('user_id')->filter()->unique()->values();
        $users = User::query()->with(['roles:id,name,slug', 'department:id,name'])->whereIn('id', $userIds)->get()->keyBy('id');
        return $grants->filter(fn ($grant) => $grant->user_id && $users->has($grant->user_id))->map(function ($grant) use ($users, $source) {
            $user = $users->get($grant->user_id);
            return [
                'user' => $this->person($user),
                'role' => $user->roles->pluck('name')->filter()->join(', ') ?: 'User',
                'department' => $user->department?->name,
                'source' => $source,
                'can_download' => (bool) $grant->can_download,
                'can_upload' => (bool) $grant->can_upload,
            ];
        })->values()->all();
    }

    private function lastActor(string $type, int $id): ?array
    {
        $log = ActivityLog::query()->where('auditable_type', $type)->where('auditable_id', $id)->whereNotNull('user_id')->latest('created_at')->with('user:id,name,email,position')->first();
        return $this->person($log?->user);
    }

    private function person(?User $user): ?array
    {
        if (! $user) return null;
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'position' => $user->position];
    }
}
