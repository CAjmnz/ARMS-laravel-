<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class DashboardStatisticsService
{
    public function __construct(private PinnedItemsService $pins)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $now = CarbonImmutable::now();

        return [
            'greeting' => $this->greeting($now),
            'lastLoginAt' => $user->last_login_at?->toIso8601String(),
            'summary' => [
                'documents' => Document::query()->count(),
                'folders' => Folder::query()->count(),
                'pending' => Folder::query()->where('is_published', false)->count(),
                'users' => User::query()->count(),
                'online' => $this->activeSessionCount($now),
            ],
            'activity' => $this->activity($now),
            'recentActivities' => $this->recentActivities(),
            'pinnedItems' => $this->pins->top($user, 3)->values(),
            'topCategories' => $this->topCategories(),
            'storageBytes' => (int) DB::table('document_versions')->sum('size_bytes'),
            'memberRoles' => $this->memberRoles(),
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

    /** @return array<int, array{id:int,actor:string,description:string,event:string,occurredAt:?string}> */
    private function recentActivities(): array
    {
        return ActivityLog::query()
            ->leftJoin('users', 'users.id', '=', 'activity_logs.user_id')
            ->select([
                'activity_logs.id',
                'activity_logs.event',
                'activity_logs.description',
                'activity_logs.created_at',
                'users.name as actor_name',
                'users.employee_id as actor_employee_id',
            ])
            ->latest('activity_logs.created_at')
            ->limit(6)
            ->get()
            ->map(fn ($log) => [
                'id' => (int) $log->id,
                'actor' => $log->actor_name ?: ($log->actor_employee_id ?: 'System'),
                'description' => $log->description ?: str_replace('.', ' ', ucfirst((string) $log->event)),
                'event' => (string) $log->event,
                'occurredAt' => $log->created_at ? CarbonImmutable::parse($log->created_at)->toIso8601String() : null,
            ])
            ->all();
    }

    /** @return array<int, array{id:int,name:string,count:int}> */
    private function topCategories(): array
    {
        return Folder::query()
            ->withCount('documents')
            ->orderByDesc('documents_count')
            ->limit(5)
            ->get(['id', 'name'])
            ->map(fn (Folder $folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'count' => (int) $folder->documents_count,
            ])
            ->all();
    }

    /** @return array<int, array{name:string,count:int}> */
    private function memberRoles(): array
    {
        return DB::table('roles')
            ->leftJoin('role_user', 'roles.id', '=', 'role_user.role_id')
            ->select('roles.name')
            ->selectRaw('COUNT(role_user.user_id) as aggregate')
            ->groupBy('roles.id', 'roles.name')
            ->orderBy('roles.id')
            ->get()
            ->map(fn ($role) => [
                'name' => (string) $role->name,
                'count' => (int) $role->aggregate,
            ])
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
