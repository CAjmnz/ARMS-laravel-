<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user()->loadMissing(['subsidiary', 'department', 'roles']);
        $component = in_array($user->roleLevel(), [1, 2], true) ? 'Portal/Profile' : 'Profile/Edit';

        return Inertia::render($component, [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            'profile' => [
                'employee_id' => $user->employee_id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_path ? Storage::disk('public')->url($user->avatar_path) : null,
                'position' => $user->position,
                'subsidiary' => $user->subsidiary?->name,
                'department' => $user->department?->name,
                'account_status' => $user->account_status,
                'role' => $user->roles->sortByDesc(fn ($role) => $role->level())->first()?->name,
                'member_since' => optional($user->created_at)->toIso8601String(),
                'last_login_at' => optional($user->last_login_at)->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->safe()->except(['avatar']);

        if ($request->hasFile('avatar')) {
            $newAvatarPath = $request->file('avatar')->store('profile-avatars', 'public');
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->avatar_path = $newAvatarPath;
        }

        $user->fill($validated);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return Redirect::route('profile.edit')->with('success', 'Profile information updated successfully.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
