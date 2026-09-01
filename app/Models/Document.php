<?php

namespace App\Models;

use App\Models\Concerns\EncryptsRouteKey;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Document extends Model
{
    use EncryptsRouteKey, HasFactory, SoftDeletes;

    protected $fillable = [
        'folder_id', 'title', 'reference_number', 'description', 'document_date', 'status', 'created_by',
    ];

    protected static function booted(): void
    {
        static::creating(function (Document $document) {
            $document->uuid ??= (string) Str::uuid();
        });
    }

    protected function casts(): array
    {
        return ['document_date' => 'date'];
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class);
    }

    public function latestVersion()
    {
        return $this->hasOne(DocumentVersion::class)->ofMany('version_number', 'max');
    }
}
