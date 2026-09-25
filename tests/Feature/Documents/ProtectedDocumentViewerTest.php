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

    public function test_level_one_can_view_but_cannot_download_the_protected_viewer(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$document] = $this->document('View Only PDF', 'pdf', 'application/pdf');
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);

        $this->actingAs($user)->get(route('documents.viewer', $document))->assertOk();
        $this->actingAs($user)->get(route('documents.download', $document))->assertForbidden();
        $this->actingAs($user)->get(route('documents.original', $document))->assertForbidden();
    }

    public function test_level_two_can_view_and_download_only_the_protected_viewer_copy(): void
    {
        $user = $this->userWithRole(Role::LEVEL_2);
        [$document, $viewerPath, $originalPath] = $this->document('Downloadable PDF', 'pdf', 'application/pdf');
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $response = $this->actingAs($user)->get(route('documents.download', $document));
        $response->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('attachment;', (string) $response->headers->get('content-disposition'));
        $this->assertSame(Storage::disk('documents')->path($viewerPath), $response->baseResponse->getFile()->getPathname());
        $this->assertNotSame(Storage::disk('documents')->path($originalPath), $response->baseResponse->getFile()->getPathname());
    }

    public function test_missing_viewer_copy_is_rebuilt_from_a_present_original(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$document, $viewerPath] = $this->document('Rebuild Viewer', 'pdf', 'application/pdf');
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);
        Storage::disk('documents')->delete($viewerPath);

        $response = $this->actingAs($user)->get(route('documents.viewer', $document));
        $response->assertOk();
        $document->refresh();
        $document->load('latestVersion');
        $this->assertNotEmpty($document->latestVersion->watermark_path);
        Storage::disk('documents')->assertExists($document->latestVersion->watermark_path);
    }

    public function test_missing_original_and_viewer_returns_unavailable_viewer(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$document, $viewerPath, $originalPath] = $this->document('Missing Viewer', 'pdf', 'application/pdf');
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);
        Storage::disk('documents')->delete([$viewerPath, $originalPath]);

        $this->actingAs($user)->get(route('documents.viewer', $document))->assertStatus(409);
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
