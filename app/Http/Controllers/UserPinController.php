<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Folder;
use App\Models\UserPin;
use App\Services\PinnedItemsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class UserPinController extends Controller
{
    public function index(Request $request, PinnedItemsService $pins): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:250'],
            'type' => ['nullable', 'in:all,filenames,subfolders,folders,documents'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        return response()->json([
            'items' => $pins->search(
                $request->user(),
                $validated['search'] ?? null,
                $validated['type'] ?? 'all',
                (int) ($validated['limit'] ?? 25),
            )->values(),
        ]);
    }

    public function folder(Request $request, Folder $folder): RedirectResponse
    {
        $this->authorize('view', $folder);

        $pin = UserPin::query()
            ->where('user_id', $request->user()->id)
            ->where('folder_id', $folder->id)
            ->first();

        if ($pin) {
            $pin->delete();
            return back()->with('success', 'Folder unpinned.');
        }

        UserPin::query()->create([
            'user_id' => $request->user()->id,
            'folder_id' => $folder->id,
        ]);

        return back()->with('success', 'Folder pinned.');
    }

    public function document(Request $request, Document $document): RedirectResponse
    {
        $this->authorize('view', $document);

        $pin = UserPin::query()
            ->where('user_id', $request->user()->id)
            ->where('document_id', $document->id)
            ->first();

        if ($pin) {
            $pin->delete();
            return back()->with('success', 'Document unpinned.');
        }

        UserPin::query()->create([
            'user_id' => $request->user()->id,
            'document_id' => $document->id,
        ]);

        return back()->with('success', 'Document pinned.');
    }
}
