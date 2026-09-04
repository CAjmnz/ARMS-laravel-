<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentAccessManagementController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        abort_unless($request->user()->roleLevel() >= 3 && $request->user()->hasPermission('users.manage'), 403);
        $search = trim((string) $request->input('search', ''));

        $users = User::query()
            ->with(['roles:id,name,slug', 'department:id,name'])
            ->where('account_status', 'Active')
            ->when($search, function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(function ($scope) use ($like) {
                    $scope->where('name', 'like', $like)
                        ->orWhere('employee_id', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhereHas('department', fn ($department) => $department->where('name', 'like', $like));
                });
            })
            ->orderBy('name')
            ->limit(20)
            ->get();

        return response()->json(['items' => $users->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'employee_id' => $user->employee_id,
            'email' => $user->email,
            'department' => $user->department?->name,
            'role' => $user->roles->pluck('name')->filter()->join(', ') ?: 'User',
        ])->values()]);
    }

    public function grantFolder(Request $request, Folder $folder): JsonResponse
    {
        $this->authorize('view', $folder);
        return $this->grant($request, $folder, null);
    }

    public function grantDocument(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);
        return $this->grant($request, null, $document);
    }

    public function removeFolder(Request $request, Folder $folder, User $user): JsonResponse
    {
        $this->authorize('view', $folder);
        return $this->remove($request, $user, $folder, null);
    }

    public function removeDocument(Request $request, Document $document, User $user): JsonResponse
    {
        $this->authorize('view', $document);
        return $this->remove($request, $user, null, $document);
    }

    private function grant(Request $request, ?Folder $folder, ?Document $document): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->roleLevel() >= 3 && $actor->hasPermission('users.manage'), 403);
        $validated = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $target = User::query()->with('roles')->findOrFail($validated['user_id']);
        abort_if($target->id === $actor->id, 422, 'You already have access through your own account.');
        $canDownload = $target->roleLevel() >= 2;

        DB::transaction(function () use ($actor, $target, $folder, $document, $canDownload, $request) {
            $grant = DocumentAccess::query()->firstOrNew([
                'user_id' => $target->id,
                'folder_id' => $folder?->id,
                'document_id' => $document?->id,
            ]);
            $grant->fill([
                'can_view' => true,
                'can_download' => $canDownload,
                'can_upload' => false,
                'granted_by' => $actor->id,
                'expires_at' => null,
            ]);
            $grant->save();

            $name = $folder?->name ?? $document?->title ?? 'item';
            ActivityLog::query()->create([
                'user_id' => $actor->id,
                'event' => 'access.granted',
                'auditable_type' => $folder ? Folder::class : Document::class,
                'auditable_id' => $folder?->id ?? $document?->id,
                'description' => 'Granted '.$target->name.' access to '.$name.'.',
                'new_values' => [
                    'target_user_id' => $target->id,
                    'target_user_name' => $target->name,
                    'item_name' => $name,
                    'folder_id' => $folder?->id,
                    'document_id' => $document?->id,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => (string) $request->userAgent(),
            ]);
        });

        return response()->json(['message' => 'Access granted.']);
    }

    private function remove(Request $request, User $target, ?Folder $folder, ?Document $document): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->roleLevel() >= 3 && $actor->hasPermission('users.manage'), 403);
        $deleted = DocumentAccess::query()
            ->where('user_id', $target->id)
            ->when($folder, fn ($query) => $query->where('folder_id', $folder->id))
            ->when($document, fn ($query) => $query->where('document_id', $document->id))
            ->delete();
        abort_if($deleted === 0, 404);

        $name = $folder?->name ?? $document?->title ?? 'item';
        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => 'access.removed',
            'auditable_type' => $folder ? Folder::class : Document::class,
            'auditable_id' => $folder?->id ?? $document?->id,
            'description' => 'Removed '.$target->name.' access from '.$name.'.',
            'old_values' => [
                'target_user_id' => $target->id,
                'target_user_name' => $target->name,
                'item_name' => $name,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return response()->json(['message' => 'Access removed.']);
    }
}
