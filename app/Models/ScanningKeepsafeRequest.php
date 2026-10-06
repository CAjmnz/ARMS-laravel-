<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class ScanningKeepsafeRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'request_number','receiving_record_id','requested_by','requested_at','request_type',
        'purpose','instructions','priority','due_at','assigned_to','status','completed_at','remarks',
    ];

    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function receivingRecord(): BelongsTo { return $this->belongsTo(ReceivingRecord::class); }
    public function requester(): BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function assignee(): BelongsTo { return $this->belongsTo(User::class, 'assigned_to'); }
    public function statusHistories(): HasMany { return $this->hasMany(ScanningKeepsafeStatusHistory::class); }
}
