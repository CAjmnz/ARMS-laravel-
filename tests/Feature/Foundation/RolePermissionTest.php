<?php

namespace Tests\Feature\Foundation;

use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_administrator_can_delete_documents(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $superAdministrator = Role::query()->where('slug', 'super-administrator')->firstOrFail();
        $administrator = Role::query()->where('slug', 'administrator')->firstOrFail();

        $this->assertTrue($superAdministrator->permissions()->where('slug', 'documents.delete')->exists());
        $this->assertFalse($administrator->permissions()->where('slug', 'documents.delete')->exists());
    }

    public function test_viewer_has_view_permission_but_not_download_permission(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $viewer = Role::query()->where('slug', Role::LEVEL_1)->firstOrFail();

        $this->assertTrue($viewer->permissions()->where('slug', 'documents.view')->exists());
        $this->assertFalse($viewer->permissions()->where('slug', 'documents.download')->exists());
    }
}
