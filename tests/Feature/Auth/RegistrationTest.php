<?php
namespace Tests\Feature\Auth;
use Tests\TestCase;
class RegistrationTest extends TestCase
{
    public function test_public_registration_is_unavailable(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [])->assertNotFound();
    }
}
