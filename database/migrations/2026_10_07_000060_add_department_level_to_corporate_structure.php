<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table): void {
            $table->foreignId('subdivision_id')
                ->nullable()
                ->after('subsidiary_id')
                ->constrained('organization_subdivisions')
                ->restrictOnDelete();
            $table->index(['subsidiary_id', 'subdivision_id']);
        });

        Schema::table('organization_locations', function (Blueprint $table): void {
            $table->foreignId('department_id')
                ->nullable()
                ->after('subdivision_id')
                ->constrained('departments')
                ->restrictOnDelete();
            $table->index(['subdivision_id', 'department_id']);
        });
    }

    public function down(): void
    {
        Schema::table('organization_locations', function (Blueprint $table): void {
            $table->dropForeign(['department_id']);
            $table->dropIndex(['subdivision_id', 'department_id']);
            $table->dropColumn('department_id');
        });

        Schema::table('departments', function (Blueprint $table): void {
            $table->dropForeign(['subdivision_id']);
            $table->dropIndex(['subsidiary_id', 'subdivision_id']);
            $table->dropColumn('subdivision_id');
        });
    }
};
