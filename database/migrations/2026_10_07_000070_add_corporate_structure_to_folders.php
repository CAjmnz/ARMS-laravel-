<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->foreignId('division_id')->nullable()->after('subsidiary_id')->constrained('organization_divisions')->nullOnDelete();
            $table->foreignId('subdivision_id')->nullable()->after('division_id')->constrained('organization_subdivisions')->nullOnDelete();
            $table->foreignId('location_id')->nullable()->after('department_id')->constrained('organization_locations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropForeign(['subdivision_id']);
            $table->dropForeign(['division_id']);
            $table->dropColumn(['location_id', 'subdivision_id', 'division_id']);
        });
    }
};
