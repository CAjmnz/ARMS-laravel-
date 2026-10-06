<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReceivingRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'receiving_number','received_at','received_by','sender_name','requesting_office',
        'subsidiary_id','department_id','title','document_type','page_count','copy_count',
        'physical_status','digital_copy_status','purpose','priority','classification',
        'related_document_id','attachments','initial_condition','barcode','status','remarks',
    ];

    protected function casts(): array
    {
        return ['received_at' => 'datetime', 'attachments' => 'array'];
    }

    public function receiver(): BelongsTo { return $this->belongsTo(User::class, 'received_by'); }
    public function subsidiary(): BelongsTo { return $this->belongsTo(Subsidiary::class); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function relatedDocument(): BelongsTo { return $this->belongsTo(Document::class, 'related_document_id'); }
    public function statusHistories(): HasMany { return $this->hasMany(ReceivingStatusHistory::class); }
}
