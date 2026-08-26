<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FolderHierarchyService
{
    public function breadcrumbs(Folder $folder): array
    {
        $items = [];
        $visited = [];

        while ($folder) {
            if (isset($visited[$folder->id])) {
                break;
            }

            $visited[$folder->id] = true;
            array_unshift($items, $folder);
            $folder = $folder->parent;
        }

        return $items;
    }

    public function canSelectPath(User $user, Folder $folder): bool
    {
        if ($folder->is_published || $folder->children()->exists()) {
            return false;
        }

        return $user->isSuperUser()
            || ($user->roleLevel() === 3 && $folder->unpublished_by === $user->id);
    }

    public function createChild(Folder $parent, string $name, User $actor, array $context): Folder
    {
        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');

        if ($parent->is_published || ! $actor->can('create', $parent)) {
            abort(403);
        }

        if ($parent->depth >= 50) {
            throw ValidationException::withMessages(['name' => 'The maximum folder depth has been reached.']);
        }

        $slug = Str::slug($name);

        if ($slug === '' || preg_match('/[\\x00-\\x1F\\x7F\\\\\/]/u', $name)) {
            throw ValidationException::withMessages(['name' => 'The folder name contains invalid path characters.']);
        }

        return DB::transaction(function () use ($parent, $name, $slug, $actor, $context): Folder {
            if ($parent->children()->where('slug', $slug)->lockForUpdate()->exists()) {
                throw ValidationException::withMessages(['name' => 'A folder with this name already exists in the selected path.']);
            }

            $folder = Folder::query()->create([
                'parent_id' => $parent->id,
                'subsidiary_id' => $parent->subsidiary_id,
                'department_id' => $parent->department_id,
                'name' => $name,
                'slug' => $slug,
                'depth' => $parent->depth + 1,
                'is_published' => false,
                'created_by' => $actor->id,
                'unpublished_by' => $actor->id,
                'unpublished_at' => now(),
            ]);

            $this->audit($actor, 'folder.created', $folder, null, $folder->only(['parent_id', 'name', 'slug', 'depth']), $context);

            return $folder;
        });
    }

    public function publish(Folder $folder, User $actor, array $context): void
    {
        if (! $actor->can('publish', $folder)) {
            abort(403);
        }

        DB::transaction(function () use ($folder, $actor, $context): void {
            $previous = $folder->only(['is_published', 'unpublished_by', 'unpublished_at']);
            $folder->update([
                'is_published' => true,
                'published_by' => $actor->id,
                'published_at' => now(),
                'unpublished_by' => null,
                'unpublished_at' => null,
            ]);
            $this->audit($actor, 'folder.published', $folder, $previous, $folder->fresh()->only(['is_published', 'published_by', 'published_at']), $context);
        });
    }

    public function unpublish(Folder $folder, User $actor, array $context): void
    {
        if (! $actor->can('unpublish', $folder)) {
            abort(403);
        }

        DB::transaction(function () use ($folder, $actor, $context): void {
            $previous = $folder->only(['is_published', 'published_by', 'published_at']);
            $folder->update([
                'is_published' => false,
                'unpublished_by' => $actor->id,
                'unpublished_at' => now(),
            ]);
            $this->audit($actor, 'folder.unpublished', $folder, $previous, $folder->fresh()->only(['is_published', 'unpublished_by', 'unpublished_at']), $context);
        });
    }

    private function audit(User $actor, string $event, Folder $folder, ?array $old, ?array $new, array $context): void
    {
        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => $event,
            'auditable_type' => Folder::class,
            'auditable_id' => $folder->id,
            'description' => 'Folder hierarchy action for '.$folder->name.'.',
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
        ]);
    }
}
