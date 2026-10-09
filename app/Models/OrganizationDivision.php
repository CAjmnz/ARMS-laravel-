<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationDivision extends Model
{
    use HasFactory;

    protected $table = 'organization_divisions';

    protected $fillable = ['subsidiary_id', 'code', 'name', 'status'];

    public function subsidiary(): BelongsTo { return $this->belongsTo(Subsidiary::class); }
    public function subdivisions(): HasMany { return $this->hasMany(OrganizationSubdivision::class, 'division_id'); }
}
