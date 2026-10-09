<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationSubdivision extends Model
{
    use HasFactory;

    protected $table = 'organization_subdivisions';

    protected $fillable = ['division_id', 'parent_id', 'code', 'name', 'status'];

    public function division(): BelongsTo
    {
        return $this->belongsTo(OrganizationDivision::class, 'division_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(OrganizationSubdivision::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(OrganizationSubdivision::class, 'parent_id')->orderBy('name');
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class, 'subdivision_id')->orderBy('name');
    }

    public function locations(): HasMany
    {
        return $this->hasMany(OrganizationLocation::class, 'subdivision_id')->orderBy('name');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(GroupConsolidatedFs::class, 'subdivision_id')->orderBy('name');
    }
}
