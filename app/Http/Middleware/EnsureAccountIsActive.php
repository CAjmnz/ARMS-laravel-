<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->account_status !== 'active') {
            $tabId = (string) $request->attributes->get('arms_tab_id', '');
            if ($tabId !== '') {
                DB::table('arms_tab_sessions')->where('tab_id', $tabId)->delete();
                $guard = Auth::guard('web');
                $request->session()->forget($guard->getName());
                Auth::forgetGuards();
            } else {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return redirect()->route('login')->withErrors(['employee_id' => 'This account is unavailable.']);
        }

        return $next($request);
    }
}
