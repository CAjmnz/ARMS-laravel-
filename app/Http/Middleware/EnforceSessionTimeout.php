<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            return redirect()->route('login')->with('status', 'Your session expired due to inactivity.');
        }

        $request->session()->put('arms_last_activity', time());
        return $next($request);
    }
}
