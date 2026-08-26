<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Models\ActivityLog;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class RoleAssignmentService
{
    /** @throws AuthorizationException */
    public function assign(User $manager, User $target, Role $role): void
    {
        if (! $manager->can('assignRole', [$target, $role])) {
            throw new AuthorizationException('The selected role cannot be assigned to this user.');
        }

        DB::transaction(function () use ($manager, $target, $role): void {
            $previousRoles = $target->roles()->pluck('slug')->values()->all();

            $target->roles()->sync([
                $role->id => ['assigned_by' => $manager->id],
            ]);

            ActivityLog::query()->create([
                'user_id' => $manager->id,
                'event' => 'user.role-assigned',
                'auditable_type' => User::class,
                'auditable_id' => $target->id,
                'description' => 'A fixed ARMS role was assigned.',
                'old_values' => ['roles' => $previousRoles],
                'new_values' => ['roles' => [$role->slug]],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        });
    }
}
