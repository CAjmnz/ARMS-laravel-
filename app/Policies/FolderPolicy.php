<?php

namespace App\Policies;

use App\Models\Folder;
use App\Models\User;
use App\Services\DocumentAccessService;

class FolderPolicy
{
    public function __construct(private DocumentAccessService $access)
    {
    }

    public function view(User $user, Folder $folder): bool
    {
        if ($user->roleLevel() >= 3) {
            return true;
        }

        return $user->hasPermission('documents.view')
            && $this->access->canViewFolder($user, $folder);
    }

    public function create(User $user, Folder $parent): bool
    {
        return $this->manage($user, $parent);
    }

    public function update(User $user, Folder $folder): bool
    {
        return $this->manage($user, $folder);
    }

    public function delete(User $user, Folder $folder): bool
    {
        return $user->isSuperUser();
    }

    public function upload(User $user, Folder $folder): bool
    {
        if ($user->isSuperUser()) {
            return true;
        }

        return $user->roleLevel() === 3
            && (bool) $user->allowed_upload
            && $folder->created_by === $user->id;
    }

    public function publish(User $user, Folder $folder): bool
    {
        return $user->isSuperUser()
            || ($user->roleLevel() === 3 && $folder->unpublished_by === $user->id);
    }

    public function unpublish(User $user, Folder $folder): bool
    {
        return $user->roleLevel() >= 3 && $folder->is_published;
    }

    private function manage(User $user, Folder $folder): bool
    {
        if ($user->isSuperUser()) {
            return true;
        }

        return $user->roleLevel() === 3 && $folder->created_by === $user->id;
    }
}
