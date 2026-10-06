<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\ReceivingRecord;
use App\Models\Subsidiary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ReceivingController extends Controller
{
    private const STATUSES = ['Received','For Registration','For Scanning','For Storage','Completed'];

    public function index(Request $request): Response
    {
        $search = trim($request->string('search')->toString());
        $status = $request->string('status')->toString();
        $perPage = in_array((int) $request->integer('per_page'), [10,25,50,100], true)
            ? (int) $request->integer('per_page') : 25;

        $records = ReceivingRecord::query()
            ->with(['receiver:id,name','subsidiary:id,name','department:id,name'])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(fn ($q) => $q
                    ->where('receiving_number','like',$like)
                    ->orWhere('sender_name','like',$like)
                    ->orWhere('requesting_office','like',$like)
                    ->orWhere('title','like',$like)
                    ->orWhere('document_type','like',$like)
                    ->orWhere('barcode','like',$like));
            })
            ->when(in_array($status, self::STATUSES, true), fn ($query) => $query->where('status',$status))
            ->latest('received_at')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (ReceivingRecord $record) => [
                'id'=>$record->id,
                'receiving_number'=>$record->receiving_number,
                'received_at'=>$record->received_at?->toIso8601String(),
                'sender_name'=>$record->sender_name,
                'requesting_office'=>$record->requesting_office,
                'title'=>$record->title,
                'document_type'=>$record->document_type,
                'status'=>$record->status,
                'priority'=>$record->priority,
                'classification'=>$record->classification,
                'barcode'=>$record->barcode,
                'receiver'=>$record->receiver,
                'subsidiary'=>$record->subsidiary,
                'department'=>$record->department,
                'show_url'=>route('receiving.show',$record),
            ]);

        return Inertia::render('Receiving/Index', [
            'records'=>$records,
            'filters'=>['search'=>$search,'status'=>$status,'per_page'=>$perPage],
            'statuses'=>self::STATUSES,
            'organizations'=>Subsidiary::query()->with('departments:id,subsidiary_id,name')->orderBy('name')->get(['id','name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'received_at'=>['required','date'],
            'sender_name'=>['required','string','max:200'],
            'requesting_office'=>['nullable','string','max:200'],
            'subsidiary_id'=>['nullable','integer','exists:subsidiaries,id'],
            'department_id'=>['nullable','integer','exists:departments,id'],
            'title'=>['required','string','max:250'],
            'document_type'=>['required','string','max:100'],
            'page_count'=>['nullable','integer','min:0','max:100000'],
            'copy_count'=>['required','integer','min:1','max:10000'],
            'physical_status'=>['required',Rule::in(['Original','Copy','Certified Copy','Unknown'])],
            'digital_copy_status'=>['required',Rule::in(['Available','Not available','To be scanned'])],
            'purpose'=>['nullable','string','max:5000'],
            'priority'=>['required',Rule::in(['Low','Normal','High','Urgent'])],
            'classification'=>['required',Rule::in(['Public','Internal','Confidential','Restricted'])],
            'related_document_id'=>['nullable','integer','exists:documents,id'],
            'attachments'=>['nullable','array','max:20'],
            'attachments.*'=>['string','max:500'],
            'initial_condition'=>['nullable','string','max:5000'],
            'barcode'=>['nullable','string','max:100','unique:receiving_records,barcode'],
            'remarks'=>['nullable','string','max:5000'],
        ]);

        DB::transaction(function () use ($request,$validated) {
            $date = now()->format('Ymd');
            $prefix = 'RCV-'.$date.'-';
            $last = ReceivingRecord::query()->where('receiving_number','like',$prefix.'%')->lockForUpdate()->orderByDesc('id')->value('receiving_number');
            $number = $prefix.str_pad((string)($last ? ((int)substr($last,-4))+1 : 1),4,'0',STR_PAD_LEFT);

            $record = ReceivingRecord::query()->create([...$validated,'receiving_number'=>$number,'received_by'=>$request->user()->id,'status'=>'Received']);
            $record->statusHistories()->create(['status'=>'Received','changed_by'=>$request->user()->id,'notes'=>'Receiving record created.']);

            ActivityLog::query()->create([
                'user_id'=>$request->user()->id,'event'=>'receiving.created',
                'auditable_type'=>ReceivingRecord::class,'auditable_id'=>$record->id,
                'description'=>'Received document: '.$record->title,
                'new_values'=>['receiving_number'=>$record->receiving_number,'title'=>$record->title,'status'=>$record->status],
                'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent(),
            ]);
        });

        return back()->with('success','Receiving record created successfully.');
    }

    public function show(ReceivingRecord $receivingRecord): Response
    {
        $receivingRecord->load([
            'receiver:id,name,email','subsidiary:id,name','department:id,name',
            'relatedDocument:id,title,reference_number',
            'statusHistories'=>fn($q)=>$q->with('changer:id,name')->latest(),
        ]);

        return Inertia::render('Receiving/Show', [
            'record'=>$receivingRecord,
            'statusHistories'=>$receivingRecord->statusHistories->map(fn($h)=>[
                'id'=>$h->id,'status'=>$h->status,'notes'=>$h->notes,
                'created_at'=>$h->created_at?->toIso8601String(),'changed_by'=>$h->changer,
            ])->values(),
            'statuses'=>self::STATUSES,
        ]);
    }

    public function updateStatus(Request $request, ReceivingRecord $receivingRecord): RedirectResponse
    {
        $validated = $request->validate(['status'=>['required',Rule::in(self::STATUSES)],'notes'=>['nullable','string','max:2000']]);
        if ($receivingRecord->status === $validated['status']) return back()->with('info','The receiving record is already at this status.');

        DB::transaction(function () use ($request,$receivingRecord,$validated) {
            $old = $receivingRecord->status;
            $receivingRecord->update(['status'=>$validated['status']]);
            $receivingRecord->statusHistories()->create(['status'=>$validated['status'],'changed_by'=>$request->user()->id,'notes'=>$validated['notes'] ?? null]);
            ActivityLog::query()->create([
                'user_id'=>$request->user()->id,'event'=>'receiving.status_changed',
                'auditable_type'=>ReceivingRecord::class,'auditable_id'=>$receivingRecord->id,
                'description'=>'Receiving status changed for '.$receivingRecord->title,
                'old_values'=>['status'=>$old],'new_values'=>['status'=>$validated['status'],'notes'=>$validated['notes'] ?? null],
                'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent(),
            ]);
        });

        return back()->with('success','Receiving status updated successfully.');
    }
}
