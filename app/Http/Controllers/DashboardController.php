<?php

namespace App\Http\Controllers;

use App\Services\DashboardStatisticsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        DashboardStatisticsService $statistics,
    ): Response {
        $user = $request->user()->loadMissing([
            'department:id,name',
            'subsidiary:id,name',
        ]);

        return Inertia::render('Dashboard', $statistics->for($user));
    }
}
