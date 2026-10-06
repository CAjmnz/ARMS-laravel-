<?php

namespace Tests\Feature\ScanningKeepsafe;

use App\Models\ReceivingRecord;
use App\Models\Role;
use App\Models\ScanningKeepsafeRequest;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScanningKeepsafeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_l3_can_create_scanning_request_linked_to_receiving_record(): void
    {
        $user = $this->userWithRole(Role::LEVEL_3);
        $receiving = ReceivingRecord::query()->create([
            'receiving_number' => 'RCV-20261006-0001',
            'received_at' => now(),
            'received_by' => $user->id,
            'sender_name' => 'Records Office',
            'title' => 'Personnel File',
            'document_type' => 'Personnel',
            'copy_count' => 1,
            'physical_status' => 'Original',
            'digital_copy_status' => 'To be scanned',
            'priority' => 'High',
            'classification' => 'Internal',
            'status' => 'Received',
        ]);

        $response = $this->actingAs($user)->post(route('scanning-keepsafe.store'), [
            'receiving_record_id' => $receiving->id,
            'requested_at' => '2026-10-06 10:00',
            'request_type' => 'Scanning',
            'purpose' => 'Create protected digital copy.',
            'instructions' => 'Scan all pages in order.',
            'priority' => 'High',
        ]);

        $response->assertRedirect();
        $request = ScanningKeepsafeRequest::query()->firstOrFail();
        $this->assertSame('SKR-20261006-0001', $request->request_number);
        $this->assertSame('Pending', $request->status);
        $this->assertSame($receiving->id, $request->receiving_record_id);
        $this->assertDatabaseHas('scanning_keepsafe_status_histories', [
            'scanning_keepsafe_request_id' => $request->id,
            'status' => 'Pending',
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'event' => 'scanning_keepsafe.created',
            'auditable_id' => $request->id,
        ]);
    }

    public function test_l1_and_l2_cannot_access_scanning_keepsafe(): void
    {
        foreach ([Role::LEVEL_1, Role::LEVEL_2] as $level) {
            $user = $this->userWithRole($level);
            $this->actingAs($user)->get(route('scanning-keepsafe.index'))->assertForbidden();
            $this->actingAs($user)->post(route('scanning-keepsafe.store'), [])->assertForbidden();
        }
    }

    public function test_l4_can_update_assignment_status_and_history(): void
    {
        $user = $this->userWithRole(Role::LEVEL_4);
        $assignee = User::factory()->create();
        $receiving = ReceivingRecord::query()->create([
            'receiving_number' => 'RCV-20261006-0002',
            'received_at' => now(),
            'received_by' => $user->id,
            'sender_name' => 'Legal',
            'title' => 'Contract',
            'document_type' => 'Contract',
            'copy_count' => 1,
            'physical_status' => 'Original',
            'digital_copy_status' => 'Available',
            'priority' => 'Normal',
            'classification' => 'Confidential',
            'status' => 'Received',
        ]);

        $this->actingAs($user)->post(route('scanning-keepsafe.store'), [
            'receiving_record_id' => $receiving->id,
            'requested_at' => now()->toDateTimeString(),
            'request_type' => 'Keepsafe',
            'priority' => 'Normal',
        ])->assertRedirect();

        $request = ScanningKeepsafeRequest::query()->firstOrFail();
        $this->actingAs($user)->patch(route('scanning-keepsafe.update', $request), [
            'status' => 'Approved',
            'assigned_to' => $assignee->id,
            'notes' => 'Approved for controlled handling.',
        ])->assertRedirect();

        $this->assertDatabaseHas('scanning_keepsafe_requests', [
            'id' => $request->id,
            'status' => 'Approved',
            'assigned_to' => $assignee->id,
        ]);
        $this->assertDatabaseHas('scanning_keepsafe_status_histories', [
            'scanning_keepsafe_request_id' => $request->id,
            'status' => 'Approved',
        ]);
    }

    public function test_completed_request_gets_completion_timestamp(): void
    {
        $user = $this->userWithRole(Role::LEVEL_4);
        $receiving = ReceivingRecord::query()->create([
            'receiving_number' => 'RCV-20261006-0003',
            'received_at' => now(),
            'received_by' => $user->id,
            'sender_name' => 'Archives',
            'title' => 'Archive Box',
            'document_type' => 'Record',
            'copy_count' => 1,
            'physical_status' => 'Original',
            'digital_copy_status' => 'Not available',
            'priority' => 'Normal',
            'classification' => 'Internal',
            'status' => 'For Storage',
        ]);

        $this->actingAs($user)->post(route('scanning-keepsafe.store'), [
            'receiving_record_id' => $receiving->id,
            'requested_at' => now()->toDateTimeString(),
            'request_type' => 'Keepsafe',
            'priority' => 'Normal',
        ])->assertRedirect();

        $request = ScanningKeepsafeRequest::query()->firstOrFail();
        $this->actingAs($user)->patch(route('scanning-keepsafe.update', $request), [
            'status' => 'Completed',
            'assigned_to' => '',
        ])->assertRedirect();

        $this->assertNotNull($request->fresh()->completed_at);
    }

    private function userWithRole(string $level): User
    {
        $slug = match ($level) {
            Role::LEVEL_4 => Role::LEVEL_4,
            Role::LEVEL_3 => Role::LEVEL_3,
            Role::LEVEL_2 => Role::LEVEL_2,
            default => Role::LEVEL_1,
        };
        $role = Role::query()->where('slug', $slug)->firstOrFail();
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }
}
