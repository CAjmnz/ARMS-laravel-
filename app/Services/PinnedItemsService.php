<?php

namespace App\Services;

use App\Models\Folder;
use App\Models\User;
use App\Models\UserPin;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class PinnedItemsService
{
    public function __construct(
        private FolderHierarchyService $hierarchy,
        private DocumentAccessService $access,
    ) {
    }

    public function count(User $user): int
    {
        return $this->queryFor($user)->count();
    }

    /** @return Collection<int, array<string, mixed>> */
    public function top(User $user, int $limit = 5): Collection
    {
        return $this->queryFor($user)
            ->latest('user_pins.updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (UserPin $pin) => $this->payload($pin));
    }

    public function paginate(User $user, ?string $keyword = null, string $type = 'all', int $perPage = 10): LengthAwarePaginator
    {
        $query = $this->queryFor($user, trim((string) $keyword), $type)
            ->latest('user_pins.updated_at');

        return $query->paginate($perPage)->withQueryString()->through(
            fn (UserPin $pin) => $this->payload($pin)
        );
    }

    /** @return Collection<int, array<string, mixed>> */
    public function search(User $user, ?string $keyword = null, string $type = 'all', int $limit = 25): Collection
    {
        return $this->queryFor($user, trim((string) $keyword), $type)
            ->latest('user_pins.updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (UserPin $pin) => $this->payload($pin));
    }

    private function queryFor(User $user, string $keyword = '', string $type = 'all'): Builder
    {
        $query = UserPin::query()
            ->where('user_id', $user->id)
            ->with([
                'folder:id,parent_id,name,depth,legacy_path,updated_at',
                'document:id,folder_id,title,updated_at',
                'document.folder:id,parent_id,name,depth,legacy_path,updated_at',
            ]);

        if ($user->roleLevel() < 3) {
            $visibleFolderIds = $this->access->visibleFolderIds($user);
            $visibleDocumentIds = $this->access->authorizedDocumentIds($user, 'can_view');

            $query->where(function (Builder $scope) use ($visibleFolderIds, $visibleDocumentIds): void {
                $scope->where(function (Builder $folders) use ($visibleFolderIds): void {
                    $folders->whereNotNull('folder_id')->whereIn('folder_id', $visibleFolderIds ?: [-1]);
                })->orWhere(function (Builder $documents) use ($visibleDocumentIds): void {
                    $documents->whereNotNull('document_id')->whereIn('document_id', $visibleDocumentIds ?: [-1]);
                });
            });
        }

        if ($type === 'folders') {
            $query->whereNotNull('folder_id');
        } elseif ($type === 'documents') {
            $query->whereNotNull('document_id');
        }

        if ($keyword !== '') {
            $query->where(function (Builder $scope) use ($keyword): void {
                $like = '%'.$keyword.'%';
                $scope->whereHas('folder', function (Builder $folder) use ($like): void {
                    $folder->where('name', 'like', $like)
                        ->orWhere('legacy_path', 'like', $like);
                })->orWhereHas('document', function (Builder $document) use ($like): void {
                    $document->where('title', 'like', $like)
                        ->orWhereHas('folder', fn (Builder $folder) => $folder->where('name', 'like', $like)->orWhere('legacy_path', 'like', $like));
                });
            });
        }

        return $query;
    }

    /** @return array<string, mixed> */
    private function payload(UserPin $pin): array
    {
        if ($pin->folder) {
            $folder = $pin->folder;
            $path = $this->folderPath($folder);

            return [
                'pin_id' => $pin->id,
                'kind' => 'folder',
                'type' => $folder->depth === 0 ? 'Filename' : 'Subfolder',
                'id' => $folder->id,
                'route_key' => $folder->getRouteKey(),
                'name' => $folder->name,
                'path' => $path,
                'updated_at' => $folder->updated_at?->toIso8601String(),
                'href' => route('documents.manage', $folder),
                'is_pinned' => true,
            ];
        }

        $document = $pin->document;
        if (! $document) {
            return [
                'pin_id' => $pin->id,
                'kind' => 'missing',
                'type' => 'Unavailable',
                'id' => 0,
                'route_key' => '',
                'name' => 'Unavailable item',
                'path' => '/',
                'updated_at' => $pin->updated_at?->toIso8601String(),
                'href' => route('documents.manage'),
                'is_pinned' => true,
            ];
        }

        return [
            'pin_id' => $pin->id,
            'kind' => 'document',
            'type' => 'Document',
            'id' => $document->id,
            'route_key' => $document->getRouteKey(),
            'name' => $document->title,
            'path' => $document->folder ? $this->folderPath($document->folder) : '/',
            'updated_at' => $document->updated_at?->toIso8601String(),
            'href' => route('documents.show', $document),
            'is_pinned' => true,
        ];
    }

    private function folderPath(Folder $folder): string
    {
        if ($folder->legacy_path) {
            $legacy = trim(str_replace('\\', '/', $folder->legacy_path), '/');
            if ($legacy !== '') {
                return '/'.$legacy;
            }
        }

        $crumbs = $this->hierarchy->breadcrumbs($folder);
        return '/'.implode('/', array_map(fn (Folder $item) => $item->name, $crumbs));
    }
}
