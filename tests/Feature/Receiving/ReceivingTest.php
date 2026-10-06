<?php

namespace Tests\Feature\Receiving;

use App\Models\ReceivingRecord;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReceivingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_l3_can_create_receiving_record_and_history_is_created(): void
    {
        $user=$this->userWithRole(Role::LEVEL_3);
        $response=$this->actingAs($user)->post(route('receiving.store'),[
            'received_at'=>'2026-10-06 09:30','sender_name'=>'Records Office','title'=>'Annual Financial Report',
            'document_type'=>'Report','copy_count'=>1,'physical_status'=>'Original','digital_copy_status'=>'To be scanned',
            'priority'=>'High','classification'=>'Internal','initial_condition'=>'Complete and legible.',
        ]);
        $response->assertRedirect();
        $record=ReceivingRecord::query()->firstOrFail();
        $this->assertSame('Received',$record->status);
        $this->assertDatabaseHas('receiving_status_histories',['receiving_record_id'=>$record->id,'status'=>'Received']);
        $this->assertDatabaseHas('activity_logs',['auditable_type'=>ReceivingRecord::class,'auditable_id'=>$record->id,'event'=>'receiving.created']);
    }

    public function test_l1_and_l2_cannot_manage_receiving(): void
    {
        foreach([Role::LEVEL_1,Role::LEVEL_2] as $level){
            $user=$this->userWithRole($level);
            $this->actingAs($user)->get(route('receiving.index'))->assertForbidden();
            $this->actingAs($user)->post(route('receiving.store'),[])->assertForbidden();
        }
    }

    public function test_l4_can_update_status_and_history(): void
    {
        $user=$this->userWithRole(Role::LEVEL_4);
        $this->actingAs($user)->post(route('receiving.store'),[
            'received_at'=>now()->toDateTimeString(),'sender_name'=>'Legal','title'=>'Contract',
            'document_type'=>'Contract','copy_count'=>2,'physical_status'=>'Original','digital_copy_status'=>'Available',
            'priority'=>'Normal','classification'=>'Confidential',
        ])->assertRedirect();
        $record=ReceivingRecord::query()->firstOrFail();
        $this->actingAs($user)->patch(route('receiving.status',$record),['status'=>'For Scanning','notes'=>'Queued for scanning.'])->assertRedirect();
        $this->assertDatabaseHas('receiving_status_histories',['receiving_record_id'=>$record->id,'status'=>'For Scanning']);
        $this->assertDatabaseHas('activity_logs',['event'=>'receiving.status_changed','auditable_id'=>$record->id]);
    }

    private function userWithRole(string $level): User
    {
        $slug=match($level){Role::LEVEL_4=>'super-administrator',Role::LEVEL_3=>'administrator',Role::LEVEL_2=>'records-officer',default=>'viewer'};
        $role=Role::query()->where('slug',$slug)->firstOrFail();
        $user=User::factory()->create();
        $user->roles()->attach($role->id);
        return $user;
    }
}
