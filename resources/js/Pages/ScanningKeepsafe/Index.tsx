import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type Receiving = { id:number; receiving_number:string; title:string; status:string };
type User = { id:number; name:string };
type Item = { id:number; request_number:string; requested_at:string; request_type:string; purpose?:string; priority:string; status:string; due_at?:string; receiving_record?:Receiving; requester?:User; assignee?:User; show_url:string };
type Page<T> = { data:T[]; current_page:number; last_page:number; from:number|null; to:number|null; total:number; links:{url:string|null;label:string;active:boolean}[] };

export default function Index({requests,filters,types,statuses,priorities,receivingRecords,users}:{requests:Page<Item>;filters:{search:string;type:string;status:string;per_page:number};types:string[];statuses:string[];priorities:string[];receivingRecords:Receiving[];users:User[]}) {
    const [open,setOpen]=useState(false);
    const form=useForm({receiving_record_id:'',requested_at:new Date().toISOString().slice(0,16),request_type:'Scanning',purpose:'',instructions:'',priority:'Normal',due_at:'',assigned_to:'',remarks:''});
    const selected=useMemo(()=>receivingRecords.find(r=>String(r.id)===form.data.receiving_record_id),[receivingRecords,form.data.receiving_record_id]);
    const submit=(e:FormEvent)=>{e.preventDefault();form.post(route('scanning-keepsafe.store'),{onSuccess:()=>{form.reset();setOpen(false);}})};
    return <AuthenticatedLayout title="Scanning / Keepsafe" breadcrumb="Records / Scanning / Keepsafe" description="Request controlled scanning or physical keepsafe handling for received records.">
        <Head title="Scanning / Keepsafe"/>
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold text-arms-dark">Scanning / Keepsafe</h1><p className="mt-1 text-sm text-stone-500">Track requests from creation through completion.</p></div><button onClick={()=>setOpen(true)} className="rounded-xl bg-arms-green px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#022f24]">+ New Request</button></div>
            <form method="get" className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_170px_180px_100px]">
                <input name="search" defaultValue={filters.search} placeholder="Search request no., receiving no., title..." className="rounded-xl border-stone-300 text-sm"/>
                <select name="type" defaultValue={filters.type} className="rounded-xl border-stone-300 text-sm"><option value="">All types</option>{types.map(t=><option key={t}>{t}</option>)}</select>
                <select name="status" defaultValue={filters.status} className="rounded-xl border-stone-300 text-sm"><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
                <button className="rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-semibold">Search</button>
            </form>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>
                    <th className="px-5 py-4">Request No.</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Receiving</th><th className="px-5 py-4">Requested</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Assigned To</th><th className="px-5 py-4"></th>
                </tr></thead><tbody className="divide-y divide-stone-100">{requests.data.map(item=><tr key={item.id} className="hover:bg-stone-50">
                    <td className="px-5 py-4 font-semibold text-arms-green">{item.request_number}</td><td className="px-5 py-4">{item.request_type}</td><td className="px-5 py-4"><div className="font-medium">{item.receiving_record?.receiving_number}</div><div className="text-xs text-stone-500">{item.receiving_record?.title}</div></td><td className="px-5 py-4 whitespace-nowrap">{new Date(item.requested_at).toLocaleString()}</td><td className="px-5 py-4">{item.priority}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{item.status}</span></td><td className="px-5 py-4">{item.assignee?.name ?? 'Unassigned'}</td><td className="px-5 py-4"><Link href={item.show_url} className="font-semibold text-arms-green hover:underline">View</Link></td>
                </tr>)}</tbody></table></div>
                {requests.data.length===0&&<div className="p-12 text-center text-sm text-stone-500">No scanning / keepsafe requests found.</div>}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 text-sm text-stone-500"><span>{requests.from??0}–{requests.to??0} of {requests.total}</span><div className="flex gap-1">{requests.links.map((link,i)=>link.url?<Link key={i} href={link.url} preserveScroll className={`rounded-lg px-3 py-1.5 ${link.active?'bg-arms-green text-white':'hover:bg-stone-100'}`} dangerouslySetInnerHTML={{__html:link.label}}/>:null)}</div></div>
            </div>
        </div>
        {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">New Scanning / Keepsafe Request</h2><p className="text-sm text-stone-500">Create a controlled request linked to a receiving record.</p></div><button type="button" onClick={()=>setOpen(false)} className="text-xl text-stone-400">×</button></div>
            <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium md:col-span-2"><span>Receiving Record</span><select required value={form.data.receiving_record_id} onChange={e=>form.setData('receiving_record_id',e.target.value)} className="w-full rounded-xl border-stone-300"><option value="">Select received record</option>{receivingRecords.map(r=><option key={r.id} value={r.id}>{r.receiving_number} — {r.title} ({r.status})</option>)}</select>{selected&&<span className="text-xs text-stone-500">Selected: {selected.title}</span>}</label>
                {[['requested_at','Requested At','datetime-local'],['due_at','Due At','datetime-local']].map(([name,label,type])=><label key={name} className="space-y-1 text-sm font-medium"><span>{label}</span><input type={type} value={(form.data as any)[name]} onChange={e=>form.setData(name as any,e.target.value)} className="w-full rounded-xl border-stone-300"/></label>)}
                <label className="space-y-1 text-sm font-medium"><span>Request Type</span><select value={form.data.request_type} onChange={e=>form.setData('request_type',e.target.value)} className="w-full rounded-xl border-stone-300">{types.map(t=><option key={t}>{t}</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium"><span>Priority</span><select value={form.data.priority} onChange={e=>form.setData('priority',e.target.value)} className="w-full rounded-xl border-stone-300">{priorities.map(p=><option key={p}>{p}</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium"><span>Assigned To</span><select value={form.data.assigned_to} onChange={e=>form.setData('assigned_to',e.target.value)} className="w-full rounded-xl border-stone-300"><option value="">Unassigned</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                {['purpose','instructions','remarks'].map(name=><label key={name} className="space-y-1 text-sm font-medium md:col-span-2"><span>{name.replaceAll('_',' ')}</span><textarea value={(form.data as any)[name]} onChange={e=>form.setData(name as any,e.target.value)} rows={3} className="w-full rounded-xl border-stone-300"/></label>)}
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 font-semibold">Cancel</button><button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2.5 font-semibold text-white disabled:opacity-50">Save Request</button></div>
        </form></div>}
    </AuthenticatedLayout>;
}
