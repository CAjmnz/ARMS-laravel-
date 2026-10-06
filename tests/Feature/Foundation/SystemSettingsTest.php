<?php

namespace Tests\Feature\Foundation;

use App\Models\FileType;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_administrator_can_bulk_enable_and_disable_file_types(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = $this->superAdministrator();
        $first = FileType::query()->create(['extension' => 'one', 'mime_types' => [], 'maximum_size_kb' => 1024, 'is_previewable' => true, 'is_active' => true]);
        $second = FileType::query()->create(['extension' => 'two', 'mime_types' => [], 'maximum_size_kb' => 1024, 'is_previewable' => true, 'is_active' => true]);

        $this->actingAs($user)->patch(route('system.file-types.bulk-toggle'), [
            'file_type_ids' => [$first->id, $second->id],
            'is_active' => false,
        ])->assertRedirect();

        $this->assertDatabaseHas('file_types', ['id' => $first->id, 'is_active' => 0]);
        $this->assertDatabaseHas('file_types', ['id' => $second->id, 'is_active' => 0]);

        $this->actingAs($user)->patch(route('system.file-types.bulk-toggle'), [
            'file_type_ids' => [$first->id, $second->id],
            'is_active' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('file_types', ['id' => $first->id, 'is_active' => 1]);
        $this->assertDatabaseHas('file_types', ['id' => $second->id, 'is_active' => 1]);
    }

    public function test_super_administrator_can_bulk_delete_file_types(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = $this->superAdministrator();
        $first = FileType::query()->create(['extension' => 'one', 'mime_types' => [], 'maximum_size_kb' => 1024, 'is_previewable' => true, 'is_active' => true]);
        $second = FileType::query()->create(['extension' => 'two', 'mime_types' => [], 'maximum_size_kb' => 1024, 'is_previewable' => true, 'is_active' => true]);

        $this->actingAs($user)->delete(route('system.file-types.bulk-delete'), [
            'file_type_ids' => [$first->id, $second->id],
        ])->assertRedirect();

        $this->assertDatabaseMissing('file_types', ['id' => $first->id]);
        $this->assertDatabaseMissing('file_types', ['id' => $second->id]);
    }

    public function test_level_three_administrator_cannot_manage_system_settings_or_backups(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_3)->firstOrFail();
        $user->roles()->attach($role->id);

        $this->actingAs($user)->get(route('system.index'))->assertForbidden();
        $this->actingAs($user)->patch(route('system.file-types.bulk-toggle'), [
            'file_type_ids' => [1],
            'is_active' => false,
        ])->assertForbidden();
        $this->actingAs($user)->post(route('system.backup.database'))->assertForbidden();
    }

    private function superAdministrator(): User
    {
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        return $user;
    }
}
