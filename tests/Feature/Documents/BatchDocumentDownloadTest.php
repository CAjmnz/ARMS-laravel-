<?php

namespace Tests\Feature\Documents;

use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\DocumentVersion;
use App\Models\Department;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use App\Services\BatchDocumentDownloadService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery;
use RuntimeException;
use Tests\TestCase;
use ZipArchive;

class BatchDocumentDownloadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('documents');
    }

    public function test_level_two_can_download_authorized_documents_as_one_zip(): void
    {
        $user = $this->userWithRole(Role::LEVEL_2);
        [$first, $second] = $this->documents(['Quarterly Report', 'Monthly Report']);

        foreach ([$first, $second] as $document) {
            DocumentAccess::query()->create([
                'document_id' => $document->id,
                'user_id' => $user->id,
                'can_view' => true,
                'can_download' => true,
            ]);
        }

        $response = $this->actingAs($user)->post(route('documents.bulk-download'), [
            'document_ids' => [$first->id, $second->id],
        ]);

        $response->assertOk();
        $response->assertHeader('content-type', 'application/zip');
        $this->assertMatchesRegularExpression(
            '/attachment; filename=RMS-selected-documents-\d{4}-\d{2}-\d{2}-\d{6}\.zip/',
            (string) $response->headers->get('content-disposition'),
        );
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'event' => 'document.batch_downloaded',
        ]);
    }

    public function test_level_one_cannot_batch_download_even_when_document_is_visible(): void
    {
        $user = $this->userWithRole(Role::LEVEL_1);
        [$document] = $this->documents(['View Only']);
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $this->actingAs($user)
            ->post(route('documents.bulk-download'), ['document_ids' => [$document->id]])
            ->assertForbidden();
    }

    public function test_level_two_cannot_include_an_unauthorized_document(): void
    {
        $user = $this->userWithRole(Role::LEVEL_2);
        [$authorized, $unauthorized] = $this->documents(['Allowed', 'Private']);
        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $service = Mockery::mock(BatchDocumentDownloadService::class);
        $service->shouldNotReceive('create');
        $this->app->instance(BatchDocumentDownloadService::class, $service);

        $this->actingAs($user)
            ->post(route('documents.bulk-download'), ['document_ids' => [$authorized->id, $unauthorized->id]])
            ->assertForbidden();

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'document.batch_downloaded',
        ]);
    }

    public function test_empty_duplicate_invalid_and_over_limit_selections_are_rejected(): void
    {
        $user = $this->userWithRole(Role::LEVEL_4);
        [$document] = $this->documents(['Validation']);

        $this->actingAs($user)->postJson(route('documents.bulk-download'), ['document_ids' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('document_ids');

        $this->actingAs($user)->postJson(route('documents.bulk-download'), ['document_ids' => [$document->id, $document->id]])
            ->assertUnprocessable()->assertJsonValidationErrors('document_ids.1');

        $this->actingAs($user)->postJson(route('documents.bulk-download'), ['document_ids' => [999999]])
            ->assertUnprocessable()->assertJsonValidationErrors('document_ids.0');

        $this->actingAs($user)->postJson(route('documents.bulk-download'), ['document_ids' => array_fill(0, 51, $document->id)])
            ->assertUnprocessable()->assertJsonValidationErrors('document_ids');
    }

    public function test_soft_deleted_document_is_rejected(): void
    {
        $user = $this->userWithRole(Role::LEVEL_4);
        [$document] = $this->documents(['Deleted']);
        $document->delete();

        $this->actingAs($user)
            ->postJson(route('documents.bulk-download'), ['document_ids' => [$document->id]])
            ->assertUnprocessable()
            ->assertJson([
                'message' => 'One or more selected documents no longer exist.',
            ]);
    }

    public function test_service_creates_valid_zip_with_viewer_files_and_unique_names(): void
    {
        [$first, $second] = $this->documents(['Same Name', 'Same Name']);

        $path = app(BatchDocumentDownloadService::class)->create(collect([$first->load('latestVersion'), $second->load('latestVersion')]));

        try {
            $zip = new ZipArchive();
            $this->assertTrue($zip->open($path, ZipArchive::CHECKCONS) === true);
            $this->assertSame(2, $zip->numFiles);
            $this->assertNotFalse($zip->locateName('Same Name.pdf'));
            $this->assertNotFalse($zip->locateName('Same Name (2).pdf'));
            $this->assertSame('viewer-Same Name', $zip->getFromName('Same Name.pdf'));
            $zip->close();
        } finally {
            @unlink($path);
        }
    }

    public function test_missing_physical_viewer_file_is_rejected_without_archive(): void
    {
        [$document] = $this->documents(['Missing File']);
        Storage::disk('documents')->delete($document->latestVersion->watermark_path);

        try {
            app(BatchDocumentDownloadService::class)->create(collect([$document->load('latestVersion')]));
            $this->fail('Expected validation exception was not thrown.');
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $this->assertStringContainsString('could not be found', (string) collect($exception->errors())->flatten()->first());
        }
    }

    public function test_zip_generation_failure_returns_useful_error_and_does_not_log_success(): void
    {
        $user = $this->userWithRole(Role::LEVEL_4);
        [$document] = $this->documents(['Failure']);

        $service = Mockery::mock(BatchDocumentDownloadService::class);
        $service->shouldReceive('create')->once()->andThrow(new RuntimeException('Simulated ZIP failure'));
        $this->app->instance(BatchDocumentDownloadService::class, $service);

        $this->actingAs($user)
            ->postJson(route('documents.bulk-download'), ['document_ids' => [$document->id]])
            ->assertStatus(500)
            ->assertJson([
                'message' => 'The selected documents could not be packaged for download. Please try again.',
            ]);

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'document.batch_downloaded',
        ]);
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $slug)->firstOrFail());

        return $user;
    }

    /**
     * @return array<int, Document>
     */
    private function documents(array $titles): array
    {
        $subsidiary = Subsidiary::query()->firstOrCreate(
            ['code' => 'BATCH'],
            ['name' => 'Batch Download', 'status' => 'active'],
        );
        $department = Department::query()->firstOrCreate(
            ['subsidiary_id' => $subsidiary->id, 'code' => 'DOCS'],
            ['name' => 'Documents', 'status' => 'active'],
        );
        $folder = Folder::query()->firstOrCreate(
            ['subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'slug' => 'batch'],
            ['name' => 'Batch', 'depth' => 0],
        );

        return collect($titles)->map(function (string $title, int $index) use ($folder): Document {
            $document = Document::query()->create([
                'folder_id' => $folder->id,
                'title' => $title,
                'status' => 'ready',
            ]);
            $originalPath = 'originals/test-'.$document->id.'.pdf';
            $viewerPath = 'viewers/test-'.$document->id.'.pdf';
            Storage::disk('documents')->put($originalPath, 'original-'.$title);
            Storage::disk('documents')->put($viewerPath, 'viewer-'.$title);
            DocumentVersion::query()->create([
                'document_id' => $document->id,
                'version_number' => 1,
                'original_filename' => $title.'.pdf',
                'storage_disk' => 'documents',
                'storage_path' => $originalPath,
                'watermark_path' => $viewerPath,
                'preview_path' => $viewerPath,
                'mime_type' => 'application/pdf',
                'extension' => 'pdf',
                'size_bytes' => 100 + $index,
                'sha256' => hash('sha256', 'original-'.$title.'-'.$document->id),
                'scan_status' => 'ready',
                'scanned_at' => now(),
            ]);

            return $document->load('latestVersion');
        })->all();
    }
}
