<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\DocumentAccess;
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

    public function delete(User $user, Document $document): bool
    {
        return $user->isSuperUser() && $user->hasPermission('documents.delete');
    }

    private function hasAssignedAccess(User $user, Document $document, string $ability): bool
    {
        return DocumentAccess::query()
            ->where('user_id', $user->id)
            ->where($ability, true)
            ->where(function ($query) use ($document): void {
                $query->where('document_id', $document->id)
                    ->orWhere('folder_id', $document->folder_id);
            })
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->exists();
    }
}
