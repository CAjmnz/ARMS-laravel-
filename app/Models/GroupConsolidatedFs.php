<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GroupConsolidatedFs extends Model
{
    use HasFactory;

    protected $table = 'group_consolidated_fs';

    protected $fillable = ['subdivision_id', 'code', 'name', 'status'];

    public function subdivision(): BelongsTo { return $this->belongsTo(OrganizationSubdivision::class, 'subdivision_id'); }
    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(OrganizationLocation::class, 'group_consolidated_fs_locations', 'group_id', 'location_id');
    }
}
