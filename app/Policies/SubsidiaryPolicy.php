<?php

namespace App\Policies;

use App\Models\Subsidiary;
use App\Models\User;

class SubsidiaryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperUser();
    }

    public function create(User $user): bool
    {
        return $user->isSuperUser();
    }

    public function update(User $user, Subsidiary $subsidiary): bool
    {
        return $user->isSuperUser();
    }

    public function delete(User $user, Subsidiary $subsidiary): bool
    {
        return $user->isSuperUser();
    }
}
