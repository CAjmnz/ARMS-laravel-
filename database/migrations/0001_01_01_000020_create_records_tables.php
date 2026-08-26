<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_types', function (Blueprint $table) {
            $table->id();
            $table->string('extension', 20)->unique();
            $table->json('mime_types');
            $table->unsignedBigInteger('maximum_size_kb')->default(102400);
            $table->boolean('is_previewable')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('folders')->restrictOnDelete();
            $table->foreignId('subsidiary_id')->constrained()->restrictOnDelete();
            $table->foreignId('department_id')->constrained()->restrictOnDelete();
            $table->string('name', 250);
            $table->string('slug', 250);
            $table->unsignedInteger('depth')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['parent_id', 'slug']);
            $table->index(['subsidiary_id', 'department_id', 'parent_id']);
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('folder_id')->constrained()->restrictOnDelete();
            $table->string('title', 250);
            $table->string('reference_number', 100)->nullable()->index();
            $table->text('description')->nullable();
            $table->date('document_date')->nullable()->index();
            $table->string('status', 30)->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['folder_id', 'title']);
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('original_filename', 255);
            $table->string('storage_disk', 50)->default('documents');
            $table->string('storage_path', 500)->unique();
            $table->string('watermark_path', 500)->nullable();
            $table->string('preview_path', 500)->nullable();
            $table->string('mime_type', 150);
            $table->string('extension', 20);
            $table->unsignedBigInteger('size_bytes');
            $table->char('sha256', 64)->index();
            $table->string('scan_status', 30)->default('pending')->index();
            $table->timestamp('scanned_at')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['document_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('folders');
        Schema::dropIfExists('file_types');
    }
};
