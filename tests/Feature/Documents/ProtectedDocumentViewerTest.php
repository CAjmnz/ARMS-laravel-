<?php

namespace Tests\Feature\Documents;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\DocumentVersion;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProtectedDocumentViewerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('documents');
    }

    public function test_level_one_streams_protected_pdf_and_image_viewer_files_without_exposing_originals(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$pdf, $pdfViewerPath, $pdfOriginalPath] = $this->document('Protected PDF', 'pdf', 'application/pdf');
        [$image, $imageViewerPath, $imageOriginalPath] = $this->document('Protected Image', 'png', 'image/png');

        foreach ([$pdf, $image] as $document) {
            DocumentAccess::query()->create([
                'document_id' => $document->id,
                'user_id' => $user->id,
                'can_view' => true,
                'can_download' => false,
            ]);
        }

        $pdfResponse = $this->actingAs($user)->get(route('documents.viewer', $pdf));
        $pdfResponse->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertHeader('x-content-type-options', 'nosniff');
        $pdfCacheControl = (string) $pdfResponse->headers->get('cache-control');
        $this->assertStringContainsString('private', $pdfCacheControl);
        $this->assertStringContainsString('no-store', $pdfCacheControl);
        $this->assertStringContainsString('max-age=0', $pdfCacheControl);
        $this->assertStringStartsWith('inline;', (string) $pdfResponse->headers->get('content-disposition'));
        $this->assertSame(Storage::disk('documents')->path($pdfViewerPath), $pdfResponse->baseResponse->getFile()->getPathname());
        $this->assertNotSame(Storage::disk('documents')->path($pdfOriginalPath), $pdfResponse->baseResponse->getFile()->getPathname());

        $imageResponse = $this->actingAs($user)->get(route('documents.viewer', $image));
        $imageResponse->assertOk()
            ->assertHeader('content-type', 'image/png')
            ->assertHeader('x-content-type-options', 'nosniff');
        $imageCacheControl = (string) $imageResponse->headers->get('cache-control');
        $this->assertStringContainsString('private', $imageCacheControl);
        $this->assertStringContainsString('no-store', $imageCacheControl);
        $this->assertStringContainsString('max-age=0', $imageCacheControl);
        $this->assertStringStartsWith('inline;', (string) $imageResponse->headers->get('content-disposition'));
        $this->assertSame(Storage::disk('documents')->path($imageViewerPath), $imageResponse->baseResponse->getFile()->getPathname());
        $this->assertNotSame(Storage::disk('documents')->path($imageOriginalPath), $imageResponse->baseResponse->getFile()->getPathname());

        $this->assertDatabaseCount('activity_logs', 2);
        $this->assertDatabaseHas('activity_logs', ['user_id' => $user->id, 'event' => 'document.viewed', 'auditable_id' => $pdf->id]);
        $this->assertDatabaseHas('activity_logs', ['user_id' => $user->id, 'event' => 'document.viewed', 'auditable_id' => $image->id]);
    }

    public function test_unassigned_user_cannot_open_protected_viewer_by_forging_document_url(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$document] = $this->document('Private PDF', 'pdf', 'application/pdf');

        $this->actingAs($user)
            ->get(route('documents.viewer', $document))
            ->assertForbidden();

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'document.viewed',
            'auditable_id' => $document->id,
        ]);
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $slug)->firstOrFail());

        return $user;
    }

    /** @return array{Document, string, string} */
    private function document(string $title, string $extension, string $mime): array
    {
        $subsidiary = Subsidiary::query()->firstOrCreate(
            ['code' => 'VIEW'],
            ['name' => 'Viewer Tests', 'status' => 'active'],
        );
        $department = Department::query()->firstOrCreate(
            ['subsidiary_id' => $subsidiary->id, 'code' => 'DOCS'],
            ['name' => 'Documents', 'status' => 'active'],
        );
        $folder = Folder::query()->firstOrCreate(
            ['subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'slug' => 'viewer-tests'],
            ['name' => 'Viewer Tests', 'depth' => 0],
        );

        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => $title,
            'status' => 'ready',
        ]);

        $originalPath = 'originals/viewer-'.$document->id.'.'.$extension;
        $viewerPath = 'viewers/viewer-'.$document->id.'.'.$extension;
        Storage::disk('documents')->put($originalPath, 'ORIGINAL-'.$title);
        Storage::disk('documents')->put($viewerPath, 'PROTECTED-'.$title);

        DocumentVersion::query()->create([
            'document_id' => $document->id,
            'version_number' => 1,
            'original_filename' => $title.'.'.$extension,
            'storage_disk' => 'documents',
            'storage_path' => $originalPath,
            'watermark_path' => $viewerPath,
            'preview_path' => $viewerPath,
            'mime_type' => $mime,
            'extension' => $extension,
            'size_bytes' => 256,
            'sha256' => hash('sha256', 'ORIGINAL-'.$title),
            'scan_status' => 'ready',
            'scanned_at' => now(),
        ]);

        return [$document->load('latestVersion'), $viewerPath, $originalPath];
    }
}
