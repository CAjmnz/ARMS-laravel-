<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\User;

class DocumentPolicy
{
    public function view(User $user, Document $document): bool
    {
        return $user->hasPermission('documents.view')
            && ($user->roleLevel() >= 3 || $this->hasAssignedAccess($user, $document, 'can_view'));
    }

    public function download(User $user, Document $document): bool
    {
        return $user->hasPermission('documents.download')
            && ($user->roleLevel() >= 3 || $this->hasAssignedAccess($user, $document, 'can_download'));
    }

    public function downloadOriginal(User $user, Document $document): bool
    {
        return $user->isSuperUser() && $user->hasPermission('documents.download') && $this->view($user, $document);
    }

    public function update(User $user, Document $document): bool
    {
        return $user->hasPermission('documents.rename') && $this->canManageFolder($user, $document->folder);
    }

    public function move(User $user, Document $document): bool
    {
        return $user->hasPermission('documents.transfer') && $this->canManageFolder($user, $document->folder);
    }

    public function uploadVersion(User $user, Document $document): bool
    {
        return $user->hasPermission('documents.upload') && $this->canUploadToFolder($user, $document->folder);
    }

    public function delete(User $user, Document $document): bool
    {
        return $user->isSuperUser() && $user->hasPermission('documents.delete');
    }

    public function upload(User $user, Folder $folder): bool
    {
        // Level 4 may upload at any existing document path. Other roles still need
        // the persisted upload permission and their existing folder rule.
        if ($user->isSuperUser()) {
            return true;
        }

        return $user->hasPermission('documents.upload') && $this->canUploadToFolder($user, $folder);
    }

    private function canUploadToFolder(User $user, Folder $folder): bool
    {
        if ($user->isSuperUser()) {
            return true;
        }

        return $user->roleLevel() === 3 && $user->allowed_upload && $folder->created_by === $user->id;
    }

    private function canManageFolder(User $user, Folder $folder): bool
    {
        return $user->isSuperUser() || ($user->roleLevel() === 3 && $folder->created_by === $user->id);
    }

    private function hasAssignedAccess(User $user, Document $document, string $ability): bool
    {
        return DocumentAccess::query()->where('user_id', $user->id)->where($ability, true)
            ->where(fn ($query) => $query->where('document_id', $document->id)->orWhere('folder_id', $document->folder_id))
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))->exists();
    }
}
