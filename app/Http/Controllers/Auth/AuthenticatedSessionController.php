<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\ActivityLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ArmsLogin', ['status' => session('status')]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        // Resolve the authenticated account from the guard: tab-aware login uses
        // a database-backed tab identity rather than the shared session user.
        $user = Auth::guard('web')->user();
        if (! $user) {
            abort(401, 'Unable to establish the authenticated account for this tab. Please try signing in again.');
        }

        $request->session()->regenerate();
        if ($user->password_must_change) {
            return redirect()->route('password.required');
        }

        $level = $user->roleLevel();
        $tabId = trim((string) $request->header('X-ARMS-Tab-ID', ''));

        if ($tabId !== '' && strlen($tabId) <= 64 && preg_match('/^[A-Za-z0-9-]+$/', $tabId)) {
            // The post-login redirect must carry the tab identity because a
            // redirected Inertia GET is not guaranteed to retain custom headers.
            $destination = in_array($level, [1, 2], true)
                ? route('portal.dashboard', ['arms_tab_id' => $tabId], absolute: false)
                : route('dashboard', ['arms_tab_id' => $tabId], absolute: false);

            return redirect()->to($destination);
        }

        if (in_array($level, [1, 2], true)) {
            return redirect()->intended(route('portal.dashboard', absolute: false));
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        ActivityLog::query()->create(['user_id' => $request->user()?->id, 'event' => 'auth.logout', 'description' => 'User signed out.', 'ip_address' => $request->ip(), 'user_agent' => $request->userAgent()]);
        $tabId = (string) $request->attributes->get('arms_tab_id', '');
        if ($tabId !== '') {
            // Sign out this tab only; do not invalidate the shared browser session.
            DB::table('arms_tab_sessions')->where('tab_id', $tabId)->delete();
            $guard = Auth::guard('web');
            $request->session()->forget($guard->getName());

            return redirect('/');
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
