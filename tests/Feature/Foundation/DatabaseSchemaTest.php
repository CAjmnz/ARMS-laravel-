<?php

namespace Tests\Feature\Foundation;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_normalized_foundation_tables_exist(): void
    {
        foreach ([
            'subsidiaries', 'departments', 'users', 'roles', 'permissions', 'role_user',
            'permission_role', 'folders', 'documents', 'document_versions', 'document_access',
            'file_types', 'activity_logs', 'system_settings',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table: {$table}");
        }
    }

    public function test_fixed_legacy_subfolder_tables_are_not_created(): void
    {
        foreach (range(1, 10) as $level) {
            $this->assertFalse(Schema::hasTable("subfolder{$level}"));
        }
    }

    public function test_foundation_seeders_create_the_approved_roles(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseHas('roles', ['slug' => 'super-administrator']);
        $this->assertDatabaseHas('roles', ['slug' => 'administrator']);
        $this->assertDatabaseHas('roles', ['slug' => 'records-officer']);
        $this->assertDatabaseHas('roles', ['slug' => 'viewer']);
    }
}
