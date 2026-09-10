<?php

namespace Tests\Feature\Foundation;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Services\DatabaseBackupService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_user_can_download_database_backup(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        $response = $this->actingAs($user)->post(route('system.backup.database'));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/sql; charset=UTF-8');
        $this->assertMatchesRegularExpression(
            '/attachment; filename=RMS-database-\d{4}-\d{2}-\d{2}-\d{6}\.sql/',
            (string) $response->headers->get('content-disposition'),
        );
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.database_created',
        ]);
    }

    public function test_user_without_backup_permission_receives_forbidden(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_3)->firstOrFail();
        $user->roles()->attach($role->id);

        $this->actingAs($user)
            ->post(route('system.backup.database'))
            ->assertForbidden();

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.database_created',
        ]);
    }

    public function test_generated_backup_contains_schema_and_data(): void
    {
        $this->seed(RolePermissionSeeder::class);
        User::factory()->create(['name' => 'Backup Sample User']);

        $path = app(DatabaseBackupService::class)->create();

        try {
            $contents = file_get_contents($path);

            $this->assertIsString($contents);
            $this->assertStringContainsString('CREATE TABLE', $contents);
            $this->assertStringContainsString('INSERT INTO', $contents);
            $this->assertStringContainsString('Backup Sample User', $contents);
        } finally {
            @unlink($path);
        }
    }

    public function test_backup_generation_failure_returns_useful_error(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        $service = Mockery::mock(DatabaseBackupService::class);
        $service->shouldReceive('create')->once()->andThrow(new RuntimeException('Simulated failure'));
        $this->app->instance(DatabaseBackupService::class, $service);

        $this->actingAs($user)
            ->postJson(route('system.backup.database'))
            ->assertStatus(500)
            ->assertJson([
                'message' => 'The database backup could not be generated. Please try again or contact the system administrator.',
            ]);

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.database_created',
        ]);
    }
}
