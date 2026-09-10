<?php

namespace Tests\Feature\Portal;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserPortalFoundationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_level_one_and_two_can_open_portal_dashboard_and_documents(): void
    {
        foreach ([Role::LEVEL_1, Role::LEVEL_2] as $slug) {
            $user = $this->userWithRole($slug);

            $this->actingAs($user)
                ->get(route('portal.dashboard'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Portal/Dashboard')
                    ->has('summary.visible_documents')
                    ->has('summary.downloadable_documents'));

            $this->actingAs($user)
                ->get(route('portal.documents'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Portal/Documents')
                    ->has('summary.visible_documents')
                    ->has('summary.can_download'));
        }
    }

    public function test_level_one_and_two_are_redirected_from_management_dashboard_to_portal(): void
    {
        foreach ([Role::LEVEL_1, Role::LEVEL_2] as $slug) {
            $this->actingAs($this->userWithRole($slug))
                ->get(route('dashboard'))
                ->assertRedirect(route('portal.dashboard'));
        }
    }

    public function test_level_three_and_four_cannot_open_user_portal(): void
    {
        foreach ([Role::LEVEL_3, Role::LEVEL_4] as $slug) {
            $user = $this->userWithRole($slug);

            $this->actingAs($user)->get(route('portal.dashboard'))->assertForbidden();
            $this->actingAs($user)->get(route('portal.documents'))->assertForbidden();
        }
    }

    public function test_lower_level_profile_uses_portal_profile_while_level_three_keeps_existing_profile(): void
    {
        $levelOne = $this->userWithRole(Role::LEVEL_1);
        $administrator = $this->userWithRole(Role::LEVEL_3);

        $this->actingAs($levelOne)
            ->get(route('profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Portal/Profile'));

        $this->actingAs($administrator)
            ->get(route('profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Profile/Edit'));
    }

    public function test_level_two_portal_reports_download_capability_but_level_one_does_not(): void
    {
        $levelOne = $this->userWithRole(Role::LEVEL_1);
        $levelTwo = $this->userWithRole(Role::LEVEL_2);

        $this->actingAs($levelOne)
            ->get(route('portal.documents'))
            ->assertInertia(fn (Assert $page) => $page->where('summary.can_download', false));

        $this->actingAs($levelTwo)
            ->get(route('portal.documents'))
            ->assertInertia(fn (Assert $page) => $page->where('summary.can_download', true));
    }

    private function userWithRole(string $slug): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $slug)->firstOrFail());

        return $user;
    }
}
