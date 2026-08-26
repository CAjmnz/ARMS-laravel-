<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Folder;
use App\Models\Subsidiary;
use App\Services\FolderHierarchyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FolderManagementController extends Controller
{
    public function index(
        Request $request,
        FolderHierarchyService $hierarchy,
        ?Folder $folder = null,
    ): Response {
        if ($folder) {
            $this->authorize('view', $folder);
        }

        $user = $request->user();
        $filters = [
            'search' => trim((string) $request->input('search', '')),
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
            ->when($user->roleLevel() < 3, fn ($query) => $query->where('is_published', true))
            ->when($filters['search'], fn ($query, $search) => $query->where('name', 'like', '%'.$search.'%'))
            ->withCount(['children', 'documents'])
            ->orderBy($filters['sort'], $filters['order'])
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (Folder $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'is_published' => $item->is_published,
                'children_count' => $item->children_count,
                'documents_count' => $item->documents_count,
                'can_manage' => $user->can('update', $item),
                'can_publish' => $user->can('publish', $item),
                'can_unpublish' => $user->can('unpublish', $item),
            ]);

        return Inertia::render('Documents/Manage', [
            'currentFolder' => $folder ? [
                'id' => $folder->id,
                'name' => $folder->name,
                'is_published' => $folder->is_published,
                'can_manage' => $user->can('update', $folder),
            ] : null,
            'breadcrumbs' => $folder
                ? array_map(fn (Folder $item) => ['id' => $item->id, 'name' => $item->name], $hierarchy->breadcrumbs($folder))
                : [],
            'folders' => $folders,
            'filters' => $filters,
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

    public function publish(Request $request, Folder $folder, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $hierarchy->publish($folder, $request->user(), [
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return back()->with('success', 'The folder was published successfully.');
    }

    public function unpublish(Request $request, Folder $folder, FolderHierarchyService $hierarchy): RedirectResponse
    {
        $hierarchy->unpublish($folder, $request->user(), [
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return back()->with('success', 'The folder was unpublished and assigned to your private work path.');
    }
}
