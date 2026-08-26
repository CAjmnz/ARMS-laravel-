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
    public function test_users_can_logout(): void { $user=User::factory()->create(); $this->actingAs($user)->post('/logout')->assertRedirect('/'); $this->assertGuest(); }
}
