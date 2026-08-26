<?php

namespace App\Http\Requests\Auth;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'string', 'max:50'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $employeeId = trim((string) $this->input('employee_id'));
        $user = User::query()->where('employee_id', $employeeId)->first();
        if ($user?->locked_until?->isFuture()) {
            throw ValidationException::withMessages(['employee_id' => __('This account is temporarily locked. Try again later.')]);
        }
        $valid = $user && $user->account_status === 'active' && Hash::check((string) $this->input('password'), $user->password);
        if (! $valid) {
            RateLimiter::hit($this->throttleKey());
            if ($user) {
                $attempts = $user->failed_login_attempts + 1;
                $user->forceFill(['failed_login_attempts' => $attempts, 'locked_until' => $attempts >= 5 ? now()->addMinutes(15) : null])->save();
            }
            ActivityLog::query()->create(['user_id' => $user?->id, 'event' => $user && $user->failed_login_attempts >= 5 ? 'auth.locked' : 'auth.failed', 'description' => 'Authentication attempt rejected.', 'ip_address' => $this->ip(), 'user_agent' => Str::limit((string) $this->userAgent(), 1000)]);

            throw ValidationException::withMessages([
                'employee_id' => trans('auth.failed'),
            ]);
        }

        Auth::login($user, $this->boolean('remember'));
        $user->forceFill(['failed_login_attempts' => 0, 'locked_until' => null, 'last_login_at' => now()])->save();
        ActivityLog::query()->create(['user_id' => $user->id, 'event' => 'auth.login', 'description' => 'User signed in.', 'ip_address' => $this->ip(), 'user_agent' => Str::limit((string) $this->userAgent(), 1000)]);
        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'employee_id' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('employee_id')).'|'.$this->ip());
    }
}
