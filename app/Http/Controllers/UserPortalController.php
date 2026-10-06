<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use App\Services\DocumentAccessService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserPortalController extends Controller
{
    public function dashboard(Request $request, DocumentAccessService $access): Response
    {
        $user = $request->user()->loadMissing(['roles', 'subsidiary:id,name', 'department:id,name']);
        $this->authorizePortalUser($user->roleLevel());

        $visibleIds = $access->authorizedDocumentIds($user, 'can_view');
        $downloadableIds = $user->roleLevel() === 2
            ? $access->authorizedDocumentIds($user, 'can_download')
            : [];

        return Inertia::render('Portal/Dashboard', [
            'summary' => [
                'visible_documents' => count($visibleIds),
                'downloadable_documents' => count($downloadableIds),
            ],
            'profile' => [
                'name' => $user->name,
                'employee_id' => $user->employee_id,
                'position' => $user->position,
                'subsidiary' => $user->subsidiary?->name,
                'department' => $user->department?->name,
                'role' => $user->roles->sortByDesc(fn ($role) => $role->level())->first()?->name,
            ],
        ]);
    }

    public function documents(Request $request, DocumentAccessService $access, ?Folder $folder = null): Response
    {
        /** @var User $user */
        $user = $request->user()->loadMissing('roles');
        $this->authorizePortalUser($user->roleLevel());

        if ($folder) {
            $this->authorize('view', $folder);
        }

        $search = trim((string) $request->input('search', ''));
        $visibleFolderIds = $access->visibleFolderIds($user);
        $visibleDocumentIds = $access->authorizedDocumentIds($user, 'can_view');
        $downloadableDocumentIds = $user->roleLevel() === 2
            ? $access->authorizedDocumentIds($user, 'can_download')
            : [];

        $folders = Folder::query()
            ->whereIn('id', $visibleFolderIds)
            ->when($search !== '', fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
            ->when($search === '', fn ($query) => $query->where('parent_id', $folder?->id))
            ->withCount([
                'children as visible_children_count' => fn ($query) => $query->whereIn('id', $visibleFolderIds),
                'documents as visible_documents_count' => fn ($query) => $query->whereIn('id', $visibleDocumentIds),
            ])
            ->withExists(['pins as is_pinned' => fn ($query) => $query->where('user_id', $user->id)])
            ->orderBy('name')
            ->get()
            ->map(fn (Folder $item) => [
                'id' => $item->id,
                'route_key' => $item->getRouteKey(),
                'name' => $item->name,
                'type' => 'Folder',
                'modified_at' => $item->updated_at?->toIso8601String(),
                'children_count' => (int) $item->visible_children_count,
                'documents_count' => (int) $item->visible_documents_count,
                'is_pinned' => (bool) $item->is_pinned,
                'pin_url' => route('documents.folders.pin', $item),
                'open_url' => route('portal.documents', ['folder' => $item, 'search' => $search ?: null]),
                'information_url' => route('documents.folders.information', $item),
            ]);

        $documents = Document::query()
            ->whereIn('id', $visibleDocumentIds)
            ->when($folder && $search === '', fn ($query) => $query->where('folder_id', $folder->id))
            ->when($search !== '', fn ($query) => $query->where('title', 'like', '%'.$search.'%'))
            ->when($folder === null && $search === '', fn ($query) => $query->limit(200))
                ->with([
                    'latestVersion' => fn ($query) => $query->select([
                        'document_versions.id',
                        'document_versions.document_id',
                        'document_versions.original_filename',
                        'document_versions.mime_type',
                        'document_versions.extension',
                        'document_versions.size_bytes',
                        'document_versions.scan_status',
                        'document_versions.storage_path',
                        'document_versions.watermark_path',
                    ]),
                    'creator:id,name',
                ])
                ->withExists(['pins as is_pinned' => fn ($query) => $query->where('user_id', $user->id)])
                ->orderBy('title')
                ->get()
                ->map(fn (Document $item) => [
                    'id' => $item->id,
                    'route_key' => $item->getRouteKey(),
                    'name' => $item->title,
                    'type' => strtoupper($item->latestVersion?->extension ?? 'FILE'),
                    'modified_at' => $item->updated_at?->toIso8601String(),
                    'owner' => $item->creator?->name ?? '—',
                    'size' => $item->latestVersion?->size_bytes,
                    'status' => $item->latestVersion?->scan_status ?? $item->status,
                    'is_pinned' => (bool) $item->is_pinned,
                    'pin_url' => route('documents.pin', $item),
                    'viewer_url' => filled($item->latestVersion?->storage_path) ? route('documents.viewer', $item) : null,
                    'download_url' => in_array((int) $item->id, $downloadableDocumentIds, true)
                        ? route('documents.download', $item)
                        : null,
                    'information_url' => route('documents.information', $item),
                ]);

        return Inertia::render('Portal/Documents', [
            'summary' => [
                'visible_documents' => count($visibleDocumentIds),
                'can_download' => $user->roleLevel() === 2 && $user->hasPermission('documents.download'),
            ],
            'currentFolder' => $search !== '' ? null : ($folder ? [
                'id' => $folder->id,
                'route_key' => $folder->getRouteKey(),
                'name' => $folder->name,
            ] : null),
            'breadcrumbs' => $search !== '' ? [] : ($folder ? $this->breadcrumbs($folder) : []),
            'folders' => $folders,
            'documents' => $documents,
            'filters' => ['search' => $search],
        ]);
    }

    /** @return array<int, array{id:int, route_key:string, name:string}> */
    private function breadcrumbs(Folder $folder): array
    {
        $items = [];
        $visited = [];
        $current = $folder;

        while ($current && ! isset($visited[$current->id])) {
            $visited[$current->id] = true;
            array_unshift($items, [
                'id' => $current->id,
                'route_key' => $current->getRouteKey(),
                'name' => $current->name,
            ]);
            $current = $current->parent_id ? Folder::query()->find($current->parent_id) : null;
        }

        return $items;
    }

    private function authorizePortalUser(int $level): void
    {
        abort_unless(in_array($level, [1, 2], true), 403);
    }
}
