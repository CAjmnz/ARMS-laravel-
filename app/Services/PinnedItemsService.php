<?php

namespace App\Services;

use App\Models\Folder;
use App\Models\User;
use App\Models\UserPin;
use Illuminate\Contracts\Pagination\LengthAwarePaginator as LengthAwarePaginatorContract;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
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
    public function top(User $user, int $limit = 3): Collection
    {
        return $this->payloadCollection($user, '', 'all')
            ->take($limit)
            ->values();
    }

    public function paginate(User $user, ?string $keyword = null, string $type = 'all', int $perPage = 10): LengthAwarePaginatorContract
    {
        $items = $this->payloadCollection($user, trim((string) $keyword), $type);
        $page = max(1, (int) request()->integer('page', 1));

        return new LengthAwarePaginator(
            $items->forPage($page, $perPage)->values(),
            $items->count(),
            $perPage,
            $page,
            [
                'path' => request()->url(),
                'query' => request()->query(),
            ],
        );
    }

    /** @return Collection<int, array<string, mixed>> */
    public function search(User $user, ?string $keyword = null, string $type = 'all', int $limit = 25): Collection
    {
        return $this->payloadCollection($user, trim((string) $keyword), $type)
            ->take($limit)
            ->values();
    }

    private function queryFor(User $user, string $type = 'all'): Builder
    {
        $query = UserPin::query()
            ->where('user_id', $user->id)
            ->with([
                'folder:id,parent_id,subsidiary_id,department_id,name,depth,legacy_path,updated_at',
                'folder.subsidiary:id,name',
                'folder.department:id,name',
                'document:id,folder_id,title,updated_at',
                'document.latestVersion',
                'document.folder:id,parent_id,subsidiary_id,department_id,name,depth,legacy_path,updated_at',
                'document.folder.subsidiary:id,name',
                'document.folder.department:id,name',
            ])
            ->where(function (Builder $scope): void {
                $scope->whereHas('folder')->orWhereHas('document');
            });

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

        if ($type === 'filenames') {
            $query->whereHas('folder', fn (Builder $folder) => $folder->where('depth', 0));
        } elseif ($type === 'subfolders') {
            $query->whereHas('folder', fn (Builder $folder) => $folder->where('depth', '>=', 1));
        } elseif ($type === 'folders') {
            $query->whereNotNull('folder_id');
        } elseif ($type === 'documents') {
            $query->whereNotNull('document_id');
        }

        return $query;
    }

    /** @return Collection<int, array<string, mixed>> */
    private function payloadCollection(User $user, string $keyword = '', string $type = 'all'): Collection
    {
        $needle = mb_strtolower(trim($keyword));

        return $this->queryFor($user, $type)
            ->latest('user_pins.updated_at')
            ->get()
            ->map(fn (UserPin $pin) => $this->payload($pin))
            ->filter(function (array $item) use ($needle): bool {
                if ($needle === '') {
                    return true;
                }

                $haystack = mb_strtolower(implode(' ', [
                    (string) ($item['name'] ?? ''),
                    (string) ($item['type'] ?? ''),
                    (string) ($item['path'] ?? ''),
                ]));

                return str_contains($haystack, $needle);
            })
            ->values();
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
                'type' => $folder->depth === 0 ? 'Filename' : 'Subfolder'.max(1, (int) $folder->depth),
                'id' => $folder->id,
                'route_key' => $folder->getRouteKey(),
                'name' => $folder->name,
                'path' => $path,
                'updated_at' => $folder->updated_at?->toIso8601String(),
                'href' => route('documents.manage', $folder),
                'information_url' => route('documents.folders.information', $folder),
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
            'file_type' => strtoupper((string) (pathinfo($document->title, PATHINFO_EXTENSION) ?: 'FILE')),
            'id' => $document->id,
            'route_key' => $document->getRouteKey(),
            'name' => $document->title,
            'path' => $document->folder
                ? $this->folderPath($document->folder).' / '.$document->title
                : $document->title,
            'updated_at' => $document->updated_at?->toIso8601String(),
            'opens_viewer' => false,
            'href' => $document->folder
                ? route('documents.manage', [
                    'folder' => $document->folder,
                    'open_document' => $document->getRouteKey(),
                ])
                : route('documents.show', $document),
            'information_url' => route('documents.information', $document),
            'is_pinned' => true,
        ];
    }

    private function folderPath(Folder $folder): string
    {
        $crumbs = collect($this->hierarchy->breadcrumbs($folder));
        $root = $crumbs->first() ?? $folder;
        $segments = collect([
            $root->subsidiary?->name,
            $root->department?->name,
        ])->filter(fn ($value) => filled($value));

        foreach ($crumbs as $crumb) {
            if (! filled($crumb->name)) {
                continue;
            }

            if ($segments->last() !== $crumb->name) {
                $segments->push($crumb->name);
            }
        }

        if ($segments->isEmpty() && filled($folder->name)) {
            $segments->push($folder->name);
        }

        return $segments->implode(' / ');
    }
}
