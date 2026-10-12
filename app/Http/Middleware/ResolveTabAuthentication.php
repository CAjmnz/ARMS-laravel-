<?php

namespace App\Http\Middleware;

use App\Models\User;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticate using the current browser tab's identity when a tab ID is present.
 */
class ResolveTabAuthentication extends Authenticate
{
    public function handle($request, \Closure $next, ...$guards): Response
    {
        $tabId = trim((string) (
            $request->header('X-ARMS-Tab-ID')
            ?: $request->query('arms_tab_id', '')
            ?: $this->tabIdFromSameOriginReferer($request)
        ));

        if ($tabId !== '' && strlen($tabId) <= 64 && preg_match('/^[A-Za-z0-9-]+$/', $tabId)) {
            $request->attributes->set('arms_tab_id', $tabId);

            // Clear the shared session identity before resolving this tab's user.
            $guard = Auth::guard('web');
            $request->session()->forget($guard->getName());
            Auth::forgetGuards();
            $guard = Auth::guard('web');

            $tabSession = DB::table('arms_tab_sessions')->where('tab_id', $tabId)->first();
            $user = $tabSession ? User::query()->find($tabSession->user_id) : null;

            if (! $user || $user->account_status !== 'active') {
                DB::table('arms_tab_sessions')->where('tab_id', $tabId)->delete();
            } else {
                $guard->setUser($user);
                $request->setUserResolver(static fn () => $user);
            }
        }

        // Laravel performs its normal auth check only after tab identity is restored.
        return parent::handle($request, $next, ...$guards);
    }

    /**
     * Embedded protected previews (img/iframe) cannot attach Axios headers.
     * Recover the tab ID from the same-origin page that embedded the preview.
     */
    private function tabIdFromSameOriginReferer(Request $request): string
    {
        $referer = (string) $request->headers->get('referer', '');
        if ($referer === '') {
            return '';
        }

        $parts = parse_url($referer);
        if (! is_array($parts) || ! isset($parts['host']) || strcasecmp($parts['host'], $request->getHost()) !== 0) {
            return '';
        }

        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);

        return is_string($query['arms_tab_id'] ?? null) ? $query['arms_tab_id'] : '';
    }
}
