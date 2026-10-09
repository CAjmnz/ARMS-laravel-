<?php

namespace App\Models;

use App\Models\Concerns\EncryptsRouteKey;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use EncryptsRouteKey, HasFactory, SoftDeletes;

    protected $fillable = ['subsidiary_id', 'subdivision_id', 'code', 'name', 'status'];

    public function subsidiary(): BelongsTo
    {
        return $this->belongsTo(Subsidiary::class);
    }

    public function subdivision(): BelongsTo
    {
        return $this->belongsTo(OrganizationSubdivision::class, 'subdivision_id');
    }

    public function locations(): HasMany
    {
        return $this->hasMany(OrganizationLocation::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class);
    }
}
