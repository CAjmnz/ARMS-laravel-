<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Support\Collection;

class DocumentAccessService
{
    /**
     * Return every folder that a lower-level user must be able to navigate.
     *
     * A tagged folder grants its complete descendant branch. A specifically
     * tagged document grants only that document, but its ancestor folders are
     * included so the user can navigate to it. This mirrors the legacy RMS
     * path-based tagging behavior without changing the database schema.
     *
     * @return array<int>
     */
    public function visibleFolderIds(User $user): array
    {
        if ($user->roleLevel() >= 3) {
            return Folder::query()->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if (! $user->hasPermission('documents.view')) {
            return [];
        }

        $folders = Folder::query()->get(['id', 'parent_id', 'is_published']);
        $byId = $folders->keyBy('id');
        $children = $folders->groupBy(fn (Folder $folder) => $folder->parent_id ?? 0);
        $visible = [];

        foreach ($this->activeFolderGrantIds($user, 'can_view') as $folderId) {
            $grantedBranch = [];
            $this->addDescendants($folderId, $children, $grantedBranch);

            foreach (array_keys($grantedBranch) as $branchFolderId) {
                $branchFolder = $byId->get((int) $branchFolderId);
                if (! $branchFolder || ! $branchFolder->is_published) {
                    continue;
                }

                // CI3 allows unpublished ancestors only as navigation containers
                // leading to an authorized Published target.
                $this->addAncestors((int) $branchFolderId, $byId, $visible);
                $visible[(int) $branchFolderId] = true;
            }
        }

        $directDocumentFolderIds = Document::query()
            ->whereIn('id', $this->activeDocumentGrantIds($user, 'can_view'))
            ->whereHas('folder', fn ($query) => $query->where('is_published', true))
            ->pluck('folder_id');

        foreach ($directDocumentFolderIds as $folderId) {
            $this->addAncestors((int) $folderId, $byId, $visible);
        }

        return array_map('intval', array_keys($visible));
    }

    /**
     * Return document IDs granted directly or through any tagged ancestor folder.
     *
     * @return array<int>
     */
    public function authorizedDocumentIds(User $user, string $ability = 'can_view'): array
    {
        if ($user->roleLevel() >= 3) {
            return Document::query()->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if (! $user->hasPermission($ability === 'can_download' ? 'documents.download' : 'documents.view')) {
            return [];
        }

        $directDocumentIds = Document::query()
            ->whereIn('id', $this->activeDocumentGrantIds($user, $ability))
            ->whereHas('folder', fn ($query) => $query->where('is_published', true))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $folderGrantIds = $this->activeFolderGrantIds($user, $ability);

        if ($folderGrantIds === []) {
            return $directDocumentIds;
        }

        $folders = Folder::query()->get(['id', 'parent_id']);
        $children = $folders->groupBy(fn (Folder $folder) => $folder->parent_id ?? 0);
        $grantedFolderIds = [];

        foreach ($folderGrantIds as $folderId) {
            $this->addDescendants($folderId, $children, $grantedFolderIds);
        }

        $publishedFolderIds = Folder::query()
            ->whereIn('id', array_keys($grantedFolderIds))
            ->where('is_published', true)
            ->pluck('id');

        $inheritedDocumentIds = Document::query()
            ->whereIn('folder_id', $publishedFolderIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_unique(array_merge($directDocumentIds, $inheritedDocumentIds)));
    }

    public function canViewFolder(User $user, Folder $folder): bool
    {
        if ($user->roleLevel() >= 3) {
            return true;
        }

        return in_array((int) $folder->id, $this->visibleFolderIds($user), true);
    }

    public function hasDocumentAccess(User $user, Document $document, string $ability): bool
    {
        if ($user->roleLevel() >= 3) {
            return true;
        }

        return in_array((int) $document->id, $this->authorizedDocumentIds($user, $ability), true);
    }

    /** @return array<int> */
    private function activeFolderGrantIds(User $user, string $ability): array
    {
        return DocumentAccess::query()
            ->where('user_id', $user->id)
            ->where($ability, true)
            ->whereNotNull('folder_id')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->pluck('folder_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** @return array<int> */
    private function activeDocumentGrantIds(User $user, string $ability): array
    {
        return DocumentAccess::query()
            ->where('user_id', $user->id)
            ->where($ability, true)
            ->whereNotNull('document_id')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->pluck('document_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * @param Collection<int, Folder> $byId
     * @param array<int, bool> $visible
     */
    private function addAncestors(int $folderId, Collection $byId, array &$visible): void
    {
        $visited = [];
        $currentId = $folderId;

        while ($currentId > 0 && ! isset($visited[$currentId])) {
            $visited[$currentId] = true;
            $visible[$currentId] = true;
            /** @var Folder|null $folder */
            $folder = $byId->get($currentId);
            $currentId = $folder?->parent_id ? (int) $folder->parent_id : 0;
        }
    }

    /**
     * @param Collection<int, Collection<int, Folder>> $children
     * @param array<int, bool> $visible
     */
    private function addDescendants(int $folderId, Collection $children, array &$visible): void
    {
        $stack = [$folderId];
        $visited = [];

        while ($stack !== []) {
            $currentId = (int) array_pop($stack);
            if (isset($visited[$currentId])) {
                continue;
            }

            $visited[$currentId] = true;
            $visible[$currentId] = true;
            foreach ($children->get($currentId, collect()) as $child) {
                $stack[] = (int) $child->id;
            }
        }
    }
}
