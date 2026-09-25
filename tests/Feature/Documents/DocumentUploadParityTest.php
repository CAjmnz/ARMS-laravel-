<?php

namespace Tests\Feature\Documents;

use App\Models\Department;
use App\Models\Document;
use App\Models\FileType;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Database\Seeders\FileTypeSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentUploadParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolePermissionSeeder::class, FileTypeSeeder::class]);
        Storage::fake('documents');
    }

    public function test_single_upload_stores_original_viewer_record_and_audit(): void
    {
        [$folder, $admin] = $this->folder(false);
        $response = $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('annual report.pdf', '%PDF-1.4 original')],
            'viewer_files' => [UploadedFile::fake()->createWithContent('annual report.pdf', '%PDF-1.4 viewer')],
        ]);

        $response->assertRedirect()->assertSessionHas('upload_results');
        $document = Document::query()->firstOrFail();
        $version = $document->latestVersion;

        $this->assertSame('annual_report', $document->title);
        $this->assertSame('ready', $document->status);
        $this->assertNotNull($version->watermark_path);
        $this->assertSame('ready', $version->scan_status);
        $this->assertTrue(Storage::disk('documents')->exists($version->storage_path));
        $this->assertTrue(Storage::disk('documents')->exists($version->watermark_path));
        $this->assertDatabaseHas('activity_logs', [
            'auditable_type' => Document::class,
            'auditable_id' => $document->id,
            'event' => 'document.uploaded',
        ]);
    }

    public function test_multiple_uploads_create_multiple_documents(): void
    {
        [$folder, $admin] = $this->folder(false);
        $files = [
            UploadedFile::fake()->createWithContent('first.pdf', '%PDF first'),
            UploadedFile::fake()->createWithContent('second.pdf', '%PDF second'),
        ];

        $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => $files,
        ])->assertRedirect();

        $this->assertSame(2, Document::query()->count());
        $this->assertDatabaseHas('documents', ['title' => 'first']);
        $this->assertDatabaseHas('documents', ['title' => 'second']);
    }

    public function test_invalid_filename_and_extension_are_rejected_without_creating_a_record(): void
    {
        [$folder, $admin] = $this->folder(false);

        $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('bad:name.pdf', '%PDF bad')],
        ])->assertRedirect()->assertSessionHasErrors('upload');

        $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('bad.exe', 'MZ')],
        ])->assertRedirect()->assertSessionHasErrors('upload');

        $this->assertSame(0, Document::query()->count());
    }

    public function test_duplicate_filename_is_rejected(): void
    {
        [$folder, $admin] = $this->folder(false);

        $payload = ['original_files' => [UploadedFile::fake()->createWithContent('duplicate.pdf', '%PDF duplicate')]];
        $this->actingAs($admin)->post(route('documents.upload', $folder), $payload)->assertRedirect();
        $this->actingAs($admin)->post(route('documents.upload', $folder), ['original_files' => [UploadedFile::fake()->createWithContent('duplicate.pdf', '%PDF duplicate 2')]])
            ->assertRedirect()->assertSessionHasErrors('upload');

        $this->assertSame(1, Document::query()->count());
    }

    public function test_oversized_file_is_rejected_using_current_configured_file_type_limit(): void
    {
        [$folder, $admin] = $this->folder(false);
        FileType::query()->where('extension', 'pdf')->update(['maximum_size_kb' => 1]);

        $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->create('large.pdf', 2, 'application/pdf')],
        ])->assertRedirect()->assertSessionHasErrors('upload');

        $this->assertSame(0, Document::query()->count());
    }

    public function test_published_folder_rejects_upload_even_for_level_four(): void
    {
        [$folder, $admin] = $this->folder(true);

        $this->actingAs($admin)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('published.pdf', '%PDF published')],
        ])->assertForbidden();

        $this->assertSame(0, Document::query()->count());
    }

    public function test_level_three_upload_requires_owner_and_upload_capability(): void
    {
        [$folder, $admin] = $this->folder(false);
        $level3 = User::factory()->create(['allowed_upload' => true]);
        $level3->roles()->attach(Role::query()->where('slug', Role::LEVEL_3)->firstOrFail()->id);
        $level3->load('roles');

        $this->actingAs($level3)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('blocked.pdf', '%PDF blocked')],
        ])->assertForbidden();

        $folder->update(['created_by' => $level3->id]);
        $this->actingAs($level3)->post(route('documents.upload', $folder), [
            'original_files' => [UploadedFile::fake()->createWithContent('allowed.pdf', '%PDF allowed')],
        ])->assertRedirect();

        $this->assertDatabaseHas('documents', ['title' => 'allowed']);
    }

    private function folder(bool $published): array
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'HO', 'name' => 'Head Office', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'REC', 'name' => 'Records', 'status' => 'active']);
        $admin = User::factory()->create(['allowed_upload' => true]);
        $admin->roles()->attach(Role::query()->where('slug', Role::LEVEL_4)->firstOrFail()->id);
        $admin->load('roles');

        $folder = Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => 'Uploads',
            'slug' => 'uploads',
            'depth' => 0,
            'is_published' => $published,
            'unpublished_by' => $published ? null : $admin->id,
            'unpublished_at' => $published ? null : now(),
            'created_by' => $admin->id,
        ]);

        return [$folder, $admin];
    }
}
