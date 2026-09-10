<?php

namespace App\Http\Controllers;

use App\Services\DashboardStatisticsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        DashboardStatisticsService $statistics,
    ): Response|RedirectResponse {
        $user = $request->user()->loadMissing([
            'department:id,name',
            'subsidiary:id,name',
        ]);

        if (in_array($user->roleLevel(), [1, 2], true)) {
            return redirect()->route('portal.dashboard');
        }

        return Inertia::render('Dashboard', $statistics->for($user));
    }
}
