<?php

namespace Tests\Feature\Dashboard;

use App\Models\Department;
use App\Models\Document;
use App\Models\Folder;
use App\Models\Subsidiary;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_active_user_can_view_real_dashboard_totals(): void
    {
        $user = User::factory()->create();
        [$subsidiary, $department] = $this->organization();

        $published = $this->folder(
            $user,
            $subsidiary,
            $department,
            'Published Records',
            true,
        );
        $this->folder(
            $user,
            $subsidiary,
            $department,
            'Pending Records',
            false,
        );

        Document::query()->create([
            'folder_id' => $published->id,
            'title' => 'Annual Report',
            'status' => 'active',
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('summary.documents', 1)
                ->where('summary.folders', 2)
                ->where('summary.pending', 1)
                ->where('summary.users', 1)
                ->has('activity', 6)
                ->has('recentActivities')
                ->has('topCategories')
                ->has('memberRoles'));
    }

    public function test_activity_contains_six_months_in_chronological_order(): void
    {
        CarbonImmutable::setTestNow('2026-08-26 09:00:00');

        $user = User::factory()->create();
        [$subsidiary, $department] = $this->organization();
        $folder = $this->folder(
            $user,
            $subsidiary,
            $department,
            'Monthly Records',
            true,
        );

        $document = Document::query()->create([
            'folder_id' => $folder->id,
            'title' => 'April Report',
            'status' => 'active',
            'created_by' => $user->id,
        ]);
        $document->forceFill([
            'created_at' => CarbonImmutable::parse('2026-04-10 08:00:00'),
            'updated_at' => CarbonImmutable::parse('2026-04-10 08:00:00'),
        ])->saveQuietly();

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activity.0.label', 'Mar 2026')
                ->where('activity.1.label', 'Apr 2026')
                ->where('activity.1.uploads', 1)
                ->where('activity.5.label', 'Aug 2026'));
    }

    /**
     * @return array{Subsidiary, Department}
     */
    private function organization(): array
    {
        $subsidiary = Subsidiary::query()->create([
            'code' => 'AGC',
            'name' => 'Alturas Group',
            'status' => 'active',
        ]);
        $department = Department::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'code' => 'IT',
            'name' => 'Information Technology',
            'status' => 'active',
        ]);

        return [$subsidiary, $department];
    }

    private function folder(
        User $user,
        Subsidiary $subsidiary,
        Department $department,
        string $name,
        bool $published,
    ): Folder {
        return Folder::query()->create([
            'subsidiary_id' => $subsidiary->id,
            'department_id' => $department->id,
            'name' => $name,
            'slug' => str($name)->slug(),
            'depth' => 0,
            'is_published' => $published,
            'created_by' => $user->id,
        ]);
    }
}
