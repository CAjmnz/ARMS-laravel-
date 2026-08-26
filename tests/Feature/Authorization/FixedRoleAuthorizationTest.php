<?php

namespace Tests\Feature\Authorization;

use App\Models\Document;
use App\Models\DocumentAccess;
use App\Models\Department;
use App\Models\Folder;
use App\Models\Role;
use App\Models\Subsidiary;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FixedRoleAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_exactly_four_fixed_roles_are_seeded_with_approved_names(): void
    {
        $this->assertSame(4, Role::query()->count());
        $this->assertSame([
            'Level 4 — Super User',
            'Level 3 — Administrator',
            'Level 2 — View and Download',
            'Level 1 — View Only',
        ], Role::query()->get()->sortByDesc(fn (Role $role) => $role->level())->pluck('name')->values()->all());
    }

    public function test_allowed_upload_is_a_user_setting_not_a_fifth_role(): void
    {
        $user = $this->userWithRole(Role::LEVEL_2);
        $user->update(['allowed_upload' => true]);

        $this->assertTrue($user->fresh()->allowed_upload);
        $this->assertSame(4, Role::query()->count());
        $this->assertFalse($user->fresh()->hasPermission('documents.upload'));
    }

    public function test_only_level_four_can_delete_documents(): void
    {
        $document = new Document();

        foreach (Role::query()->get() as $role) {
            $user = $this->userWithRole($role->slug);
            $this->assertSame($role->slug === Role::LEVEL_4, $user->can('delete', $document));
        }
    }

    public function test_levels_one_and_two_are_limited_to_assigned_documents(): void
    {
        $subsidiary = Subsidiary::query()->create(['code' => 'HO', 'name' => 'Head Office', 'status' => 'active']);
        $department = Department::query()->create(['subsidiary_id' => $subsidiary->id, 'code' => 'RMS', 'name' => 'Records', 'status' => 'active']);
        $folder = Folder::query()->create(['subsidiary_id' => $subsidiary->id, 'department_id' => $department->id, 'name' => 'Assigned', 'slug' => 'assigned']);
        $document = Document::query()->create(['folder_id' => $folder->id, 'title' => 'Assigned Document']);
        $levelOne = $this->userWithRole(Role::LEVEL_1);
        $levelTwo = $this->userWithRole(Role::LEVEL_2);

        $this->assertFalse($levelOne->can('view', $document));
        $this->assertFalse($levelTwo->can('download', $document));

        DocumentAccess::query()->create(['document_id' => $document->id, 'user_id' => $levelOne->id, 'can_view' => true]);
        DocumentAccess::query()->create(['document_id' => $document->id, 'user_id' => $levelTwo->id, 'can_view' => true, 'can_download' => true]);

        $this->assertTrue($levelOne->can('view', $document));
        $this->assertFalse($levelOne->can('download', $document));
        $this->assertTrue($levelTwo->can('view', $document));
        $this->assertTrue($levelTwo->can('download', $document));
    }

    public function test_level_four_can_assign_a_lower_fixed_role(): void
    {
        $manager = $this->userWithRole(Role::LEVEL_4);
        $target = $this->userWithRole(Role::LEVEL_1);
        $administrator = Role::query()->where('slug', Role::LEVEL_3)->firstOrFail();

        $this->actingAs($manager)
            ->patch(route('users.role.update', $target), ['role_id' => $administrator->id])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertTrue($target->fresh()->hasRole(Role::LEVEL_3));
        $this->assertSame(1, $target->fresh()->roles()->count());
    }

    public function test_level_four_cannot_be_assigned_through_normal_user_management(): void
    {
        $manager = $this->userWithRole(Role::LEVEL_4);
        $target = $this->userWithRole(Role::LEVEL_1);
        $levelFour = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();

        $this->actingAs($manager)
            ->patch(route('users.role.update', $target), ['role_id' => $levelFour->id])
            ->assertSessionHasErrors('role_id');

        $this->assertTrue($target->fresh()->hasRole(Role::LEVEL_1));
    }

    public function test_level_three_can_assign_only_lower_roles(): void
    {
        $manager = $this->userWithRole(Role::LEVEL_3);
        $target = $this->userWithRole(Role::LEVEL_1);
        $levelTwo = Role::query()->where('slug', Role::LEVEL_2)->firstOrFail();

        $this->actingAs($manager)
            ->patch(route('users.role.update', $target), ['role_id' => $levelTwo->id])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertTrue($target->fresh()->hasRole(Role::LEVEL_2));
    }

    public function test_level_three_cannot_manage_peer_self_or_level_four(): void
    {
        $manager = $this->userWithRole(Role::LEVEL_3);
        $peer = $this->userWithRole(Role::LEVEL_3);
        $superUser = $this->userWithRole(Role::LEVEL_4);
        $levelOne = Role::query()->where('slug', Role::LEVEL_1)->firstOrFail();

        foreach ([$manager, $peer, $superUser] as $target) {
            $this->actingAs($manager)
                ->patch(route('users.role.update', $target), ['role_id' => $levelOne->id])
                ->assertForbidden();
        }
    }

    public function test_lower_roles_cannot_open_role_reference_or_forge_assignment(): void
    {
        foreach ([Role::LEVEL_2, Role::LEVEL_1] as $slug) {
            $user = $this->userWithRole($slug);
            $target = $this->userWithRole(Role::LEVEL_1);
            $role = Role::query()->where('slug', Role::LEVEL_2)->firstOrFail();

            $this->actingAs($user)->get(route('roles.index'))->assertForbidden();
            $this->actingAs($user)
                ->patch(route('users.role.update', $target), ['role_id' => $role->id])
                ->assertForbidden();
        }
    }

    public function test_no_custom_role_management_routes_exist(): void
    {
        $this->assertFalse(app('router')->has('roles.create'));
        $this->assertFalse(app('router')->has('roles.store'));
        $this->assertFalse(app('router')->has('roles.update'));
        $this->assertFalse(app('router')->has('roles.destroy'));
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $slug)->firstOrFail());

        return $user;
    }
}
