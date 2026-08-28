<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use App\Services\DocumentUploadService;
use App\Services\FolderHierarchyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function files(Request $request, Folder $folder, FolderHierarchyService $hierarchy): Response
    {
        $this->authorize('view', $folder);
        $search = trim((string) $request->input('search', ''));
        $perPage = in_array((int) $request->input('per_page'), [10, 25, 50, 100], true) ? (int) $request->input('per_page') : 10;
        $user = $request->user();

        $documents = Document::query()->where('folder_id', $folder->id)
            ->when($search, fn ($query) => $query->where('title', 'like', '%'.$search.'%'))
            ->with([
                'creator:id,name',
                'latestVersion' => fn ($query) => $query->select([
                    'document_versions.id',
                    'document_versions.document_id',
                    'document_versions.extension',
                    'document_versions.size_bytes',
                    'document_versions.scan_status',
                    'document_versions.uploaded_by',
                ]),
            ])
            ->latest('updated_at')->paginate($perPage)->withQueryString()->through(fn (Document $item) => [
                'id' => $item->id,
                'name' => $item->title,
                'type' => strtoupper($item->latestVersion?->extension ?? 'document'),
                'modified_at' => $item->updated_at?->toIso8601String(),
                'owner' => $item->creator?->name ?? '—',
                'status' => $item->latestVersion?->scan_status ?? $item->status,
                'created_at' => $item->created_at?->toIso8601String(),
                'size' => $item->latestVersion?->size_bytes,
                'viewer_url' => $item->latestVersion?->scan_status === 'ready' ? route('documents.viewer', $item) : null,
                'show_url' => route('documents.show', $item),
                'download_url' => $user->can('download', $item) ? route('documents.download', $item) : null,
                'edit_url' => $user->can('update', $item) ? route('documents.edit', $item) : null,
                'delete_url' => $user->can('delete', $item) ? route('documents.destroy', $item) : null,
            ]);

        return Inertia::render('Documents/Files', [
            'folder' => ['id' => $folder->id, 'name' => $folder->name, 'documents_count' => $folder->documents()->count()],
            'breadcrumbs' => array_map(fn (Folder $item) => ['id' => $item->id, 'name' => $item->name], $hierarchy->breadcrumbs($folder)),
            'documents' => $documents,
            'filters' => ['search' => $search],
        ]);
    }

    public function show(Request $request, Document $document): Response
    {
        $this->authorize('view', $document);

        $user = $request->user();

        return Inertia::render('Documents/Show', [
            'document' => $this->payload($user, $document->load(['folder', 'creator', 'latestVersion.uploader'])),
            'destinations' => $user->can('move', $document)
                ? Folder::query()->withCount('children')->orderBy('name')->get()->filter(fn (Folder $folder) => $user->can('upload', $folder))->map(fn (Folder $folder) => ['id' => $folder->id, 'name' => $folder->name])->values()
                : [],
        ]);
    }

    public function edit(Request $request, Document $document): Response
    {
        $this->authorize('update', $document);

        return Inertia::render('Documents/Edit', [
            'document' => $this->payload($request->user(), $document->load(['folder', 'creator', 'latestVersion.uploader'])),
        ]);
    }

    public function update(Request $request, Document $document): RedirectResponse
    {
        $this->authorize('update', $document);
        $data = $request->validate(['title' => ['required', 'string', 'max:250'], 'description' => ['nullable', 'string', 'max:5000']]);
        $data['title'] = $this->normalizeWindowsName($data['title'], 'title');

        if (Document::query()->where('folder_id', $document->folder_id)->where('title', $data['title'])->whereKeyNot($document->id)->exists()) {
            return back()->withErrors(['title' => 'A document with this name already exists in this folder.']);
        }

        $old = $document->only(['title', 'description']);
        $document->update($data);
        $this->audit($request, 'document.updated', $document, $old, $document->only(['title', 'description']));

        return back()->with('success', 'Document details were saved.');
    }

    public function move(Request $request, Document $document): RedirectResponse
    {
        $this->authorize('move', $document);
        $data = $request->validate(['folder_id' => ['required', 'integer', 'exists:folders,id']]);
        $destination = Folder::query()->findOrFail($data['folder_id']);

        if (! $request->user()->can('upload', $destination)) {
            abort(403);
        }

        if (Document::query()->where('folder_id', $destination->id)->where('title', $document->title)->whereKeyNot($document->id)->exists()) {
            return back()->withErrors(['folder_id' => 'A document with this name already exists in the destination folder.']);
        }

        $oldFolder = $document->folder_id;
        $document->update(['folder_id' => $destination->id]);
        $this->audit($request, 'document.moved', $document, ['folder_id' => $oldFolder], ['folder_id' => $destination->id]);

        return back()->with('success', 'Document moved successfully.');
    }

    public function bulkMove(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'document_ids' => ['required', 'array', 'min:1'],
            'document_ids.*' => ['integer', 'exists:documents,id'],
            'folder_id' => ['required', 'integer', 'exists:folders,id'],
        ]);

        $destination = Folder::query()->findOrFail($data['folder_id']);
        abort_unless($request->user()->can('upload', $destination), 403);

        $documents = Document::query()->whereIn('id', $data['document_ids'])->get();
        foreach ($documents as $document) {
            $this->authorize('move', $document);
            if (Document::query()->where('folder_id', $destination->id)->where('title', $document->title)->whereKeyNot($document->id)->exists()) {
                return back()->withErrors(['warning' => 'One or more selected documents already exist in the destination folder.']);
            }
        }

        foreach ($documents as $document) {
            $oldFolder = $document->folder_id;
            $document->update(['folder_id' => $destination->id]);
            $this->audit($request, 'document.moved', $document, ['folder_id' => $oldFolder], ['folder_id' => $destination->id]);
        }

        return back()->with('success', $documents->count().' document(s) transferred successfully.');
    }

    public function destroy(Request $request, Document $document): RedirectResponse
    {
        $this->authorize('delete', $document);
        $folder = $document->folder;
        $document->delete();
        $this->audit($request, 'document.deleted', $document, null, ['soft_deleted' => true]);

        return back()->with('success', 'Document was deleted.');
    }

    public function upload(Request $request, Folder $folder, DocumentUploadService $uploads): RedirectResponse
    {
        $this->authorize('upload', $folder);
        $request->validate([
            'original_files' => ['required', 'array', 'min:1', 'max:30'],
            'original_files.*' => ['file'],
            'viewer_files' => ['nullable', 'array', 'max:30'],
            'viewer_files.*' => ['nullable', 'file'],
        ]);

        $results = $uploads->upload(
            $folder,
            $request->file('original_files', []),
            $request->file('viewer_files', []),
            $request->user(),
            ['ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()],
        );

        $failed = collect($results)->where('ok', false);
        $success = collect($results)->where('ok', true)->count();
        $message = $success.' document(s) uploaded.';
        if ($failed->isNotEmpty()) {
            $details = $failed->map(fn (array $item) => ($item['name'] ?? 'File').': '.($item['error'] ?? 'Upload failed.'))->implode(' ');
            return back()
                ->with('upload_results', $results)
                ->with('error', $message.' '.$failed->count().' file(s) failed. '.$details)
                ->withErrors(['upload' => $details]);
        }

        return back()->with('upload_results', $results)->with('success', $message);
    }

    public function viewer(Request $request, Document $document)
    {
        $this->authorize('view', $document);
        $version = $document->latestVersion;
        abort_unless($version && $version->scan_status === 'ready' && $version->watermark_path, 409, 'The protected viewer is not ready.');

        return $this->stream($version->storage_disk, $version->watermark_path, $version->mime_type, false, $document->title);
    }

    public function downloadViewer(Request $request, Document $document)
    {
        $this->authorize('download', $document);
        $version = $document->latestVersion;
        abort_unless($version && $version->scan_status === 'ready' && $version->watermark_path, 409, 'The protected viewer is not ready.');

        $this->audit($request, 'document.viewer_downloaded', $document);
        return $this->stream($version->storage_disk, $version->watermark_path, $version->mime_type, true, $document->title);
    }

    public function downloadOriginal(Request $request, Document $document)
    {
        $this->authorize('downloadOriginal', $document);
        $version = $document->latestVersion;
        abort_unless($version && $version->storage_path, 404);

        $this->audit($request, 'document.original_downloaded', $document);
        return $this->stream($version->storage_disk, $version->storage_path, $version->mime_type, true, $document->title);
    }

    private function stream(string $disk, string $path, string $mime, bool $download, string $name)
    {
        abort_unless(Storage::disk($disk)->exists($path), 404);
        $filename = preg_replace('/[^A-Za-z0-9._ -]/', '_', $name) ?: 'document';

        return response()->file(Storage::disk($disk)->path($path), [
            'Content-Type' => $mime,
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.$filename.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function payload(User $user, Document $document): array
    {
        $version = $document->latestVersion;
        return [
            'id' => $document->id,
            'name' => $document->title,
            'description' => $document->description,
            'status' => $document->status,
            'created_at' => $document->created_at?->toIso8601String(),
            'updated_at' => $document->updated_at?->toIso8601String(),
            'folder' => ['id' => $document->folder->id, 'name' => $document->folder->name],
            'uploader' => $version?->uploader?->name ?? $document->creator?->name ?? '—',
            'version' => $version ? ['type' => strtoupper($version->extension), 'size' => $version->size_bytes, 'status' => $version->scan_status] : null,
            'urls' => [
                'viewer' => $version?->scan_status === 'ready' ? route('documents.viewer', $document) : null,
                'download' => $user->can('download', $document) ? route('documents.download', $document) : null,
                'original' => $user->can('downloadOriginal', $document) ? route('documents.original', $document) : null,
                'edit' => $user->can('update', $document) ? route('documents.edit', $document) : null,
            ],
            'permissions' => ['edit' => $user->can('update', $document), 'move' => $user->can('move', $document), 'delete' => $user->can('delete', $document)],
        ];
    }

    private function normalizeWindowsName(string $value, string $field): string
    {
        $value = trim($value);
        if ($value === '' || preg_match('/[<>:"\/\\|?*\x00-\x1F\x7F]/u', $value) || str_contains($value, '..')) {
            throw \Illuminate\Validation\ValidationException::withMessages([$field => 'The name contains characters that are not allowed by Windows.']);
        }

        $normalized = preg_replace('/\s+/', '_', $value);
        $normalized = is_string($normalized) ? rtrim($normalized, '. ') : '';
        $reserved = ['CON', 'PRN', 'AUX', 'NUL'];
        foreach (range(1, 9) as $number) {
            $reserved[] = 'COM'.$number;
            $reserved[] = 'LPT'.$number;
        }
        if ($normalized === '' || in_array(strtoupper($normalized), $reserved, true)) {
            throw \Illuminate\Validation\ValidationException::withMessages([$field => 'This name is reserved by Windows and cannot be used.']);
        }

        return $normalized;
    }

    private function audit(Request $request, string $event, Document $document, ?array $old = null, ?array $new = null): void
    {
        ActivityLog::query()->create(['user_id' => $request->user()->id, 'event' => $event, 'auditable_type' => Document::class, 'auditable_id' => $document->id, 'description' => 'Document action for '.$document->title.'.', 'old_values' => $old, 'new_values' => $new, 'ip_address' => $request->ip(), 'user_agent' => (string) $request->userAgent()]);
    }
}
