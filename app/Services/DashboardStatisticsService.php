<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class DashboardStatisticsService
{
    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $now = CarbonImmutable::now();
        $status = $this->documentStatus();

        return [
            'greeting' => $this->greeting($now),
            'lastLoginAt' => $user->last_login_at?->toIso8601String(),
            'summary' => [
                'pending' => $status['unpublished'],
                'documents' => Document::query()->count(),
                'users' => User::query()->count(),
                'online' => $this->activeSessionCount($now),
            ],
            'documentStatus' => $status,
            'activity' => $this->activity($now),
            'account' => [
                'name' => $user->name,
                'employeeId' => $user->employee_id,
                'position' => $user->position,
                'subsidiary' => $user->subsidiary?->name,
                'department' => $user->department?->name,
                'lastLoginAt' => $user->last_login_at?->toIso8601String(),
            ],
        ];
    }

    /**
     * @return array{published: int, unpublished: int, total: int, publishedPercentage: float, unpublishedPercentage: float}
     */
    private function documentStatus(): array
    {
        $published = Folder::query()->where('is_published', true)->count();
        $unpublished = Folder::query()->where('is_published', false)->count();
        $total = $published + $unpublished;

        return [
            'published' => $published,
            'unpublished' => $unpublished,
            'total' => $total,
            'publishedPercentage' => $total === 0
                ? 0
                : round(($published / $total) * 100, 1),
            'unpublishedPercentage' => $total === 0
                ? 0
                : round(($unpublished / $total) * 100, 1),
        ];
    }

    /**
     * @return array<int, array{label: string, uploads: int, cumulative: int}>
     */
    private function activity(CarbonImmutable $now): array
    {
        $start = $now->startOfMonth()->subMonths(5);
        $monthExpression = match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', created_at)",
            'pgsql' => "to_char(created_at, 'YYYY-MM')",
            default => "DATE_FORMAT(created_at, '%Y-%m')",
        };

        $counts = Document::query()
            ->where('created_at', '>=', $start)
            ->selectRaw("{$monthExpression} as month_key")
            ->selectRaw('COUNT(*) as aggregate')
            ->groupByRaw($monthExpression)
            ->get()
            ->keyBy('month_key');

        $cumulative = Document::query()
            ->where('created_at', '<', $start)
            ->count();

        return collect(range(0, 5))
            ->map(function (int $offset) use ($start, $counts, &$cumulative): array {
                $month = $start->addMonths($offset);
                $uploads = (int) ($counts->get($month->format('Y-m'))->aggregate ?? 0);
                $cumulative += $uploads;

                return [
                    'label' => $month->format('M Y'),
                    'uploads' => $uploads,
                    'cumulative' => $cumulative,
                ];
            })
            ->all();
    }

    private function activeSessionCount(CarbonImmutable $now): int
    {
        return DB::table('sessions')
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', $now->subMinutes(15)->timestamp)
            ->distinct()
            ->count('user_id');
    }

    private function greeting(CarbonImmutable $now): string
    {
        return match (true) {
            $now->hour < 12 => 'Good morning',
            $now->hour < 18 => 'Good afternoon',
            default => 'Good evening',
        };
    }
}
