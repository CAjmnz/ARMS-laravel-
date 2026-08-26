<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FileType extends Model
{
    protected $fillable = [
        'extension', 'mime_types', 'maximum_size_kb', 'is_previewable', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'mime_types' => 'array',
            'is_previewable' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
