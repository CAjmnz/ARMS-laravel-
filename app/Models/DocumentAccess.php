<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentAccess extends Model
{
    protected $table = 'document_access';

    protected $fillable = [
        'document_id', 'folder_id', 'user_id', 'role_id', 'subsidiary_id', 'department_id',
        'can_view', 'can_download', 'can_upload', 'granted_by', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'can_view' => 'boolean',
            'can_download' => 'boolean',
            'can_upload' => 'boolean',
            'expires_at' => 'datetime',
        ];
    }
}
