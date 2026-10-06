<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class ScanningKeepsafeStatusHistory extends Model
{
    use HasFactory;

    protected $fillable = ['scanning_keepsafe_request_id','status','changed_by','notes'];

    public function request(): BelongsTo
    {
        return $this->belongsTo(ScanningKeepsafeRequest::class, 'scanning_keepsafe_request_id');
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
