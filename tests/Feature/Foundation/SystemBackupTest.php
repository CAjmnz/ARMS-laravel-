<?php

namespace Tests\Feature\Foundation;

use App\Models\Role;
use App\Models\User;
use App\Services\DatabaseBackupService;
use App\Services\SystemBackupService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use RuntimeException;
use Tests\TestCase;
use ZipArchive;

class SystemBackupTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_user_can_download_system_and_database_backup(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        $service = Mockery::mock(SystemBackupService::class);
        $service->shouldReceive('create')->once()->andReturnUsing(function (): string {
            $path = tempnam(sys_get_temp_dir(), 'rms-test-system-');
            $zip = new ZipArchive();
            $zip->open($path, ZipArchive::OVERWRITE);
            $zip->addFromString('database/rms-database.sql', '-- test backup');
            $zip->close();
            return $path;
        });
        $this->app->instance(SystemBackupService::class, $service);

        $response = $this->actingAs($user)->post(route('system.backup.system-database'));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/zip');
        $this->assertMatchesRegularExpression(
            '/attachment; filename=RMS-system-database-\d{4}-\d{2}-\d{2}-\d{6}\.zip/',
            (string) $response->headers->get('content-disposition'),
        );
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.system_database_created',
        ]);
    }

    public function test_user_without_backup_permission_receives_forbidden_for_system_backup(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_3)->firstOrFail();
        $user->roles()->attach($role->id);

        $this->actingAs($user)
            ->post(route('system.backup.system-database'))
            ->assertForbidden();

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.system_database_created',
        ]);
    }

    public function test_system_backup_contains_database_application_and_document_storage_without_secrets(): void
    {
        $temporaryStorage = sys_get_temp_dir().DIRECTORY_SEPARATOR.'rms-storage-test-'.uniqid('', true);
        $this->app->useStoragePath($temporaryStorage);

        $documentDirectory = storage_path('app/private/documents');
        if (! is_dir($documentDirectory)) {
            mkdir($documentDirectory, 0777, true);
        }
        $documentPath = $documentDirectory.DIRECTORY_SEPARATOR.'system-backup-test.txt';
        file_put_contents($documentPath, 'RMS backup storage test');

        $databaseService = Mockery::mock(DatabaseBackupService::class);
        $databaseService->shouldReceive('create')->once()->andReturnUsing(function (): string {
            $path = tempnam(sys_get_temp_dir(), 'rms-test-db-');
            file_put_contents($path, "-- test SQL backup\nCREATE TABLE backup_test (id INTEGER);\n");
            return $path;
        });

        $service = new SystemBackupService($databaseService);
        $path = $service->create();

        try {
            $zip = new ZipArchive();
            $this->assertTrue($zip->open($path, ZipArchive::CHECKCONS) === true);

            $this->assertNotFalse($zip->locateName('database/rms-database.sql'));
            $this->assertNotFalse($zip->locateName('app/Http/Controllers/DatabaseBackupController.php'));
            $this->assertNotFalse($zip->locateName('storage/app/private/documents/system-backup-test.txt'));
            $this->assertNotFalse($zip->locateName('BACKUP-INFO.txt'));

            $this->assertFalse($zip->locateName('.env'));
            $this->assertFalse($zip->locateName('application/.env'));
            $this->assertFalse($zip->locateName('vendor/autoload.php'));
            $this->assertFalse($zip->locateName('node_modules'));
            $this->assertFalse($zip->locateName('storage/logs/laravel.log'));

            $databaseSql = $zip->getFromName('database/rms-database.sql');
            $this->assertIsString($databaseSql);
            $this->assertStringContainsString('CREATE TABLE backup_test', $databaseSql);

            $zip->close();
        } finally {
            @unlink($path);
            @unlink($documentPath);
            @rmdir($documentDirectory);
            @rmdir(dirname($documentDirectory));
            @rmdir(dirname(dirname($documentDirectory)));
            @rmdir($temporaryStorage);
        }
    }

    public function test_system_backup_generation_failure_returns_useful_error(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->where('slug', Role::LEVEL_4)->firstOrFail();
        $user->roles()->attach($role->id);

        $service = Mockery::mock(SystemBackupService::class);
        $service->shouldReceive('create')->once()->andThrow(new RuntimeException('Simulated ZIP failure'));
        $this->app->instance(SystemBackupService::class, $service);

        $this->actingAs($user)
            ->postJson(route('system.backup.system-database'))
            ->assertStatus(500)
            ->assertJson([
                'message' => 'The system and database backup could not be generated. Please try again or contact the system administrator.',
            ]);

        $this->assertDatabaseMissing('activity_logs', [
            'user_id' => $user->id,
            'event' => 'backup.system_database_created',
        ]);
    }
}
