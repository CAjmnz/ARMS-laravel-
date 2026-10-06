<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReceivingStatusHistory extends Model
{
    use HasFactory;

    protected $fillable = ['receiving_record_id','status','changed_by','notes'];

    public function receivingRecord(): BelongsTo { return $this->belongsTo(ReceivingRecord::class); }
    public function changer(): BelongsTo { return $this->belongsTo(User::class, 'changed_by'); }
}
