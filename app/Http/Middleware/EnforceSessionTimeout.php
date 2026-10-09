<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnforceSessionTimeout
{
    public function handle(Request $request, Closure $next): Response
    {
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
