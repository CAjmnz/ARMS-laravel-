<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\ReceivingRecord;
use App\Models\ScanningKeepsafeRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ScanningKeepsafeController extends Controller
{
    private const TYPES = ['Scanning','Keepsafe'];
    private const STATUSES = ['Pending','Approved','In Progress','Completed','Rejected','Cancelled'];
    private const PRIORITIES = ['Low','Normal','High','Urgent'];

    public function index(Request $request): Response
    {
        $search = trim($request->string('search')->toString());
        $type = $request->string('type')->toString();
        $status = $request->string('status')->toString();
        $perPage = in_array((int) $request->integer('per_page'), [10,25,50,100], true) ? (int) $request->integer('per_page') : 25;

        $requests = ScanningKeepsafeRequest::query()
            ->with(['receivingRecord:id,receiving_number,title','requester:id,name','assignee:id,name'])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(fn ($q) => $q
                    ->where('request_number','like',$like)
                    ->orWhere('purpose','like',$like)
                    ->orWhereHas('receivingRecord', fn ($r) => $r
                        ->where('receiving_number','like',$like)
                        ->orWhere('title','like',$like)));
            })
            ->when(in_array($type,self::TYPES,true), fn ($query) => $query->where('request_type',$type))
            ->when(in_array($status,self::STATUSES,true), fn ($query) => $query->where('status',$status))
            ->latest('requested_at')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (ScanningKeepsafeRequest $item) => [
                'id'=>$item->id,'request_number'=>$item->request_number,'requested_at'=>$item->requested_at?->toIso8601String(),
                'request_type'=>$item->request_type,'purpose'=>$item->purpose,'priority'=>$item->priority,'status'=>$item->status,
                'due_at'=>$item->due_at?->toIso8601String(),'receiving_record'=>$item->receivingRecord,
                'requester'=>$item->requester,'assignee'=>$item->assignee,'show_url'=>route('scanning-keepsafe.show',$item),
            ]);

        return Inertia::render('ScanningKeepsafe/Index', [
            'requests'=>$requests,
            'filters'=>['search'=>$search,'type'=>$type,'status'=>$status,'per_page'=>$perPage],
            'types'=>self::TYPES,'statuses'=>self::STATUSES,'priorities'=>self::PRIORITIES,
            'receivingRecords'=>ReceivingRecord::query()->whereIn('status',['Received','For Registration','For Scanning','For Storage'])
                ->orderByDesc('received_at')->limit(500)->get(['id','receiving_number','title','status']),
            'users'=>User::query()->where('account_status','active')->orderBy('name')->get(['id','name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'receiving_record_id'=>['required','integer','exists:receiving_records,id'],
            'requested_at'=>['required','date'],
            'request_type'=>['required',Rule::in(self::TYPES)],
            'purpose'=>['nullable','string','max:5000'],
            'instructions'=>['nullable','string','max:5000'],
            'priority'=>['required',Rule::in(self::PRIORITIES)],
            'due_at'=>['nullable','date','after_or_equal:requested_at'],
            'assigned_to'=>['nullable','integer','exists:users,id'],
            'remarks'=>['nullable','string','max:5000'],
        ]);

        $receiving = ReceivingRecord::query()->findOrFail($validated['receiving_record_id']);
        if ($receiving->status === 'Completed') {
            return back()->withErrors(['receiving_record_id'=>'Completed receiving records cannot receive a new scanning/keepsafe request.']);
        }

        DB::transaction(function () use ($request,$validated) {
            $date = now()->format('Ymd');
            $prefix = 'SKR-'.$date.'-';
            $last = ScanningKeepsafeRequest::query()->where('request_number','like',$prefix.'%')->lockForUpdate()->orderByDesc('id')->value('request_number');
            $number = $prefix.str_pad((string)($last ? ((int)substr($last,-4))+1 : 1),4,'0',STR_PAD_LEFT);

            $record = ScanningKeepsafeRequest::query()->create([
                ...$validated,'request_number'=>$number,'requested_by'=>$request->user()->id,'status'=>'Pending',
            ]);
            $record->statusHistories()->create(['status'=>'Pending','changed_by'=>$request->user()->id,'notes'=>'Request created.']);

            ActivityLog::query()->create([
                'user_id'=>$request->user()->id,'event'=>'scanning_keepsafe.created',
                'auditable_type'=>ScanningKeepsafeRequest::class,'auditable_id'=>$record->id,
                'description'=>$record->request_type.' request created: '.$record->request_number,
                'new_values'=>['request_number'=>$record->request_number,'request_type'=>$record->request_type,'status'=>$record->status],
                'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent(),
            ]);
        });

        return back()->with('success','Scanning / Keepsafe request created successfully.');
    }

    public function show(ScanningKeepsafeRequest $scanningKeepsafeRequest): Response
    {
        $scanningKeepsafeRequest->load([
            'receivingRecord:id,receiving_number,title,document_type,status,priority,classification',
            'requester:id,name,email','assignee:id,name,email',
            'statusHistories'=>fn($q)=>$q->with('changer:id,name')->latest(),
        ]);

        return Inertia::render('ScanningKeepsafe/Show', [
            'record'=>$scanningKeepsafeRequest,
            'statusHistories'=>$scanningKeepsafeRequest->statusHistories->map(fn($h)=>[
                'id'=>$h->id,'status'=>$h->status,'notes'=>$h->notes,'created_at'=>$h->created_at?->toIso8601String(),'changed_by'=>$h->changer,
            ])->values(),
            'statuses'=>self::STATUSES,'users'=>User::query()->where('account_status','active')->orderBy('name')->get(['id','name']),
        ]);
    }

    public function update(Request $request, ScanningKeepsafeRequest $scanningKeepsafeRequest): RedirectResponse
    {
        $validated = $request->validate([
            'status'=>['required',Rule::in(self::STATUSES)],
            'assigned_to'=>['nullable','integer','exists:users,id'],
            'notes'=>['nullable','string','max:2000'],
        ]);

        if ($scanningKeepsafeRequest->status === $validated['status'] && (int)$scanningKeepsafeRequest->assigned_to === (int)($validated['assigned_to'] ?? 0)) {
            return back()->with('info','No workflow changes were made.');
        }

        DB::transaction(function () use ($request,$scanningKeepsafeRequest,$validated) {
            $oldStatus = $scanningKeepsafeRequest->status;
            $scanningKeepsafeRequest->update([
                'status'=>$validated['status'],
                'assigned_to'=>$validated['assigned_to'] ?? null,
                'completed_at'=>$validated['status'] === 'Completed' ? now() : null,
            ]);
            $note = $validated['notes'] ?? null;
            $scanningKeepsafeRequest->statusHistories()->create(['status'=>$validated['status'],'changed_by'=>$request->user()->id,'notes'=>$note]);
            ActivityLog::query()->create([
                'user_id'=>$request->user()->id,'event'=>'scanning_keepsafe.status_changed',
                'auditable_type'=>ScanningKeepsafeRequest::class,'auditable_id'=>$scanningKeepsafeRequest->id,
                'description'=>'Request workflow updated: '.$scanningKeepsafeRequest->request_number,
                'old_values'=>['status'=>$oldStatus],
                'new_values'=>['status'=>$validated['status'],'assigned_to'=>$validated['assigned_to'] ?? null,'notes'=>$note],
                'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent(),
            ]);
        });

        return back()->with('success','Scanning / Keepsafe request updated successfully.');
    }
}
