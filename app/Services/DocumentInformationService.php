<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class DocumentInformationService
{
    public function folder(Folder $folder, User $viewer): array
    {
        $folder->loadMissing([
            'creator:id,name,email,position',
            'subsidiary:id,name',
            'division:id,name',
            'subdivision:id,name',
            'department:id,name',
            'location:id,name',
            'location.groups:id,name',
        ]);
        $folder->loadCount(['children', 'documents']);

        return [
            'kind' => 'folder',
            'name' => $folder->name,
            'type' => $folder->depth === 0 ? 'Filename' : 'Subfolder'.$folder->depth,
            'size' => null,
            'description' => null,
            'path' => $this->folderPath($folder),
            'organization' => $this->organizationPayload($folder),
            'created_at' => $folder->created_at?->toIso8601String(),
            'created_by' => $this->person($folder->creator),
            'updated_at' => $folder->updated_at?->toIso8601String(),
            'modified_by' => $this->lastActor(Folder::class, $folder->id) ?? $this->person($folder->creator),
            'status' => $folder->is_published ? 'Published' : 'Unpublished',
            'children_count' => (int) $folder->children_count,
            'documents_count' => (int) $folder->documents_count,
            'preview_url' => null,
            'activity' => $this->folderActivity($folder),
            'access' => $this->accessForFolder($folder),
            'can_manage_access' => $viewer->hasPermission('users.manage'),
            'access_user_search_url' => $viewer->hasPermission('users.manage') ? route('documents.access.users') : null,
            'access_grant_url' => $viewer->hasPermission('users.manage') ? route('documents.folders.access.grant', $folder) : null,
            'access_remove_base_url' => $viewer->hasPermission('users.manage') ? route('documents.folders.access.remove', [$folder, '__USER__']) : null,
        ];
    }

    public function document(Document $document, User $viewer): array
    {
        $document->loadMissing([
            'creator:id,name,email,position',
            'folder.subsidiary:id,name',
            'folder.division:id,name',
            'folder.subdivision:id,name',
            'folder.department:id,name',
            'folder.location:id,name',
            'folder.location.groups:id,name',
            'latestVersion.uploader:id,name,email,position',
        ]);
        $version = $document->latestVersion;

        return [
            'kind' => 'document',
            'name' => $document->title,
            'type' => strtoupper($version?->extension ?? 'Document'),
            'mime_type' => $version?->mime_type,
            'size' => $version?->size_bytes,
            'description' => $document->description,
            'path' => array_merge($this->folderPath($document->folder), [$document->title]),
            'organization' => $this->organizationPayload($document->folder),
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
            'activity' => $this->activityQuery()->where('auditable_type', Document::class)->where('auditable_id', $document->id)->limit(100)->get()->map(fn (ActivityLog $log) => $this->activityPayload($log))->values()->all(),
            'access' => $this->accessForDocument($document),
            'can_manage_access' => $viewer->hasPermission('users.manage'),
            'access_user_search_url' => $viewer->hasPermission('users.manage') ? route('documents.access.users') : null,
            'access_grant_url' => $viewer->hasPermission('users.manage') ? route('documents.access.grant', $document) : null,
            'access_remove_base_url' => $viewer->hasPermission('users.manage') ? route('documents.access.remove', [$document, '__USER__']) : null,
        ];
    }

    /** @return array<int, array<string,mixed>> */
    private function folderActivity(Folder $folder): array
    {
        $folderIds = $this->descendantFolderIds($folder);
        $documentIds = Document::query()->whereIn('folder_id', $folderIds)->pluck('id')->map(fn ($id) => (int) $id)->all();

        return $this->activityQuery()
            ->where(function (Builder $query) use ($folderIds, $documentIds) {
                $query->where(function (Builder $folders) use ($folderIds) {
                    $folders->where('auditable_type', Folder::class)->whereIn('auditable_id', $folderIds);
                });
                if ($documentIds !== []) {
                    $query->orWhere(function (Builder $documents) use ($documentIds) {
                        $documents->where('auditable_type', Document::class)->whereIn('auditable_id', $documentIds);
                    });
                }
            })
            ->limit(100)
            ->get()
            ->map(fn (ActivityLog $log) => $this->activityPayload($log))
            ->values()->all();
    }

    private function activityQuery(): Builder
    {
        return ActivityLog::query()->with('user:id,name,email,position')->latest('created_at');
    }

    private function activityPayload(ActivityLog $log): array
    {
        $values = array_merge($log->old_values ?? [], $log->new_values ?? []);
        return [
            'id' => $log->id,
            'event' => $log->event,
            'description' => $log->description ?: str_replace(['.', '_'], ' ', $log->event),
            'created_at' => $log->created_at?->toIso8601String(),
            'actor' => $this->person($log->user),
            'item_name' => $values['item_name'] ?? $values['name'] ?? null,
            'parent_name' => $values['parent_name'] ?? null,
            'path' => is_array($values['path'] ?? null) ? $values['path'] : null,
            'target_user_name' => $values['target_user_name'] ?? null,
            'old_name' => $log->old_values['name'] ?? $log->old_values['item_name'] ?? null,
            'new_name' => $log->new_values['name'] ?? $log->new_values['item_name'] ?? null,
        ];
    }

    /** @return array<int> */
    private function descendantFolderIds(Folder $folder): array
    {
        $folders = Folder::query()->get(['id', 'parent_id']);
        $children = $folders->groupBy(fn (Folder $item) => $item->parent_id ?? 0);
        $ids = [];
        $stack = [(int) $folder->id];
        while ($stack !== []) {
            $id = (int) array_pop($stack);
            if (isset($ids[$id])) continue;
            $ids[$id] = true;
            foreach ($children->get($id, collect()) as $child) $stack[] = (int) $child->id;
        }
        return array_map('intval', array_keys($ids));
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

    private function ancestorFolderIds(?Folder $folder): array
    {
        $ids = [];
        $current = $folder;
        while ($current && ! in_array((int) $current->id, $ids, true)) {
            $ids[] = (int) $current->id;
            $current = $current->parent_id ? Folder::query()->find($current->parent_id) : null;
        }
        return $ids;
    }

    private function accessForFolder(Folder $folder): array
    {
        $folderIds = $this->ancestorFolderIds($folder);
        $grants = DocumentAccess::query()
            ->whereIn('folder_id', $folderIds)
            ->where('can_view', true)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->get();

        return $this->accessRows($grants, fn ($grant) => (int) $grant->folder_id === (int) $folder->id ? 'Direct folder access' : 'Parent-folder access');
    }

    private function accessForDocument(Document $document): array
    {
        $direct = DocumentAccess::query()->where('document_id', $document->id)->where('can_view', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->get();
        $inherited = DocumentAccess::query()->whereIn('folder_id', $this->ancestorFolderIds($document->folder))->where('can_view', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->get();

        return collect(array_merge(
            $this->accessRows($direct, fn () => 'Direct document access'),
            $this->accessRows($inherited, fn () => 'Folder access')
        ))->unique(fn ($row) => ($row['user']['id'] ?? 'none').':'.$row['source'])->values()->all();
    }

    private function accessRows(Collection $grants, callable $source): array
    {
        $userIds = $grants->pluck('user_id')->filter()->unique()->values();
        $managerIds = $grants->pluck('granted_by')->filter()->unique()->values();
        $users = User::query()->with(['roles:id,name,slug', 'department:id,name'])->whereIn('id', $userIds)->get()->keyBy('id');
        $managers = User::query()->whereIn('id', $managerIds)->get(['id','name','email','position'])->keyBy('id');

        return $grants->filter(fn ($grant) => $grant->user_id && $users->has($grant->user_id))->map(function ($grant) use ($users, $managers, $source) {
            $user = $users->get($grant->user_id);
            return [
                'user' => $this->person($user),
                'role' => $user->roles->pluck('name')->filter()->join(', ') ?: 'User',
                'department' => $user->department?->name,
                'source' => $source($grant),
                'can_download' => (bool) $grant->can_download,
                'can_upload' => (bool) $grant->can_upload,
                'granted_by' => $this->person($managers->get($grant->granted_by)),
                'granted_at' => $grant->created_at?->toIso8601String(),
            ];
        })->values()->all();
    }

    private function lastActor(string $type, int $id): ?array
    {
        $log = ActivityLog::query()
            ->where('auditable_type', $type)
            ->where('auditable_id', $id)
            ->whereNotNull('user_id')
            ->whereNotIn('event', ['pin.created', 'pin.removed', 'access.granted', 'access.removed', 'document.viewed', 'document.viewer_downloaded', 'document.original_downloaded'])
            ->latest('created_at')
            ->with('user:id,name,email,position')
            ->first();
        return $this->person($log?->user);
    }

    private function organizationPayload(?Folder $folder): array
    {
        if (! $folder) {
            return [
                'subsidiary' => null,
                'division' => null,
                'subdivision' => null,
                'location' => null,
                'groups' => [],
                'department' => null,
            ];
        }

        return [
            'subsidiary' => $folder->subsidiary?->name,
            'division' => $folder->division?->name,
            'subdivision' => $folder->subdivision?->name,
            'location' => $folder->location?->name,
            'groups' => $folder->location?->groups->pluck('name')->values()->all() ?? [],
            'department' => $folder->department?->name,
        ];
    }

    private function person(?User $user): ?array
    {
        if (! $user) return null;
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'position' => $user->position];
    }
}
