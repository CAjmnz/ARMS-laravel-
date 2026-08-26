<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folders', function (Blueprint $table): void {
            $table->foreignId('unpublished_by')->nullable()->after('created_by')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('unpublished_at')->nullable()->after('unpublished_by');
            $table->foreignId('published_by')->nullable()->after('unpublished_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable()->after('published_by');
            $table->string('legacy_source_type', 30)->nullable()->index();
            $table->unsignedBigInteger('legacy_source_id')->nullable()->index();
            $table->unsignedTinyInteger('legacy_level')->nullable()->index();
            $table->string('legacy_path', 1000)->nullable();
            $table->unique(['legacy_source_type', 'legacy_source_id']);
        });
    }

    public function down(): void
    {
        Schema::table('folders', function (Blueprint $table): void {
            $table->dropUnique(['legacy_source_type', 'legacy_source_id']);
            $table->dropConstrainedForeignId('published_by');
            $table->dropColumn('published_at');
            $table->dropConstrainedForeignId('unpublished_by');
            $table->dropColumn([
                'unpublished_at',
                'legacy_source_type',
                'legacy_source_id',
                'legacy_level',
                'legacy_path',
            ]);
        });
    }
};
