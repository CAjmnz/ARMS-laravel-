<?php

namespace Tests\Feature\Documents;

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use App\Services\FolderHierarchyService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentInformationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_folder_information_contains_descendant_activity_with_exact_path(): void
    {
        [$root, $actor] = $this->root();
        $hierarchy = app(FolderHierarchyService::class);
        $icm = $hierarchy->createChild($root, 'ICM', $actor, []);
        $year = $hierarchy->createChild($icm, '2025', $actor, []);

        $response = $this->actingAs($actor)->getJson(route('documents.folders.information', $root));
        $response->assertOk();
        $activity = collect($response->json('activity'));

        $this->assertTrue($activity->contains(fn ($item) => $item['event'] === 'folder.created' && $item['item_name'] === 'ICM'));
        $this->assertTrue($activity->contains(fn ($item) => $item['event'] === 'folder.created' && $item['item_name'] === '2025' && $item['path'] === [$root->name, 'ICM', '2025']));
        $this->assertDatabaseHas('activity_logs', ['auditable_type' => Folder::class, 'auditable_id' => $year->id, 'event' => 'folder.created']);
    }

    public function test_information_is_exposed_in_normal_and_pinned_search_payloads(): void
    {
        [$root, $actor] = $this->root();
        $document = Document::query()->create(['folder_id' => $root->id, 'title' => 'Audit Report', 'created_by' => $actor->id]);
        $this->actingAs($actor)->patch(route('documents.pin', $document))->assertRedirect();

        $this->actingAs($actor)->get(route('documents.manage', $root))->assertOk()->assertSee('Documents', false);
        $this->actingAs($actor)->get(route('documents.manage', ['search' => 'pin audit']))->assertOk();
        $this->assertDatabaseHas('activity_logs', ['auditable_type' => Document::class, 'auditable_id' => $document->id, 'event' => 'pin.created']);
    }

    public function test_admin_can_search_and_grant_then_remove_direct_folder_access(): void
    {
        [$root, $admin] = $this->root();
        $target = User::factory()->create(['name' => 'Jane Smith', 'employee_id' => 'E-200']);
        $viewerRole = Role::query()->where('slug', Role::LEVEL_2)->firstOrFail();
        $target->roles()->attach($viewerRole->id);

        $this->actingAs($admin)->getJson(route('documents.access.users', ['search' => 'Jane']))
            ->assertOk()
            ->assertJsonFragment(['name' => 'Jane Smith']);

        $this->actingAs($admin)->postJson(route('documents.folders.access.grant', $root), ['user_id' => $target->id])->assertOk();
        $this->assertDatabaseHas('document_access', ['folder_id' => $root->id, 'user_id' => $target->id, 'can_view' => 1]);
        $this->assertDatabaseHas('activity_logs', ['auditable_type' => Folder::class, 'auditable_id' => $root->id, 'event' => 'access.granted']);

        $this->actingAs($admin)->deleteJson(route('documents.folders.access.remove', [$root, $target]))->assertOk();
        $this->assertDatabaseMissing('document_access', ['folder_id' => $root->id, 'user_id' => $target->id]);
        $this->assertDatabaseHas('activity_logs', ['auditable_type' => Folder::class, 'auditable_id' => $root->id, 'event' => 'access.removed']);
    }

    public function test_unauthorized_user_cannot_manage_access_or_read_hidden_information(): void
    {
        [$root, $admin] = $this->root();
        $outsider = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_1)->firstOrFail();
        $outsider->roles()->attach($role->id);

        $this->actingAs($outsider)->getJson(route('documents.access.users', ['search' => 'x']))->assertForbidden();
        $this->actingAs($outsider)->getJson(route('documents.folders.information', $root))->assertForbidden();
    }

    /** @return array{Folder,User} */
    private function root(): array
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'HO', 'name' => 'Head Office', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'RMS', 'name' => 'Records', 'status' => 'active']);
        $admin = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $admin->roles()->attach($role->id);
        $admin->load('roles');
        $root = Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => 'Reports',
            'slug' => 'reports',
            'depth' => 0,
            'is_published' => true,
            'created_by' => $admin->id,
        ]);

        return [$root, $admin];
    }
}
