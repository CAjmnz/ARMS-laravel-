<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scanning_keepsafe_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 50)->unique();
            $table->foreignId('receiving_record_id')->constrained('receiving_records')->restrictOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('requested_at')->index();
            $table->string('request_type', 30);
            $table->text('purpose')->nullable();
            $table->text('instructions')->nullable();
            $table->string('priority', 30)->default('Normal');
            $table->dateTime('due_at')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('Pending')->index();
            $table->dateTime('completed_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->index(['request_type','requested_at']);
            $table->index(['assigned_to','status']);
        });

        Schema::create('scanning_keepsafe_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scanning_keepsafe_request_id')->constrained('scanning_keepsafe_requests', 'id', 'skr_history_request_fk')->cascadeOnDelete();
            $table->string('status', 30);
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['scanning_keepsafe_request_id','created_at'], 'skr_history_record_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scanning_keepsafe_status_histories');
        Schema::dropIfExists('scanning_keepsafe_requests');
    }
};
