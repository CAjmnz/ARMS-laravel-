<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class OrganizationLocation extends Model
{
    use HasFactory;

    protected $table = 'organization_locations';

    protected $fillable = ['subdivision_id', 'department_id', 'code', 'name', 'status'];

    public function subdivision(): BelongsTo { return $this->belongsTo(OrganizationSubdivision::class, 'subdivision_id'); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class, 'department_id'); }
    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(GroupConsolidatedFs::class, 'group_consolidated_fs_locations', 'location_id', 'group_id');
    }
}
