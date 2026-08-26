<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserRoleController extends Controller
{
    public function update(
        Request $request,
        User $user,
        RoleAssignmentService $service,
    ): RedirectResponse {
        $validated = $request->validate([
            'role_id' => [
                'required',
                'integer',
                Rule::exists('roles', 'id')->where(
                    fn ($query) => $query
                        ->whereIn('slug', Role::FIXED_SLUGS)
                        ->where('slug', '!=', Role::LEVEL_4),
                ),
            ],
        ]);

        $role = Role::query()->findOrFail($validated['role_id']);
        $service->assign($request->user(), $user, $role);

        return back()->with('success', 'The fixed role was assigned successfully.');
    }
}
