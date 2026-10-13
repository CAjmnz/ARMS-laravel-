<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->boolean('is_published')->default(true)->after('status')->index();
            $table->foreignId('unpublished_by')->nullable()->after('is_published')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('unpublished_at')->nullable()->after('unpublished_by');
            $table->foreignId('published_by')->nullable()->after('unpublished_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable()->after('published_by');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('published_by');
            $table->dropColumn('published_at');
            $table->dropConstrainedForeignId('unpublished_by');
            $table->dropColumn(['unpublished_at', 'is_published']);
        });
    }
};
