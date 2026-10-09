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
        if ($folder->children()->exists()) {
            return false;
        }

        return $user->isSuperUser() || ($user->roleLevel() === 3 && $folder->created_by === $user->id);
    }

    public function createChild(Folder $parent, string $name, User $actor, array $context): Folder
    {
        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');

        if (! $actor->can('create', $parent)) {
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
                'division_id' => $parent->division_id,
                'subdivision_id' => $parent->subdivision_id,
                'department_id' => $parent->department_id,
                'location_id' => $parent->location_id,
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

    public function createRoot(string $name, int $subsidiaryId, int $divisionId, int $subdivisionId, int $departmentId, int $locationId, User $actor, array $context): Folder
    {
        if (! $actor->isSuperUser()) {
            abort(403);
        }

        $name = trim(preg_replace('/\\s+/', ' ', $name) ?? '');
        $slug = Str::slug($name);

        if ($slug === '' || preg_match('/[\\x00-\\x1F\\x7F\\\\\\/]/u', $name)) {
            throw ValidationException::withMessages(['name' => 'The filename contains invalid path characters.']);
        }

        return DB::transaction(function () use ($name, $slug, $subsidiaryId, $divisionId, $subdivisionId, $departmentId, $locationId, $actor, $context): Folder {
            if (Folder::query()->whereNull('parent_id')->where('slug', $slug)->lockForUpdate()->exists()) {
                throw ValidationException::withMessages(['name' => 'A filename with this name already exists.']);
            }

            $folder = Folder::query()->create([
                'parent_id' => null,
                'subsidiary_id' => $subsidiaryId,
                'division_id' => $divisionId,
                'subdivision_id' => $subdivisionId,
                'department_id' => $departmentId,
                'location_id' => $locationId,
                'name' => $name,
                'slug' => $slug,
                'depth' => 0,
                'is_published' => false,
                'created_by' => $actor->id,
                'unpublished_by' => $actor->id,
                'unpublished_at' => now(),
            ]);

            $this->audit($actor, 'folder.root_created', $folder, null, $folder->only(['name', 'slug', 'depth']), $context);

            return $folder;
        });
    }

    public function rename(Folder $folder, string $name, User $actor, array $context): void
    {
        if (! $actor->can('update', $folder)) {
            abort(403);
        }

        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
        $slug = Str::slug($name);

        if ($slug === '' || preg_match('/[\\x00-\\x1F\\x7F\\\\\/]/u', $name)) {
            throw ValidationException::withMessages(['name' => 'The folder name contains invalid path characters.']);
        }

        DB::transaction(function () use ($folder, $name, $slug, $actor, $context): void {
            $duplicate = Folder::query()->where('parent_id', $folder->parent_id)->where('slug', $slug)->whereKeyNot($folder->id)->lockForUpdate()->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['name' => 'A folder with this name already exists in the selected path.']);
            }

            $previous = $folder->only(['name', 'slug']);
            $folder->update(['name' => $name, 'slug' => $slug]);
            $this->audit($actor, 'folder.renamed', $folder, $previous, $folder->fresh()->only(['name', 'slug']), $context);
        });
    }

    public function delete(Folder $folder, User $actor, array $context): void
    {
        if (! $actor->can('delete', $folder)) {
            abort(403);
        }

        DB::transaction(function () use ($folder, $actor, $context): void {
            if ($folder->children()->exists() || $folder->documents()->exists()) {
                throw ValidationException::withMessages(['folder' => 'This folder cannot be deleted while it contains folders or documents.']);
            }

            $previous = $folder->only(['parent_id', 'name', 'slug', 'depth']);
            $folder->delete();
            $this->audit($actor, 'folder.deleted', $folder, $previous, null, $context);
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
        $path = $this->logicalPath($folder);
        $parentName = count($path) > 1 ? $path[count($path) - 2] : null;
        $description = match ($event) {
            'folder.root_created' => 'Created filename "'.$folder->name.'".',
            'folder.created' => 'Created subfolder "'.$folder->name.'"'.($parentName ? ' inside '.implode(' / ', array_slice($path, 0, -1)) : '').'.',
            'folder.renamed' => 'Renamed folder "'.($old['name'] ?? $folder->name).'" to "'.$folder->name.'".',
            'folder.deleted' => 'Deleted folder "'.$folder->name.'".',
            'folder.published' => 'Published folder "'.$folder->name.'".',
            'folder.unpublished' => 'Unpublished folder "'.$folder->name.'".',
            default => 'Updated folder "'.$folder->name.'".',
        };

        $oldValues = $old ? array_merge($old, ['item_name' => $old['name'] ?? $folder->name]) : null;
        $newValues = array_merge($new ?? [], [
            'item_name' => $folder->name,
            'parent_folder_id' => $folder->parent_id,
            'parent_name' => $parentName,
            'path' => $path,
            'depth' => $folder->depth,
        ]);

        ActivityLog::query()->create([
            'user_id' => $actor->id,
            'event' => $event,
            'auditable_type' => Folder::class,
            'auditable_id' => $folder->id,
            'description' => $description,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
        ]);
    }

    private function logicalPath(Folder $folder): array
    {
        return array_map(fn (Folder $item) => $item->name, $this->breadcrumbs($folder));
    }
}
