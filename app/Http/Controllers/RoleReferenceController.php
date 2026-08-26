<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoleReferenceController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewRoles', \App\Models\User::class);

        $roles = Role::query()
            ->whereIn('slug', Role::FIXED_SLUGS)
            ->withCount('users')
            ->with(['permissions:id,name,slug,group'])
            ->get()
            ->sortByDesc(fn (Role $role) => $role->level())
            ->values()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'level' => $role->level(),
                'users_count' => $role->users_count,
                'permissions' => $role->permissions->pluck('slug')->values(),
            ]);

        return Inertia::render('Administration/Roles/Index', [
            'roles' => $roles,
        ]);
    }
}
