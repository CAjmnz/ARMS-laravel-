<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnforceSessionTimeout
{
    public function handle(Request $request, Closure $next): Response
    {
        // A tab has no database-backed session until its first successful login.
        // Do not let the timeout middleware redirect the login GET/POST before
        // LoginRequest can validate credentials and create that tab session.
        if ($request->is('login')) {
            return $next($request);
        }

        $tabId = (string) $request->attributes->get('arms_tab_id', '');

        if ($tabId !== '') {
            $tabSession = DB::table('arms_tab_sessions')->where('tab_id', $tabId)->first();
            $lastActivity = $tabSession ? strtotime((string) $tabSession->last_activity) : 0;

            if (! $tabSession || time() - $lastActivity > 1800) {
                DB::table('arms_tab_sessions')->where('tab_id', $tabId)->delete();
                $guard = Auth::guard('web');
                $request->session()->forget($guard->getName());
                Auth::forgetGuards();
                $request->session()->flash('status', 'Your session expired due to inactivity.');

                if ($request->header('X-Inertia')) {
                    return Inertia::location(route('login'));
                }

                return redirect()->route('login');
            }

            DB::table('arms_tab_sessions')->where('tab_id', $tabId)->update([
                'last_activity' => now(),
                'updated_at' => now(),
            ]);

            return $next($request);
        }

        // Keep the existing timeout behavior for non-tab-aware clients.
        $lastActivity = (int) $request->session()->get('arms_last_activity', time());
        if (time() - $lastActivity > 1800) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $request->session()->flash('status', 'Your session expired due to inactivity.');

            if ($request->header('X-Inertia')) {
                return Inertia::location(route('login'));
            }

            return redirect()->route('login');
        }

        $request->session()->put('arms_last_activity', time());
        return $next($request);
    }
}
