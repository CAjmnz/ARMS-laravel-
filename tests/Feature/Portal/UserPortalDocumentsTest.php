<?php

namespace Tests\Feature\Portal;

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
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserPortalDocumentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_portal_root_shows_only_authorized_navigation_folders(): void
    {
        [$root, $child, $authorized, $hidden] = $this->records();
        $user = $this->user(Role::LEVEL_1);

        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);

        $this->actingAs($user)
            ->get(route('portal.documents'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Portal/Documents')
                ->where('currentFolder', null)
                ->has('folders', 1)
                ->where('folders.0.id', $root->id)
                ->where('folders.0.name', 'Authorized Root')
                ->has('documents', 0)
                ->where('summary.visible_documents', 1));
    }

    public function test_authorized_user_can_navigate_folder_and_see_only_assigned_document(): void
    {
        [$root, $child, $authorized, $hidden] = $this->records();
        $user = $this->user(Role::LEVEL_1);

        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);

        $this->actingAs($user)
            ->get(route('portal.documents', $child))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('currentFolder.id', $child->id)
                ->has('breadcrumbs', 2)
                ->where('breadcrumbs.0.id', $root->id)
                ->where('breadcrumbs.1.id', $child->id)
                ->has('documents', 1)
                ->where('documents.0.id', $authorized->id)
                ->where('documents.0.download_url', null)
                ->where('documents.0.name', 'Assigned File'));
    }

    public function test_level_two_gets_download_url_only_for_download_authorized_document(): void
    {
        [, $child, $authorized] = $this->records();
        $user = $this->user(Role::LEVEL_2);

        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $this->actingAs($user)
            ->get(route('portal.documents', $child))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.can_download', true)
                ->where('documents.0.id', $authorized->id)
                ->where('documents.0.download_url', fn ($url) => is_string($url) && str_ends_with($url, '/download')));
    }

    public function test_user_cannot_open_unrelated_folder_by_forging_url(): void
    {
        [$root, , $authorized] = $this->records();
        [$otherRoot] = $this->otherRecords();
        $user = $this->user(Role::LEVEL_2);

        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $this->actingAs($user)->get(route('portal.documents', $otherRoot))->assertForbidden();
        $this->actingAs($user)->get(route('portal.documents', $root))->assertOk();
    }

    public function test_portal_search_is_limited_to_current_authorized_location(): void
    {
        [, $child, $authorized, $hidden] = $this->records();
        $user = $this->user(Role::LEVEL_2);

        DocumentAccess::query()->create([
            'document_id' => $authorized->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $this->actingAs($user)
            ->get(route('portal.documents', ['folder' => $child, 'search' => 'Hidden']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.search', 'Hidden')
                ->has('documents', 0)
                ->has('folders', 0));

        $this->actingAs($user)
            ->get(route('portal.documents', ['folder' => $child, 'search' => 'Assigned']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('documents', 1)
                ->where('documents.0.id', $authorized->id));
    }

    /** @return array{Folder, Folder, Document, Document} */
    private function records(): array
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'A', 'name' => 'Alturas', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'RMS', 'name' => 'Records', 'status' => 'active']);
        $root = Folder::query()->create(['subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'name' => 'Authorized Root', 'slug' => 'authorized-root', 'depth' => 0]);
        $child = Folder::query()->create(['parent_id' => $root->id, 'subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'name' => 'Child Folder', 'slug' => 'child-folder', 'depth' => 1]);
        $authorized = Document::query()->create(['folder_id' => $child->id, 'title' => 'Assigned File', 'status' => 'ready']);
        $hidden = Document::query()->create(['folder_id' => $child->id, 'title' => 'Hidden File', 'status' => 'ready']);

        foreach ([$authorized, $hidden] as $document) {
            DocumentVersion::query()->create([
                'document_id' => $document->id,
                'version_number' => 1,
                'original_filename' => $document->title.'.pdf',
                'storage_disk' => 'documents',
                'storage_path' => 'originals/'.$document->id.'.pdf',
                'watermark_path' => 'viewers/'.$document->id.'.pdf',
                'preview_path' => 'viewers/'.$document->id.'.pdf',
                'mime_type' => 'application/pdf',
                'extension' => 'pdf',
                'size_bytes' => 1200,
                'sha256' => str_repeat((string) $document->id, 64)[0] ? hash('sha256', (string) $document->id) : hash('sha256', 'x'),
                'scan_status' => 'ready',
            ]);
        }

        return [$root, $child, $authorized, $hidden];
    }

    /** @return array{Folder} */
    private function otherRecords(): array
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'B', 'name' => 'Other Subsidiary', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'OPS', 'name' => 'Operations', 'status' => 'active']);
        $root = Folder::query()->create(['subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'name' => 'Private Root', 'slug' => 'private-root', 'depth' => 0]);

        return [$root];
    }

    private function user(string $roleSlug): User
    {
        $user = User::factory()->create();
        $role = Role::query()->where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role->id);

        return $user;
    }
}
