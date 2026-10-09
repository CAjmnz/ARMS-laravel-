<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_divisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subsidiary_id')->constrained('subsidiaries')->restrictOnDelete();
            $table->string('code', 50)->nullable();
            $table->string('name', 150);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->unique(['subsidiary_id', 'name']);
        });

        Schema::create('organization_subdivisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('division_id')->constrained('organization_divisions')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('organization_subdivisions')->nullOnDelete();
            $table->string('code', 50)->nullable();
            $table->string('name', 150);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->unique(['division_id', 'parent_id', 'name']);
        });

        Schema::create('organization_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subdivision_id')->constrained('organization_subdivisions')->cascadeOnDelete();
            $table->string('code', 50)->nullable();
            $table->string('name', 150);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->unique(['subdivision_id', 'name']);
        });

        Schema::create('group_consolidated_fs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subdivision_id')->constrained('organization_subdivisions')->cascadeOnDelete();
            $table->string('code', 50)->nullable();
            $table->string('name', 150);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->unique(['subdivision_id', 'name']);
        });

        Schema::create('group_consolidated_fs_locations', function (Blueprint $table) {
            $table->foreignId('group_id')->constrained('group_consolidated_fs')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('organization_locations')->cascadeOnDelete();
            $table->primary(['group_id', 'location_id']);
        });

        $this->seedCorporateStructure();
    }

    private function seedCorporateStructure(): void
    {
        DB::transaction(function () {
            $now = now();
            $subsidiary = DB::table('subsidiaries')->where('name', 'Marcela Farms, Incorporated')->first();

            $subsidiaryId = $subsidiary?->id ?? DB::table('subsidiaries')->insertGetId([
                'code' => 'MFI',
                'name' => 'Marcela Farms, Incorporated',
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $structure = [
                'MILLING DIVISION' => [
                    'FEEDMILL' => ['MIC Feedmill 1 (Ubay)', 'MIC Feedmill 2 (Ubay)', 'MIC Feedmill 3 (Ubay)'],
                    'RICEMILL' => ['Ricemill 1 (Ubay)', 'Ricemill 2 (Ubay)', 'Ricemill 3 (Ubay)', 'Mahayag Ricemill'],
                ],
                'COMMISSARY' => [
                    'Locations' => ['Food Service', 'Cold Storage', 'Bakeshoppe'],
                ],
                'FARMS' => [
                    'Locations' => ['Demo Farms (Ubay)'],
                ],
                'AQUA DIVISION' => [
                    'Locations' => ['Catagbacan Fishpond', 'Ortigas Fishpond', 'Maribojoc Fishpond', 'Tipcan Fishpond'],
                ],
                'OTHERS' => [
                    'Locations' => ['Copra Buying Station'],
                    'THE PRAWN FARM GRILL & SEAFOODS RESTAURANT' => ['ICM', 'South Farms'],
                ],
                'RETAIL STORE' => [
                    'PLAZA MARCELA' => [
                        'Supermarket', 'Bread Cottage', 'Medicine+', 'Fixrite', 'Fresh Market',
                        'Food Walk', 'S.O.D', 'Forex', 'CFS', 'Western Union',
                    ],
                ],
                'FACTORY/PLANT' => [
                    'Locations' => [
                        'Repacking', 'Noodles Factory', 'Ice Plant', 'Slaughter House',
                        'Fertilizer (Manure Plant)', 'Rendering Plant', 'Dressing Plant', "Farmer's Market",
                    ],
                ],
                'LIVESTOCK DIVISION' => [
                    'MFI-PIGGERY' => ['Cortes', 'Untaga'],
                    'MFI-POULTRY' => [
                        'LAYER PRODUCTION' => ['Cortes'],
                        'HATCHERY' => ['Quezon, Bilar'],
                        'BREEDER' => ['Subayon, Bilar', 'Rizal, Bilar', 'Lapsaon, Dimiao', 'Canhayupon, Dimiao'],
                        'GROW-OUT' => [
                            'Common', 'Lomangog, Ubay', 'Mabuhay', 'Gabi-Quisumbing',
                            'Gabi-Dr. Tan', 'La Hacienda, Alicia', 'Untaga, Alicia', 'Bagumbayan, Pilar',
                        ],
                    ],
                ],
            ];

            foreach ($structure as $divisionName => $subdivisions) {
                $divisionId = DB::table('organization_divisions')->insertGetId([
                    'subsidiary_id' => $subsidiaryId,
                    'name' => $divisionName,
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                foreach ($subdivisions as $subdivisionName => $children) {
                    $subdivisionId = $this->insertSubdivision($now, $divisionId, null, $subdivisionName);

                    if ($this->isNested($children)) {
                        foreach ($children as $childName => $locations) {
                            $childId = $this->insertSubdivision($now, $divisionId, $subdivisionId, $childName);
                            $this->insertLocations($now, $childId, $locations);
                        }
                    } else {
                        $this->insertLocations($now, $subdivisionId, $children);
                    }
                }
            }

            $this->seedGroup($now, $subsidiaryId, 'MILLING DIVISION', 'FEEDMILL', 'Feedmill Group Consolidated FS');
            $this->seedGroup($now, $subsidiaryId, 'MILLING DIVISION', 'RICEMILL', 'Ricemill Group Consolidated FS');
            $this->seedGroup($now, $subsidiaryId, 'RETAIL STORE', 'PLAZA MARCELA', 'Plaza Marcela Group Consolidated FS');
            $this->seedGroup($now, $subsidiaryId, 'LIVESTOCK DIVISION', 'MFI-PIGGERY', 'MFI-Piggery Group Consolidated FS');
        });
    }

    private function insertSubdivision($now, int $divisionId, ?int $parentId, string $name): int
    {
        return DB::table('organization_subdivisions')->insertGetId([
            'division_id' => $divisionId,
            'parent_id' => $parentId,
            'name' => $name,
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function insertLocations($now, int $subdivisionId, array $locations): void
    {
        foreach ($locations as $locationName) {
            DB::table('organization_locations')->insert([
                'subdivision_id' => $subdivisionId,
                'name' => $locationName,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function isNested(array $value): bool
    {
        return $value !== [] && !array_is_list($value);
    }

    private function seedGroup($now, int $subsidiaryId, string $divisionName, string $subdivisionName, string $groupName): void
    {
        $division = DB::table('organization_divisions')
            ->where('subsidiary_id', $subsidiaryId)
            ->where('name', $divisionName)
            ->first();

        $subdivision = DB::table('organization_subdivisions')
            ->where('division_id', $division->id)
            ->where('parent_id', null)
            ->where('name', $subdivisionName)
            ->first();

        $groupId = DB::table('group_consolidated_fs')->insertGetId([
            'subdivision_id' => $subdivision->id,
            'name' => $groupName,
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach (DB::table('organization_locations')->where('subdivision_id', $subdivision->id)->pluck('id') as $locationId) {
            DB::table('group_consolidated_fs_locations')->insert([
                'group_id' => $groupId,
                'location_id' => $locationId,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('group_consolidated_fs_locations');
        Schema::dropIfExists('group_consolidated_fs');
        Schema::dropIfExists('organization_locations');
        Schema::dropIfExists('organization_subdivisions');
        Schema::dropIfExists('organization_divisions');
    }
};
