import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type RecordItem = { id:number; request_number:string; requested_at:string; request_type:string; purpose?:string; instructions?:string; priority:string; due_at?:string; status:string; completed_at?:string; remarks?:string; receiving_record?:{receiving_number:string;title:string;document_type:string;status:string;priority:string;classification:string}; requester?:{name:string;email?:string}; assignee?:{name:string;email?:string} };
type History = { id:number; status:string; notes?:string; created_at:string; changed_by?:{name:string} };
type User = { id:number; name:string };

export default function Show({record,statusHistories,statuses,users}:{record:RecordItem;statusHistories:History[];statuses:string[];users:User[]}) {
    const form=useForm({status:record.status,assigned_to:'',notes:''});
    const submit=(e:FormEvent)=>{e.preventDefault();form.patch(route('scanning-keepsafe.update',record.id),{onSuccess:()=>form.reset('notes')});};
    const field=(label:string,value?:string)=> <div><p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 text-sm text-stone-800">{value??'—'}</p></div>;
    return <AuthenticatedLayout title="Scanning / Keepsafe Request" breadcrumb="Records / Scanning / Keepsafe / Details" description="Request details, assignment, workflow status, and audit history.">
        <Head title={record.request_number}/>
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href={route('scanning-keepsafe.index')} className="text-sm font-semibold text-arms-green">← Back to Requests</Link><h1 className="mt-2 text-2xl font-semibold">{record.request_number}</h1></div><span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{record.status}</span></div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
                <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-lg font-semibold">Request Information</h2><div className="grid gap-5 sm:grid-cols-2">
                    {field('Request Type',record.request_type)}{field('Requested',new Date(record.requested_at).toLocaleString())}{field('Requester',record.requester?.name)}{field('Priority',record.priority)}{field('Due At',record.due_at?new Date(record.due_at).toLocaleString():undefined)}{field('Completed At',record.completed_at?new Date(record.completed_at).toLocaleString():undefined)}{field('Purpose',record.purpose)}{field('Instructions',record.instructions)}{field('Remarks',record.remarks)}
                </div></section>
                <div className="space-y-6">
                    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Linked Receiving Record</h2>{field('Receiving No.',record.receiving_record?.receiving_number)}{field('Title',record.receiving_record?.title)}{field('Document Type',record.receiving_record?.document_type)}{field('Receiving Status',record.receiving_record?.status)}{field('Classification',record.receiving_record?.classification)}</section>
                    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Update Workflow</h2><form onSubmit={submit} className="space-y-3"><select value={form.data.status} onChange={e=>form.setData('status',e.target.value)} className="w-full rounded-xl border-stone-300">{statuses.map(s=><option key={s}>{s}</option>)}</select><select value={form.data.assigned_to} onChange={e=>form.setData('assigned_to',e.target.value)} className="w-full rounded-xl border-stone-300"><option value="">Unassigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><textarea value={form.data.notes} onChange={e=>form.setData('notes',e.target.value)} placeholder="Optional workflow note" rows={3} className="w-full rounded-xl border-stone-300"/><button disabled={form.processing} className="w-full rounded-xl bg-arms-green px-4 py-2.5 font-semibold text-white disabled:opacity-50">Save Workflow Update</button></form></section>
                </div>
            </div>
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Status History</h2><div className="space-y-4">{statusHistories.map(h=><div key={h.id} className="border-l-2 border-emerald-200 pl-4"><p className="font-semibold text-sm">{h.status}</p><p className="text-xs text-stone-400">{new Date(h.created_at).toLocaleString()} · {h.changed_by?.name??'System'}</p>{h.notes&&<p className="mt-1 text-sm text-stone-600">{h.notes}</p>}</div>)}</div></section>
        </div>
    </AuthenticatedLayout>;
}
