<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['Dashboard', 'dashboard.view', 'dashboard'],
            ['View documents', 'documents.view', 'documents'],
            ['Download documents', 'documents.download', 'documents'],
            ['Upload documents', 'documents.upload', 'documents'],
            ['Create and manage folders', 'folders.manage', 'documents'],
            ['Rename documents', 'documents.rename', 'documents'],
            ['Transfer documents', 'documents.transfer', 'documents'],
            ['Delete documents', 'documents.delete', 'documents'],
            ['Manage document access', 'documents.access.manage', 'documents'],
            ['Manage subsidiaries', 'subsidiaries.manage', 'organization'],
            ['Manage departments', 'departments.manage', 'organization'],
            ['Manage users', 'users.manage', 'users'],
            ['View activity logs', 'activity-logs.view', 'audit'],
            ['Manage system settings', 'system-settings.manage', 'system'],
            ['Manage backups', 'backups.manage', 'system'],
            ['Manage receiving records', 'receiving.manage', 'records'],
            ['Manage scanning and keepsafe requests', 'scanning-keepsafe.manage', 'records'],
        ];

        foreach ($permissions as [$name, $slug, $group]) {
            Permission::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'group' => $group],
            );
        }

        $roles = [
            'super-administrator' => ['Level 4 — Super User', Permission::query()->pluck('slug')->all()],
            'administrator' => [
                'Level 3 — Administrator',
                [
                    'dashboard.view',
                    'documents.view',
                    'documents.download',
                    'documents.upload',
                    'folders.manage',
                    'documents.rename',
                    'documents.transfer',
                    'documents.access.manage',
                    'users.manage',
                    'receiving.manage',
                    'scanning-keepsafe.manage',
                ],
            ],
            'records-officer' => [
                'Level 2 — View and Download',
                ['dashboard.view', 'documents.view', 'documents.download'],
            ],
            'viewer' => ['Level 1 — View Only', ['dashboard.view', 'documents.view']],
        ];

        foreach ($roles as $slug => [$name, $permissionSlugs]) {
            $role = Role::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'is_system' => true],
            );

            $role->permissions()->sync(
                Permission::query()->whereIn('slug', $permissionSlugs)->pluck('id'),
            );
        }
    }
}
