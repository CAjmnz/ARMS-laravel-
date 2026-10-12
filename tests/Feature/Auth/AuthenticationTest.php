<?php
namespace Tests\Feature\Auth;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;
    public function test_login_screen_can_be_rendered(): void { $this->get('/login')->assertOk(); }
    public function test_active_user_can_authenticate_with_employee_id(): void { $user=User::factory()->create(['password'=>Hash::make('password'),'password_must_change'=>false]); $this->post('/login',['employee_id'=>$user->employee_id,'password'=>'password'])->assertRedirect('/dashboard'); $this->assertAuthenticatedAs($user); }
    public function test_inactive_user_cannot_authenticate(): void { $user=User::factory()->create(['account_status'=>'inactive']); $this->post('/login',['employee_id'=>$user->employee_id,'password'=>'password']); $this->assertGuest(); }
    public function test_five_failures_lock_the_account(): void { $user=User::factory()->create(); for($i=0;$i<5;$i++){$this->post('/login',['employee_id'=>$user->employee_id,'password'=>'wrong']);} $user->refresh(); $this->assertSame(5,$user->failed_login_attempts); $this->assertTrue($user->locked_until->isFuture()); }
    public function test_first_login_password_change_is_enforced(): void { $user=User::factory()->create(['password_must_change'=>true]); $this->post('/login',['employee_id'=>$user->employee_id,'password'=>'password'])->assertRedirect(route('password.required')); $this->get('/dashboard')->assertRedirect(route('password.required')); }
    public function test_login_rejects_employee_id_longer_than_25_characters(): void { $this->post('/login',['employee_id'=>str_repeat('A',26),'password'=>'password'])->assertSessionHasErrors('employee_id'); }
    public function test_login_rejects_password_longer_than_50_characters(): void { $user=User::factory()->create(['password'=>Hash::make(str_repeat('p',51))]); $this->post('/login',['employee_id'=>$user->employee_id,'password'=>str_repeat('p',51)])->assertSessionHasErrors('password'); $this->assertGuest(); }
    public function test_browser_tabs_keep_separate_authenticated_users(): void
    {
        $admin = User::factory()->create(['password' => Hash::make('password'), 'password_must_change' => false]);
        $viewer = User::factory()->create(['password' => Hash::make('password'), 'password_must_change' => false]);

        $this->withHeader('X-ARMS-Tab-ID', 'test-tab-admin')
            ->post('/login', ['employee_id' => $admin->employee_id, 'password' => 'password'])
            ->assertRedirect(route('dashboard', ['arms_tab_id' => 'test-tab-admin'], absolute: false));
        $this->withHeader('X-ARMS-Tab-ID', 'test-tab-viewer')
            ->post('/login', ['employee_id' => $viewer->employee_id, 'password' => 'password'])
            ->assertRedirect(route('dashboard', ['arms_tab_id' => 'test-tab-viewer'], absolute: false));

        $this->withHeader('X-ARMS-Tab-ID', 'test-tab-admin')
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('auth.user.id', $admin->id));

        $this->withHeader('X-ARMS-Tab-ID', 'test-tab-viewer')
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('auth.user.id', $viewer->id));
    }

    public function test_tab_logout_does_not_remove_another_tabs_login(): void
    {
        $first = User::factory()->create(['password' => Hash::make('password'), 'password_must_change' => false]);
        $second = User::factory()->create(['password' => Hash::make('password'), 'password_must_change' => false]);

        $this->withHeader('X-ARMS-Tab-ID', 'logout-tab-one')
            ->post('/login', ['employee_id' => $first->employee_id, 'password' => 'password']);
        $this->withHeader('X-ARMS-Tab-ID', 'logout-tab-two')
            ->post('/login', ['employee_id' => $second->employee_id, 'password' => 'password']);

        $this->withHeader('X-ARMS-Tab-ID', 'logout-tab-one')->post('/logout')->assertRedirect('/');
        $this->assertDatabaseHas('arms_tab_sessions', ['tab_id' => 'logout-tab-two', 'user_id' => $second->id]);

        $this->withHeader('X-ARMS-Tab-ID', 'logout-tab-two')
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('auth.user.id', $second->id));
    }

    public function test_users_can_logout(): void { $user=User::factory()->create(); $this->actingAs($user)->post('/logout')->assertRedirect('/'); $this->assertGuest(); }
}
