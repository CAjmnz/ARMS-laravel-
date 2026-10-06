<?php

namespace App\Services;

use App\Models\Document;
use Illuminate\Support\Facades\Storage;

class DocumentFileCleanupService
{
    /**
     * Remove all physical original/viewer files belonging to a document.
     *
     * The document record remains soft-deleted so existing Laravel audit and
     * authorization history is preserved, but its protected file contents are
     * no longer retained after a destructive document action.
     */
    public function cleanup(Document $document): void
    {
        $document->loadMissing('versions');

        foreach ($document->versions as $version) {
            $disk = Storage::disk($version->storage_disk ?: 'documents');

            foreach (array_unique(array_filter([
                $version->storage_path,
                $version->watermark_path,
                $version->preview_path,
            ])) as $path) {
                if ($disk->exists($path)) {
                    $disk->delete($path);
                }
            }
        }
    }
}
