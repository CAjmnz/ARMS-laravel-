<?php
namespace Tests\Feature\Auth;
use Tests\TestCase;
class PasswordResetTest extends TestCase
{
    public function test_public_password_reset_is_unavailable(): void
    {
        $this->get('/forgot-password')->assertNotFound();
        $this->post('/forgot-password', [])->assertNotFound();
    }
}
