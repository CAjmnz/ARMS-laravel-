<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receiving_records', function (Blueprint $table) {
            $table->id();
            $table->string('receiving_number', 50)->unique();
            $table->dateTime('received_at')->index();
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->string('sender_name', 200);
            $table->string('requesting_office', 200)->nullable();
            $table->foreignId('subsidiary_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('title', 250);
            $table->string('document_type', 100);
            $table->unsignedInteger('page_count')->nullable();
            $table->unsignedInteger('copy_count')->default(1);
            $table->string('physical_status', 50)->default('Original');
            $table->string('digital_copy_status', 50)->default('Not available');
            $table->text('purpose')->nullable();
            $table->string('priority', 30)->default('Normal');
            $table->string('classification', 50)->default('Internal');
            $table->foreignId('related_document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->json('attachments')->nullable();
            $table->text('initial_condition')->nullable();
            $table->string('barcode', 100)->nullable()->unique();
            $table->string('status', 40)->default('Received')->index();
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->index(['subsidiary_id','department_id']);
            $table->index(['status','received_at']);
        });

        Schema::create('receiving_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('receiving_record_id')->constrained('receiving_records')->cascadeOnDelete();
            $table->string('status', 40);
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['receiving_record_id','created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receiving_status_histories');
        Schema::dropIfExists('receiving_records');
    }
};
