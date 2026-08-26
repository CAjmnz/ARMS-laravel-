<?php
namespace App\Console\Commands;
use App\Models\Role; use App\Models\User; use Illuminate\Console\Command; use Illuminate\Support\Facades\DB; use Illuminate\Support\Facades\Hash; use Illuminate\Support\Facades\Validator; use Illuminate\Validation\Rules\Password;
class CreateSuperAdministrator extends Command
{
 protected $signature='arms:create-super-admin {--force-change : Require a password change at first login}'; protected $description='Create the first ARMS-Laravel Super Administrator securely';
 public function handle():int
 {
  $data=['employee_id'=>trim($this->ask('Employee ID')),'name'=>trim($this->ask('Full name')),'email'=>trim($this->ask('Email (optional)',''))?:null,'password'=>$this->secret('Password'),'password_confirmation'=>$this->secret('Confirm password')];
  $validator=Validator::make($data,['employee_id'=>['required','max:50','unique:users,employee_id'],'name'=>['required','max:150'],'email'=>['nullable','email','unique:users,email'],'password'=>['required','confirmed',Password::min(12)->mixedCase()->numbers()->symbols()]]);
  if($validator->fails()){foreach($validator->errors()->all() as $error){$this->error($error);}return self::FAILURE;}
  $role=Role::query()->where('slug','super-administrator')->first(); if(!$role){$this->error('Super Administrator role is missing. Run the foundation seeders first.');return self::FAILURE;}
  DB::transaction(function()use($data,$role):void{$mustChange=(bool)$this->option('force-change');$user=User::query()->create(['employee_id'=>$data['employee_id'],'name'=>$data['name'],'email'=>$data['email'],'account_status'=>'active','password'=>Hash::make($data['password']),'password_must_change'=>$mustChange,'password_changed_at'=>$mustChange?null:now()]);$user->roles()->attach($role->id);});
  $this->info('Super Administrator created successfully.'); return self::SUCCESS;
 }
}
