import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type RecordItem = {
    id:number; receiving_number:string; received_at:string; sender_name:string; requesting_office?:string;
    title:string; document_type:string; page_count?:number; copy_count:number; physical_status:string;
    digital_copy_status:string; purpose?:string; priority:string; classification:string; barcode?:string;
    initial_condition?:string; remarks?:string; status:string; receiver?:{name:string}; subsidiary?:{name:string};
    department?:{name:string};
};
type History = { id:number; status:string; notes?:string; created_at:string; changed_by?:{name:string} };

export default function Show({record,statusHistories,statuses}:{record:RecordItem;statusHistories:History[];statuses:string[]}) {
    const form=useForm({status:record.status,notes:''});
    const submit=(e:FormEvent)=>{e.preventDefault();form.patch(route('receiving.status',record.id),{onSuccess:()=>form.reset('notes')});};
    const field=(label:string,value?:string|number)=> <div><p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 text-sm text-stone-800">{value ?? '—'}</p></div>;
    return <AuthenticatedLayout title="Receiving Record" breadcrumb="Records / Receiving / Details" description="Receiving record, current workflow status, and audit history.">
        <Head title={record.receiving_number}/>
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href={route('receiving.index')} className="text-sm font-semibold text-arms-green">← Back to Receiving</Link><h1 className="mt-2 text-2xl font-semibold">{record.receiving_number}</h1></div><span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{record.status}</span></div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
                <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-lg font-semibold">Record Information</h2><div className="grid gap-5 sm:grid-cols-2">{field('Received',new Date(record.received_at).toLocaleString())}{field('Received By',record.receiver?.name)}{field('Sender',record.sender_name)}{field('Requesting Office',record.requesting_office)}{field('Title',record.title)}{field('Document Type',record.document_type)}{field('Pages',record.page_count)}{field('Copies',record.copy_count)}{field('Physical Status',record.physical_status)}{field('Digital Copy',record.digital_copy_status)}{field('Priority',record.priority)}{field('Classification',record.classification)}{field('Subsidiary',record.subsidiary?.name)}{field('Department',record.department?.name)}{field('Barcode / Reference',record.barcode)}{field('Initial Condition',record.initial_condition)}{field('Purpose',record.purpose)}{field('Remarks',record.remarks)}</div></section>
                <div className="space-y-6">
                    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Update Workflow Status</h2><form onSubmit={submit} className="space-y-3"><select value={form.data.status} onChange={e=>form.setData('status',e.target.value)} className="w-full rounded-xl border-stone-300">{statuses.map(s=><option key={s}>{s}</option>)}</select><textarea value={form.data.notes} onChange={e=>form.setData('notes',e.target.value)} placeholder="Optional handoff note" rows={3} className="w-full rounded-xl border-stone-300"/><button disabled={form.processing} className="w-full rounded-xl bg-arms-green px-4 py-2.5 font-semibold text-white disabled:opacity-50">Update Status</button></form></section>
                    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Status History</h2><div className="space-y-4">{statusHistories.map(h=><div key={h.id} className="border-l-2 border-emerald-200 pl-4"><p className="font-semibold text-sm">{h.status}</p><p className="text-xs text-stone-400">{new Date(h.created_at).toLocaleString()} · {h.changed_by?.name ?? 'System'}</p>{h.notes&&<p className="mt-1 text-sm text-stone-600">{h.notes}</p>}</div>)}</div></section>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>;
}
