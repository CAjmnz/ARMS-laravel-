<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->password_must_change && ! $request->routeIs('password.required*', 'logout')) {
            return redirect()->route('password.required');
        }

        return $next($request);
    }
}
