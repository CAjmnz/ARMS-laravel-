<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\Folder;
use App\Models\Subsidiary;
use App\Models\User;
use App\Services\DocumentAccessService;
use App\Services\FolderHierarchyService;
use App\Services\PinnedItemsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FolderManagementController extends Controller
{
    public function index(
        Request $request,
        FolderHierarchyService $hierarchy,
        DocumentAccessService $access,
        PinnedItemsService $pins,
        ?Folder $folder = null,
    ): Response {
        if ($folder) {
            $this->authorize('view', $folder);
        }

        $user = $request->user();
        $visibleFolderIds = $user->roleLevel() < 3 ? $access->visibleFolderIds($user) : [];
        $visibleDocumentIds = $user->roleLevel() < 3 ? $access->authorizedDocumentIds($user, 'can_view') : [];
        $search = trim((string) $request->input('search', ''));
        $pinnedSearchMode = preg_match('/^(pin|pinned)(?:\s+(.*))?$/i', $search, $pinMatch) === 1;
        $pinnedKeyword = $pinnedSearchMode ? trim((string) ($pinMatch[2] ?? '')) : null;
        $localSearch = $pinnedSearchMode ? '' : $search;
        $filters = [
            'search' => $search,
            'sort' => in_array($request->input('sort'), ['name', 'created_at'], true)
                ? $request->input('sort')
                : 'name',
            'order' => in_array($request->input('order'), ['asc', 'desc'], true)
                ? $request->input('order')
                : 'asc',
            'per_page' => in_array((int) $request->input('per_page'), [10, 25, 50, 100], true)
                ? (int) $request->input('per_page')
                : 10,
        ];

        $folders = Folder::query()
            ->where('parent_id', $folder?->id)
            ->when($user->roleLevel() < 3, fn ($query) => $query->whereIn('id', $visibleFolderIds))
            ->when($localSearch, fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->with('creator:id,name')
            ->withCount(['children', 'documents'])
            ->withExists(['pins as is_pinned' => fn ($query) => $query->where('user_id', $user->id)])
            ->orderByDesc('is_pinned')
            ->orderBy($filters['sort'], $filters['order'])
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (Folder $item) => [
                'id' => $item->id,
                'route_key' => $item->getRouteKey(),
                'name' => $item->name,
                'children_count' => $item->children_count,
                'documents_count' => $item->documents_count,
                'can_manage' => $user->can('update', $item),
                'updated_at' => $item->updated_at?->toIso8601String(),
                'owner' => $item->creator?->name,
                'can_upload' => $user->can('upload', $item),
                'is_pinned' => (bool) $item->is_pinned,
                'pin_url' => route('documents.folders.pin', $item),
                'is_published' => (bool) $item->is_published,
                'can_publish' => $user->can('publish', $item),
                'can_unpublish' => $user->can('unpublish', $item),
                'rename_url' => $user->can('update', $item) ? route('documents.folders.rename', $item) : null,
                'delete_url' => $user->can('delete', $item) ? route('documents.folders.destroy', $item) : null,
            ]);


        $documents = $folder ? Document::query()->where('folder_id', $folder->id)
            ->when($user->roleLevel() < 3, fn ($query) => $query->whereIn('id', $visibleDocumentIds))
            ->when($localSearch, fn ($query, $search) => $query->where('title', 'like', '%'.$search.'%'))
            ->withExists(['pins as is_pinned' => fn ($query) => $query->where('user_id', $user->id)])
            ->with([
                'creator:id,name',
                'latestVersion' => fn ($query) => $query->select([
                    'document_versions.id',
                    'document_versions.document_id',
                    'document_versions.extension',
                    'document_versions.scan_status',
                ]),
            ])
            ->orderByDesc('is_pinned')
            ->latest('updated_at')->get()->map(fn (Document $item) => [
                'id' => $item->id,
                'route_key' => $item->getRouteKey(),
                'name' => $item->title,
                'type' => strtoupper($item->latestVersion?->extension ?? 'document'),
                'modified_at' => $item->updated_at?->toIso8601String(),
                'owner' => $item->creator?->name ?? '—',
                'is_pinned' => (bool) $item->is_pinned,
                'pin_url' => route('documents.pin', $item),
                'status' => $item->latestVersion?->scan_status ?? $item->status,
                'show_url' => route('documents.show', $item),
                'viewer_url' => $item->latestVersion?->scan_status === 'ready' ? route('documents.viewer', $item) : null,
                'download_url' => $user->can('download', $item) ? route('documents.download', $item) : null,
                'edit_url' => $user->can('update', $item) ? route('documents.edit', $item) : null,
                'update_url' => $user->can('update', $item) ? route('documents.update', $item) : null,
                'move_url' => $user->can('move', $item) ? route('documents.move', $item) : null,
                'delete_url' => $user->can('delete', $item) ? route('documents.destroy', $item) : null,
            ]) : collect();

        return Inertia::render('Documents/Manage', [
            'currentFolder' => $folder ? [
                'id' => $folder->id,
                'route_key' => $folder->getRouteKey(),
                'name' => $folder->name,
                'depth' => $folder->depth,
                'documents_count' => $documents->count(),
                'can_manage' => $user->can('update', $folder),
                'can_upload' => $user->can('upload', $folder),
            ] : null,
            'breadcrumbs' => $folder
                ? array_map(fn (Folder $item) => ['id' => $item->id, 'route_key' => $item->getRouteKey(), 'name' => $item->name], $hierarchy->breadcrumbs($folder))
                : [],
            'folders' => $folders,
            'documents' => $documents,
            'uploadFolders' => Folder::query()
                ->orderBy('depth')
                ->orderBy('name')
                ->get()
                ->filter(fn (Folder $item) => $user->isSuperUser() || $user->can('upload', $item))
                ->map(function (Folder $item) use ($hierarchy) {
                    $crumbs = $hierarchy->breadcrumbs($item);

                    return [
                        'id' => $item->id,
                        'route_key' => $item->getRouteKey(),
                        'name' => $item->name,
                        'path' => '/'.implode('/', array_map(fn (Folder $crumb) => $crumb->name, $crumbs)),
                        'depth' => $item->depth,
                        'group_label' => $item->depth === 0 ? 'Filename' : 'Subfolder'.$item->depth,
                    ];
                })
                ->values(),
            'filters' => $filters,
            'pinnedSearch' => $pinnedSearchMode ? $pins->paginate($user, $pinnedKeyword, 'all', $filters['per_page']) : null,
            'pinnedSearchMode' => $pinnedSearchMode,
            'pinnedSearchKeyword' => $pinnedKeyword,
            'documentStats' => [
                'documents' => Document::query()->count(),
                'folders' => Folder::query()->count(),
                'pins' => $pins->count($user),
                'users' => User::query()->count(),
                'departments' => Department::query()->count(),
            ],
            'canCreateRoot' => $user->isSuperUser(),
            'organizations' => $user->isSuperUser()
                ? Subsidiary::query()->with('departments:id,subsidiary_id,name')->orderBy('name')->get(['id', 'name'])
                : [],
        ]);
    }

    public function store(Request $request, Folder $folder, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $this->authorize('create', $folder);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:250'],
        ]);

        $hierarchy->createChild($folder, $validated['name'], $request->user(), [
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return back()->with('success', 'The folder was created successfully.');
    }

    public function rename(Request $request, Folder $folder, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $this->authorize('update', $folder);
        $validated = $request->validate(['name' => ['required', 'string', 'max:250']]);
        $validated['name'] = $this->normalizeWindowsName($validated['name'], 'name');
        $hierarchy->rename($folder, $validated['name'], $request->user(), ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()]);

        return back()->with('success', 'The folder was renamed successfully.');
    }

    public function destroy(Request $request, Folder $folder, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $this->authorize('delete', $folder);
        $hierarchy->delete($folder, $request->user(), ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()]);

        return back()->with('success', 'The folder was deleted successfully.');
    }

    public function bulkDelete(Request $request, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $validated = $request->validate([
            'folder_ids' => ['nullable', 'array', 'max:100'],
            'folder_ids.*' => ['integer', 'distinct', 'exists:folders,id'],
            'document_ids' => ['nullable', 'array', 'max:100'],
            'document_ids.*' => ['integer', 'distinct', 'exists:documents,id'],
        ]);

        $folderIds = $validated['folder_ids'] ?? [];
        $documentIds = $validated['document_ids'] ?? [];
        abort_if(empty($folderIds) && empty($documentIds), 422, 'Select at least one item.');

        $documents = Document::query()->whereIn('id', $documentIds)->get();
        foreach ($documents as $document) {
            $this->authorize('delete', $document);
        }
        foreach ($documents as $document) {
            $document->delete();
        }

        $folders = Folder::query()->whereIn('id', $folderIds)->get();
        foreach ($folders as $folder) {
            $hierarchy->delete($folder, $request->user(), [
                'ip_address' => $request->ip(),
                'user_agent' => (string) $request->userAgent(),
            ]);
        }

        return back()->with('success', ($documents->count() + $folders->count()).' selected item(s) deleted successfully.');
    }

    private function normalizeWindowsName(string $value, string $field): string
    {
        $value = trim($value);
        if ($value === '' || preg_match('/[<>:"\/\\|?*\x00-\x1F\x7F]/u', $value) || str_contains($value, '..')) {
            throw \Illuminate\Validation\ValidationException::withMessages([$field => 'The name contains characters that are not allowed by Windows.']);
        }

        $normalized = preg_replace('/\s+/', '_', $value);
        $normalized = is_string($normalized) ? rtrim($normalized, '. ') : '';
        $reserved = ['CON', 'PRN', 'AUX', 'NUL'];
        foreach (range(1, 9) as $number) {
            $reserved[] = 'COM'.$number;
            $reserved[] = 'LPT'.$number;
        }
        if ($normalized === '' || in_array(strtoupper($normalized), $reserved, true)) {
            throw \Illuminate\Validation\ValidationException::withMessages([$field => 'This name is reserved by Windows and cannot be used.']);
        }

        return $normalized;
    }

    public function storeRoot(Request $request, FolderHierarchyService $hierarchy): RedirectResponse
    {
        abort_unless($request->user()->isSuperUser(), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:250'],
            'subsidiary_id' => ['required', 'integer', 'exists:subsidiaries,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
        ]);

        $departmentMatchesSubsidiary = Department::query()
            ->whereKey($validated['department_id'])
            ->where('subsidiary_id', $validated['subsidiary_id'])
            ->exists();

        if (! $departmentMatchesSubsidiary) {
            return back()->withErrors(['department_id' => 'Select a department belonging to the selected subsidiary.']);
        }

        $hierarchy->createRoot(
            $validated['name'],
            $validated['subsidiary_id'],
            $validated['department_id'],
            $request->user(),
            ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()],
        );

        return back()->with('success', 'The filename was created successfully.');
    }

}
