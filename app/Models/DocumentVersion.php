<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVersion extends Model
{
    protected $fillable = [
        'document_id', 'version_number', 'original_filename', 'storage_disk', 'storage_path',
        'watermark_path', 'preview_path', 'mime_type', 'extension', 'size_bytes', 'sha256',
        'scan_status', 'scanned_at', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return ['scanned_at' => 'datetime'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
