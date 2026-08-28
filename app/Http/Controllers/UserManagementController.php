<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserManagementController extends Controller
{
    public function index(Request $request): Response
    {
        $manager = $request->user()->loadMissing('roles');
        abort_unless($this->isManager($manager), 403);

        $perPage = in_array((int) $request->integer('per_page'), [10, 25, 50, 100], true)
            ? (int) $request->integer('per_page')
            : 10;
        $search = trim((string) $request->string('search'));
        $sort = (string) $request->string('sort', 'name');
        $direction = strtolower((string) $request->string('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowedSorts = [
            'employee_id' => 'users.employee_id',
            'name' => 'users.name',
            'subsidiary' => 'subsidiaries.name',
            'department' => 'departments.name',
            'role' => 'roles.name',
            'status' => 'users.account_status',
            'uploader' => 'users.allowed_upload',
            'registered' => 'users.created_at',
            'last_visit' => 'users.last_login_at',
        ];
        $sortColumn = $allowedSorts[$sort] ?? 'users.name';

        $onlineCutoff = now()->subMinutes(15)->timestamp;
        $users = User::query()
            ->leftJoin('subsidiaries', 'subsidiaries.id', '=', 'users.subsidiary_id')
            ->leftJoin('departments', 'departments.id', '=', 'users.department_id')
            ->leftJoin('role_user', 'role_user.user_id', '=', 'users.id')
            ->leftJoin('roles', 'roles.id', '=', 'role_user.role_id')
            ->whereNull('users.deleted_at')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $like = '%'.$search.'%';
                    $nested->where('users.employee_id', 'like', $like)
                        ->orWhere('users.name', 'like', $like)
                        ->orWhere('subsidiaries.name', 'like', $like)
                        ->orWhere('departments.name', 'like', $like)
                        ->orWhere('roles.name', 'like', $like);
                });
            })
            ->select([
                'users.id', 'users.employee_id', 'users.name', 'users.position', 'users.subsidiary_id',
                'users.department_id', 'users.account_status', 'users.allowed_upload', 'users.created_at',
                'users.last_login_at', 'subsidiaries.name as subsidiary_name', 'departments.name as department_name',
                'roles.id as role_id', 'roles.name as role_name', 'roles.slug as role_slug',
            ])
            ->selectSub(function ($query) use ($onlineCutoff) {
                $query->from('sessions')
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('sessions.user_id', 'users.id')
                    ->where('sessions.last_activity', '>=', $onlineCutoff);
            }, 'active_sessions')
            ->orderBy($sortColumn, $direction)
            ->paginate($perPage)
            ->withQueryString();

        $users->through(function ($user) use ($manager) {
            $status = $user->account_status !== 'active'
                ? 'Blocked'
                : ((int) $user->active_sessions > 0 ? 'Online' : 'Offline');

            return [
                'id' => (int) $user->id,
                'username' => $user->employee_id,
                'name' => $user->name,
                'position' => $user->position,
                'subsidiary_id' => $user->subsidiary_id,
                'subsidiary' => $user->subsidiary_name,
                'department_id' => $user->department_id,
                'department' => $user->department_name,
                'role_id' => $user->role_id,
                'role' => $user->role_name,
                'role_slug' => $user->role_slug,
                'status' => $status,
                'account_status' => $user->account_status,
                'allowed_upload' => (bool) $user->allowed_upload,
                'registered_at' => optional($user->created_at)->toIso8601String(),
                'last_visit_at' => optional($user->last_login_at)->toIso8601String(),
                'manageable' => $this->manageable($manager, (int) $user->id, (string) $user->role_slug),
            ];
        });

        return Inertia::render('Administration/Users/Index', [
            'users' => $users,
            'filters' => [
                'search' => $search,
                'sort' => $sort,
                'direction' => $direction,
                'per_page' => $perPage,
            ],
            'roles' => $this->assignableRoles($manager),
            'subsidiaries' => Subsidiary::query()
                ->where('status', 'active')
                ->with(['departments' => fn ($query) => $query->where('status', 'active')->orderBy('name')])
                ->orderBy('name')
                ->get()
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'departments' => $item->departments->map(fn ($department) => [
                        'id' => $department->id,
                        'name' => $department->name,
                    ])->values(),
                ]),
            'summary' => [
                'matching' => $users->total(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $manager = $request->user()->loadMissing('roles');
        abort_unless($this->isManager($manager), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', 'regex:/^[A-Za-z .\'\-]+$/'],
            'username' => ['required', 'string', 'max:25', 'regex:/^[A-Za-z0-9 _.-]+$/', Rule::unique('users', 'employee_id')->whereNull('deleted_at')],
            'password' => ['required', 'string', 'min:6', 'max:50'],
            'subsidiary_id' => ['required', 'integer', 'exists:subsidiaries,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'allowed_upload' => ['sometimes', 'boolean'],
        ]);

        $this->validateDepartment($validated['department_id'], $validated['subsidiary_id']);
        $role = $this->validateAssignableRole($manager, $validated['role_id']);

        if (User::query()->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($validated['name']))])->whereNull('deleted_at')->exists()) {
            return back()->withErrors(['name' => trim($validated['name']).' is already registered.']);
        }

        DB::transaction(function () use ($validated, $role, $manager) {
            $user = User::query()->create([
                'employee_id' => trim($validated['username']),
                'name' => ucwords(mb_strtolower(trim($validated['name']))),
                'subsidiary_id' => $validated['subsidiary_id'],
                'department_id' => $validated['department_id'],
                'account_status' => 'active',
                'allowed_upload' => (bool) ($validated['allowed_upload'] ?? false),
                'password' => Hash::make($validated['password']),
                'password_must_change' => true,
            ]);

            $user->roles()->attach($role->id, ['assigned_by' => $manager->id]);
        });

        return back()->with('success', 'User account created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $manager = $request->user()->loadMissing('roles');
        $user->loadMissing('roles');
        abort_unless($this->manageable($manager, $user->id, $user->roles->first()?->slug ?? ''), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', 'regex:/^[A-Za-z .\'\-]+$/'],
            'username' => ['required', 'string', 'max:25', 'regex:/^[A-Za-z0-9 _.-]+$/', Rule::unique('users', 'employee_id')->ignore($user->id)->whereNull('deleted_at')],
            'password' => ['nullable', 'string', 'min:6', 'max:50'],
            'subsidiary_id' => ['required', 'integer', 'exists:subsidiaries,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        $this->validateDepartment($validated['department_id'], $validated['subsidiary_id']);
        $role = $this->validateAssignableRole($manager, $validated['role_id']);

        if (User::query()->whereKeyNot($user->id)->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($validated['name']))])->whereNull('deleted_at')->exists()) {
            return back()->withErrors(['name' => trim($validated['name']).' is already registered.']);
        }

        DB::transaction(function () use ($validated, $role, $manager, $user) {
            $data = [
                'employee_id' => trim($validated['username']),
                'name' => ucwords(mb_strtolower(trim($validated['name']))),
                'subsidiary_id' => $validated['subsidiary_id'],
                'department_id' => $validated['department_id'],
            ];
            if (! empty($validated['password'])) {
                $data['password'] = Hash::make($validated['password']);
                $data['password_must_change'] = true;
            }
            $user->update($data);
            $user->roles()->sync([$role->id => ['assigned_by' => $manager->id]]);
        });

        return back()->with('success', 'User information was saved successfully.');
    }

    public function forceLogout(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);
        DB::table('sessions')->where('user_id', $user->id)->delete();
        return back()->with('success', 'The selected user was logged out successfully.');
    }

    public function toggleBlock(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);
        $blocked = $user->account_status !== 'active';
        $user->update(['account_status' => $blocked ? 'active' : 'blocked']);
        if (! $blocked) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }
        return back()->with('success', $blocked ? 'User account was unblocked successfully.' : 'User account was blocked successfully.');
    }

    public function uploader(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);
        $validated = $request->validate(['allowed_upload' => ['required', 'boolean']]);
        $user->update(['allowed_upload' => (bool) $validated['allowed_upload']]);
        return back()->with('success', $validated['allowed_upload'] ? 'Uploader permission was enabled successfully.' : 'Uploader permission was disabled successfully.');
    }

    public function viewer(Request $request, User $user): RedirectResponse
    {
        $manager = $this->assertManageable($request, $user);
        $validated = $request->validate(['viewer_level' => ['required', 'integer', Rule::in([1, 2])]]);
        $slug = ((int) $validated['viewer_level']) === 1 ? Role::LEVEL_1 : Role::LEVEL_2;
        $role = Role::query()->where('slug', $slug)->firstOrFail();
        $user->roles()->sync([$role->id => ['assigned_by' => $manager->id]]);
        return back()->with('success', ((int) $validated['viewer_level']) === 1 ? 'Viewer Level 1 assigned successfully.' : 'Viewer Level 2 assigned successfully.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);
        DB::transaction(function () use ($user) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete();
        });
        return back()->with('success', 'User deleted successfully.');
    }

    public function accessData(Request $request, User $user): JsonResponse
    {
        $this->assertManageable($request, $user);
        $selected = DocumentAccess::query()
            ->where('user_id', $user->id)
            ->whereNotNull('folder_id')
            ->where('can_view', true)
            ->pluck('folder_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $selectedDocuments = DocumentAccess::query()
            ->where('user_id', $user->id)
            ->whereNotNull('document_id')
            ->where('can_view', true)
            ->pluck('document_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $folders = Folder::query()->orderBy('depth')->orderBy('name')->get(['id', 'parent_id', 'name', 'depth', 'legacy_path']);
        $documents = Document::query()->with('folder:id,name,legacy_path')->orderBy('title')->get(['id','folder_id','title']);
        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name],
            'selected' => $selected,
            'selected_documents' => $selectedDocuments,
            'folders' => $folders->map(fn ($folder) => [
                'id' => $folder->id,
                'parent_id' => $folder->parent_id,
                'name' => $folder->name,
                'depth' => $folder->depth,
                'path' => $folder->legacy_path ?: $folder->name,
            ])->values(),
            'documents' => $documents->map(fn ($document) => [
                'id' => $document->id,
                'folder_id' => $document->folder_id,
                'name' => $document->title,
                'folder' => $document->folder?->legacy_path ?: $document->folder?->name,
            ])->values(),
        ]);
    }

    public function updateAccess(Request $request, User $user): RedirectResponse
    {
        $manager = $this->assertManageable($request, $user);
        $validated = $request->validate([
            'folder_ids' => ['array'],
            'folder_ids.*' => ['integer', 'distinct', 'exists:folders,id'],
            'document_ids' => ['array'],
            'document_ids.*' => ['integer', 'distinct', 'exists:documents,id'],
        ]);
        $folderIds = $validated['folder_ids'] ?? [];
        $documentIds = $validated['document_ids'] ?? [];
        $user->loadMissing('roles');
        $canDownload = $user->roleLevel() >= 2;

        DB::transaction(function () use ($user, $folderIds, $documentIds, $manager, $canDownload) {
            DocumentAccess::query()->where('user_id', $user->id)->where(function ($query) {
                $query->whereNotNull('folder_id')->orWhereNotNull('document_id');
            })->delete();
            foreach ($folderIds as $folderId) {
                DocumentAccess::query()->create([
                    'folder_id' => $folderId,
                    'user_id' => $user->id,
                    'can_view' => true,
                    'can_download' => $canDownload,
                    'can_upload' => false,
                    'granted_by' => $manager->id,
                ]);
            }
            foreach ($documentIds as $documentId) {
                DocumentAccess::query()->create([
                    'document_id' => $documentId,
                    'user_id' => $user->id,
                    'can_view' => true,
                    'can_download' => $canDownload,
                    'can_upload' => false,
                    'granted_by' => $manager->id,
                ]);
            }
        });

        return back()->with('success', 'File access was updated successfully.');
    }

    public function export(Request $request, User $user): StreamedResponse
    {
        $this->assertManageable($request, $user);
        $rows = DocumentAccess::query()
            ->where('document_access.user_id', $user->id)
            ->whereNotNull('document_access.folder_id')
            ->join('folders', 'folders.id', '=', 'document_access.folder_id')
            ->orderBy('folders.legacy_path')
            ->get(['folders.name', 'folders.legacy_path', 'document_access.can_view', 'document_access.can_download']);
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', $user->employee_id ?: ('user-'.$user->id));

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Folder', 'Path', 'View', 'Download']);
            foreach ($rows as $row) {
                fputcsv($out, [$row->name, $row->legacy_path, $row->can_view ? 'Yes' : 'No', $row->can_download ? 'Yes' : 'No']);
            }
            fclose($out);
        }, $name.'-allowed-data.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function assertManageable(Request $request, User $user): User
    {
        $manager = $request->user()->loadMissing('roles');
        $user->loadMissing('roles');
        abort_unless($this->manageable($manager, $user->id, $user->roles->first()?->slug ?? ''), 403);
        return $manager;
    }

    private function isManager(User $user): bool
    {
        return $user->hasPermission('users.manage') && $user->roleLevel() >= 3;
    }

    private function manageable(User $manager, int $targetId, string $targetRoleSlug): bool
    {
        if (! $this->isManager($manager) || $manager->id === $targetId || $targetRoleSlug === Role::LEVEL_4) {
            return false;
        }
        if ($manager->roleLevel() === 4) {
            return true;
        }
        return $targetRoleSlug !== Role::LEVEL_3;
    }

    private function assignableRoles(User $manager)
    {
        return Role::query()->get()->filter(function (Role $role) use ($manager) {
            if ($role->slug === Role::LEVEL_4) return false;
            if ($manager->roleLevel() !== 4 && $role->slug === Role::LEVEL_3) return false;
            return true;
        })->sortByDesc(fn (Role $role) => $role->level())->values()->map(fn (Role $role) => [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'level' => $role->level(),
        ]);
    }

    private function validateAssignableRole(User $manager, int $roleId): Role
    {
        $role = Role::query()->findOrFail($roleId);
        $allowed = $this->assignableRoles($manager)->contains(fn ($item) => (int) $item['id'] === $role->id);
        abort_unless($allowed, 422, 'Select a valid user level.');
        return $role;
    }

    private function validateDepartment(int $departmentId, int $subsidiaryId): void
    {
        $valid = Department::query()->whereKey($departmentId)->where('subsidiary_id', $subsidiaryId)->exists();
        abort_unless($valid, 422, 'Select a valid department for the chosen subsidiary.');
    }
}
