<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class UserPolicy
{
    public function viewRoles(User $user): bool
    {
        return $user->hasPermission('users.manage');
    }

    public function assignRole(User $manager, User $target, Role $role): bool
    {
        if ($manager->is($target) || $role->slug === Role::LEVEL_4) {
            return false;
        }

        if (! in_array($role->slug, Role::FIXED_SLUGS, true)) {
            return false;
        }

        $managerLevel = $manager->roleLevel();
        $targetLevel = $target->roleLevel();

        if ($targetLevel === 4 || $targetLevel >= $managerLevel) {
            return false;
        }

        return $manager->hasPermission('users.manage') && $role->level() < $managerLevel;
    }
}
