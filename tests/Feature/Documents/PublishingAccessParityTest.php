<?php

namespace Tests\Feature\Documents;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublishingAccessParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_level_three_can_publish_an_unpublished_folder_owned_by_another_level_three_manager(): void
    {
        [$folder, $owner] = $this->folder();
        $owner->roles()->sync([Role::query()->where('slug', Role::LEVEL_3)->firstOrFail()->id]);
        $owner->load('roles');
        $folder->update(['is_published' => false, 'unpublished_by' => $owner->id, 'unpublished_at' => now()]);

        $publisher = $this->userWithRole(Role::LEVEL_3);

        $this->assertTrue($publisher->can('publish', $folder));
        $this->actingAs($publisher)
            ->patch(route('documents.folders.publish', $folder))
            ->assertRedirect();

        $this->assertDatabaseHas('folders', [
            'id' => $folder->id,
            'is_published' => 1,
            'published_by' => $publisher->id,
        ]);
    }

    public function test_level_one_and_level_two_can_view_assigned_document_but_only_level_two_can_download_it(): void
    {
        [$folder] = $this->folder();
        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'Assigned Document',
            'status' => 'ready',
        ]);

        $levelOne = $this->userWithRole(Role::LEVEL_1);
        $levelTwo = $this->userWithRole(Role::LEVEL_2);
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $levelOne->id,
            'can_view' => true,
            'can_download' => false,
        ]);
        DocumentAccess::query()->create([
            'document_id' => $document->id,
            'user_id' => $levelTwo->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $this->assertTrue($levelOne->can('view', $document));
        $this->assertFalse($levelOne->can('download', $document));
        $this->assertTrue($levelTwo->can('view', $document));
        $this->assertTrue($levelTwo->can('download', $document));
    }

    public function test_unassigned_user_cannot_forge_folder_or_document_urls(): void
    {
        [$folder] = $this->folder();
        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'Private Document',
            'status' => 'ready',
        ]);
        $user = $this->userWithRole(Role::LEVEL_1);

        $this->actingAs($user)->get(route('documents.manage', $folder))->assertForbidden();
        $this->actingAs($user)->get(route('documents.show', $document))->assertForbidden();
    }

    public function test_level_four_has_full_document_access_and_delete_authority(): void
    {
        [$folder] = $this->folder();
        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'Administrator Document',
            'status' => 'ready',
        ]);
        $admin = $this->userWithRole(Role::LEVEL_4);

        $this->assertTrue($admin->can('view', $document));
        $this->assertTrue($admin->can('download', $document));
        $this->assertTrue($admin->can('delete', $document));
        $this->assertTrue($admin->can('view', $folder));
    }

    public function test_level_three_can_manage_documents_but_cannot_delete_them(): void
    {
        [$folder] = $this->folder();
        $admin = $this->userWithRole(Role::LEVEL_3);
        $folder->update(['created_by' => $admin->id]);
        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'Managed Document',
            'created_by' => $admin->id,
            'status' => 'ready',
        ]);

        $this->assertTrue($admin->can('view', $document));
        $this->assertTrue($admin->can('update', $document));
        $this->assertFalse($admin->can('delete', $document));
    }

    public function test_published_folder_remains_a_valid_authorized_navigation_path_but_not_an_upload_destination(): void
    {
        [$folder] = $this->folder();
        $user = $this->userWithRole(Role::LEVEL_2);
        DocumentAccess::query()->create([
            'folder_id' => $folder->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => true,
        ]);

        $folder->update(['is_published' => true]);

        $this->assertTrue($user->can('view', $folder));
        $this->assertFalse($user->can('upload', $folder));
        $this->actingAs($user)->get(route('documents.manage', $folder))->assertOk();
    }

    public function test_ci3_does_not_define_department_or_subsidiary_level_document_access_restrictions(): void
    {
        [$folder] = $this->folder();
        $user = $this->userWithRole(Role::LEVEL_1);
        DocumentAccess::query()->create([
            'folder_id' => $folder->id,
            'user_id' => $user->id,
            'can_view' => true,
            'can_download' => false,
        ]);

        // CI3's user_allowed_data assigns access to exact users/path records;
        // department/subsidiary membership is not itself an access grant.
        $this->assertTrue($user->can('view', $folder));
    }

    /** @return array{Folder, User} */
    private function folder(): array
    {
        $subsidiary = Subsidiary::query()->create([
            'code' => 'PAR',
            'name' => 'Parity Subsidiary',
            'status' => 'active',
        ]);
        $department = Department::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'code' => 'PAR',
            'name' => 'Parity Department',
            'status' => 'active',
        ]);
        $owner = $this->userWithRole(Role::LEVEL_4);
        $folder = Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => 'Parity Folder',
            'slug' => 'parity-folder-'.$owner->id.'-'.uniqid(),
            'depth' => 0,
            'is_published' => true,
            'created_by' => $owner->id,
        ]);

        return [$folder, $owner];
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $slug)->firstOrFail()->id);
        $user->load('roles');

        return $user;
    }
}
