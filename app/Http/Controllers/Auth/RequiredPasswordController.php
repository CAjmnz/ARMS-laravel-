<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RequiredPasswordController extends Controller
{
    public function edit(Request $request): Response|RedirectResponse
    {
        return $request->user()->password_must_change
            ? Inertia::render('Auth/ChangeRequiredPassword')
            : redirect()->route('dashboard');
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols(), 'different:current_password'],
        ]);

        $request->user()->forceFill([
            'password' => Hash::make($validated['password']),
            'password_must_change' => false,
            'password_changed_at' => now(),
        ])->save();

        ActivityLog::query()->create(['user_id' => $request->user()->id, 'event' => 'auth.password_changed', 'description' => 'Required password change completed.', 'ip_address' => $request->ip(), 'user_agent' => $request->userAgent()]);
        $request->session()->regenerate();

        return redirect()->route('dashboard');
    }
}
