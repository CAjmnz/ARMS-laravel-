<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const LEVEL_4 = 'super-administrator';
    public const LEVEL_3 = 'administrator';
    public const LEVEL_2 = 'records-officer';
    public const LEVEL_1 = 'viewer';

    public const FIXED_SLUGS = [
        self::LEVEL_4,
        self::LEVEL_3,
        self::LEVEL_2,
        self::LEVEL_1,
    ];

    protected $fillable = ['name', 'slug', 'description', 'is_system'];

    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('assigned_by')->withTimestamps();
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function level(): int
    {
        return match ($this->slug) {
            self::LEVEL_4 => 4,
            self::LEVEL_3 => 3,
            self::LEVEL_2 => 2,
            self::LEVEL_1 => 1,
            default => 0,
        };
    }
}
