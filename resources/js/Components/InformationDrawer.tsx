import ArmsIcon from '@/Components/ArmsIcon';
import { useEffect, useMemo, useState } from 'react';

type Person = { id:number; name:string; email?:string|null; position?:string|null } | null;
type Activity = { id:number; event:string; description:string; created_at?:string|null; actor:Person; item_name?:string|null; parent_name?:string|null; path?:string[]|null; target_user_name?:string|null; old_name?:string|null; new_name?:string|null };
type Access = { user:Person; role:string; department?:string|null; source:string; can_download:boolean; can_upload:boolean; granted_by?:Person; granted_at?:string|null };
type UserResult = { id:number; name:string; employee_id?:string|null; email?:string|null; department?:string|null; role:string };
type Info = { kind:'folder'|'document'; name:string; type:string; mime_type?:string|null; size?:number|null; description?:string|null; path:string[]; organization?:OrganizationInfo; created_at?:string|null; created_by:Person; uploaded_by?:Person; updated_at?:string|null; modified_by:Person; status?:string|null; version?:number|null; children_count?:number|null; documents_count?:number|null; preview_url?:string|null; activity:Activity[]; access:Access[]; can_manage_access?:boolean; access_user_search_url?:string|null; access_grant_url?:string|null; access_remove_base_url?:string|null };
type OrganizationInfo = { subsidiary?:string|null; division?:string|null; subdivision?:string|null; location?:string|null; groups?:string[]; department?:string|null };

const when = (value?:string|null) => value ? new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)) : '—';
const size = (bytes?:number|null) => { if (!bytes) return '—'; const units=['B','KB','MB','GB']; let value=bytes, unit=0; while(value>=1024&&unit<units.length-1){value/=1024;unit++;} return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`; };
const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

export default function InformationDrawer({ target, onClose }:{ target:{name:string;url:string;kind:'folder'|'document'}|null; onClose:()=>void }) {
    const [tab,setTab]=useState<'details'|'activity'|'access'>('details');
    const [data,setData]=useState<Info|null>(null);
    const [error,setError]=useState('');
    const [reload,setReload]=useState(0);
    useEffect(()=>{ if(!target)return; setData(null); setError(''); setTab('details'); const controller=new AbortController(); fetch(target.url,{headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},credentials:'same-origin',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error(r.status===403?'You no longer have access to this item.':'Unable to load information.'); return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message)}); return()=>controller.abort(); },[target,reload]);
    if(!target)return null;
    return <aside className="fixed inset-y-0 right-0 z-[95] flex w-full max-w-[450px] flex-col border-l border-stone-200 bg-white shadow-2xl">
        <header className="flex h-14 items-center justify-between border-b border-stone-200 px-5"><h2 className="flex items-center gap-2 text-base font-semibold text-stone-900"><span className="grid h-6 w-6 place-items-center rounded-full border border-stone-500 text-xs">i</span>Information</h2><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-2xl text-stone-600 hover:bg-stone-100" aria-label="Close information">×</button></header>
        <div className="border-b border-stone-200 px-6 py-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name={target.kind==='folder'?'folder':'document'} className="h-6 w-6" /></span><div className="min-w-0"><p className="break-words font-semibold text-stone-900">{data?.name||target.name}</p><p className="text-xs text-stone-500">{data ? `${data.type}${data.kind==='folder' ? ` • ${data.children_count??0} subfolders • ${data.documents_count??0} documents` : data.size ? ` • ${size(data.size)}`:''}` : 'Loading information...'}</p></div></div></div>
        <nav className="grid grid-cols-3 border-b border-stone-200">{(['details','activity','access'] as const).map(item=><button key={item} onClick={()=>setTab(item)} className={'border-b-2 px-3 py-3 text-sm font-medium capitalize '+(tab===item?'border-arms-green text-arms-green':'border-transparent text-stone-600 hover:bg-stone-50')}>{item}</button>)}</nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{error?<div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>:!data?<div className="py-12 text-center text-sm text-stone-500">Loading details...</div>:tab==='details'?<Details data={data}/>:tab==='activity'?<ActivityTab items={data.activity}/>:<AccessTab data={data} onChanged={()=>setReload(v=>v+1)}/>}</div>
    </aside>;
}

function Details({data}:{data:Info}) { return <div className="space-y-6">{data.kind==='document'&&data.preview_url&&<div className="h-44 overflow-hidden rounded-xl border border-stone-200 bg-stone-50"><iframe title={'Preview '+data.name} src={data.preview_url} className="pointer-events-none h-full w-full border-0 bg-white" /></div>}{data.description&&<section><h3 className="text-sm font-semibold text-stone-900">Description</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-stone-600">{data.description}</p></section>}<section><h3 className="mb-3 text-sm font-semibold text-stone-900">Organization Information</h3><div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50"><dl className="divide-y divide-stone-200 text-sm">
                <InfoRow label="Subsidiary" value={data.organization?.subsidiary} />
                <InfoRow label="Division" value={data.organization?.division} />
                <InfoRow label="Sub-Division" value={data.organization?.subdivision} />
                <InfoRow label="Location" value={data.organization?.location} />
                <InfoRow label="Group Consolidated FS" value={data.organization?.groups?.length ? data.organization.groups.join(', ') : null} />
                <InfoRow label="Department" value={data.organization?.department} />
            </dl></div></section><section><h3 className="mb-3 text-sm font-semibold text-stone-900">Details</h3><dl className="grid grid-cols-[105px_1fr] gap-x-3 gap-y-3 text-sm"><dt className="text-stone-500">Type</dt><dd>{data.type}</dd>{data.kind==='document'&&<><dt className="text-stone-500">Size</dt><dd>{size(data.size)}</dd></>}<dt className="text-stone-500">Location</dt><dd className="min-w-0">{data.path.map((part,index)=><span key={index} className="inline break-words text-stone-700">{index>0&&<span className="px-1 text-stone-400">›</span>}{part}</span>)}</dd><dt className="text-stone-500">Created</dt><dd>{when(data.created_at)}</dd><dt className="text-stone-500">Created by</dt><dd><PersonLine person={data.created_by}/></dd>{data.uploaded_by&&<><dt className="text-stone-500">Uploaded by</dt><dd><PersonLine person={data.uploaded_by}/></dd></>}<dt className="text-stone-500">Last modified</dt><dd>{when(data.updated_at)}</dd><dt className="text-stone-500">Modified by</dt><dd><PersonLine person={data.modified_by}/></dd>{data.status&&<><dt className="text-stone-500">Status</dt><dd>{data.status}</dd></>}{data.version&&<><dt className="text-stone-500">Version</dt><dd>{data.version}</dd></>}</dl></section></div> }

function InfoRow({label,value}:{label:string;value?:string|null}) {
    return <div className="grid grid-cols-[145px_1fr] gap-3 px-4 py-3">
        <dt className="font-medium text-stone-500">{label}</dt>
        <dd className="min-w-0 break-words text-stone-800">{value || '—'}</dd>
    </div>;
}

function ActivityTab({items}:{items:Activity[]}) {
    const [search,setSearch]=useState('');
    const [filter,setFilter]=useState('all');
    const filtered=useMemo(()=>items.filter(item=>{ const text=`${item.actor?.name??''} ${item.event} ${item.description} ${item.item_name??''} ${(item.path??[]).join(' ')}`.toLowerCase(); const matches=!search.trim()||text.includes(search.trim().toLowerCase()); const type=filter==='all'||item.event.startsWith(filter+'.')||item.event===filter; return matches&&type; }),[items,search,filter]);
    const groups=useMemo(()=>groupActivity(filtered),[filtered]);
    return <div>
        <div className="mb-6 grid grid-cols-[125px_1fr] gap-2">
            <select value={filter} onChange={e=>setFilter(e.target.value)} className="h-10 rounded-xl border-stone-200 text-xs"><option value="all">All activity</option><option value="folder">Folders</option><option value="document">Documents</option><option value="access">Access</option><option value="pin">Pins</option></select>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search activity..." className="h-10 rounded-xl border-stone-200 text-sm"/>
        </div>
        {!filtered.length?<Empty title="No recorded activity" text="Only real ARMS audit events are shown here."/>:<div className="space-y-8">{groups.map(group=><section key={group.label}>
            <h3 className="mb-5 text-[17px] font-semibold text-[#242424]">{group.label}</h3>
            <div className="space-y-8">{group.items.map(item=>{
                const path=item.path??[];
                const itemName=item.item_name || item.new_name || item.old_name || path[path.length-1] || 'Item';
                const ancestors=path.filter(part=>part&&part!==itemName);
                const isDocument=item.event.startsWith('document.');
                return <article key={item.id} className="grid grid-cols-[46px_1fr] gap-3">
                    <AvatarLarge person={item.actor}/>
                    <div className="min-w-0 pt-0.5">
                        <p className="text-[15px] leading-5 text-[#262626]"><span className="font-semibold">{item.actor?.name||'System'}</span> {activityAction(item)}</p>
                        <time className="mt-0.5 block text-[13px] text-stone-500">{dateTimeLong(item.created_at)}</time>
                        <div className="mt-3 space-y-2">
                            <ActivityChip name={itemName} document={isDocument} />
                            {ancestors.length>0&&<div className="relative ml-5 border-l border-stone-300 pl-5 before:absolute before:-left-px before:top-0 before:h-4 before:w-5 before:border-b before:border-stone-300">
                                <div className="flex flex-wrap gap-2 pt-2">{ancestors.map((part,index)=><ActivityChip key={`${item.id}-path-${index}`} name={part} compact />)}</div>
                            </div>}
                        </div>
                    </div>
                </article>})}</div>
        </section>)}</div>}
    </div>
}

function AccessTab({data,onChanged}:{data:Info;onChanged:()=>void}) {
    const [search,setSearch]=useState('');
    const [users,setUsers]=useState<UserResult[]>([]);
    const [loading,setLoading]=useState(false);
    const [busy,setBusy]=useState<number|null>(null);
    useEffect(()=>{ if(!data.can_manage_access||!data.access_user_search_url){setUsers([]);return;} if(!search.trim()){setUsers([]);return;} const timer=window.setTimeout(async()=>{setLoading(true);try{const response=await fetch(`${data.access_user_search_url}?search=${encodeURIComponent(search.trim())}`,{headers:{Accept:'application/json'},credentials:'same-origin'});if(response.ok){const payload=await response.json();setUsers(payload.items??[]);}}finally{setLoading(false);}},180);return()=>window.clearTimeout(timer);},[search,data.can_manage_access,data.access_user_search_url]);
    const grant=async(user:UserResult)=>{if(!data.access_grant_url)return;setBusy(user.id);try{const response=await fetch(data.access_grant_url,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf()},body:JSON.stringify({user_id:user.id})});if(response.ok){setSearch('');setUsers([]);onChanged();}}finally{setBusy(null)}};
    const remove=async(item:Access)=>{if(!data.access_remove_base_url||!item.user)return;const url=data.access_remove_base_url.replace('__USER__',String(item.user.id));setBusy(item.user.id);try{const response=await fetch(url,{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json','X-CSRF-TOKEN':csrf()}});if(response.ok)onChanged();}finally{setBusy(null)}};
    return <div><h3 className="mb-4 text-base font-semibold text-stone-900">Who has access</h3>{data.can_manage_access&&<div className="relative mb-5"><div className="flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users by name, ID or department..." className="h-10 min-w-0 flex-1 rounded-xl border-stone-200 text-sm"/><button type="button" disabled={!search.trim()} className="rounded-xl bg-arms-green px-4 text-sm font-semibold text-white disabled:opacity-40">+ Add</button></div>{search.trim()&&<div className="absolute left-0 right-0 top-11 z-20 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">{loading?<p className="p-4 text-center text-xs text-stone-400">Searching users…</p>:users.length?users.map(user=><div key={user.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-emerald-50"><Avatar person={{id:user.id,name:user.name,email:user.email}}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-stone-500">{user.employee_id} • {user.role}{user.department?` • ${user.department}`:''}</p></div><button type="button" disabled={busy===user.id} onClick={()=>grant(user)} className="rounded-lg bg-arms-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Grant</button></div>):<p className="p-4 text-center text-xs text-stone-400">No users found.</p>}</div>}</div>}{!data.access.length?<Empty title="No direct access assignments" text="Higher-level role access may still apply through the existing ARMS authorization rules."/>:<div className="space-y-4">{data.access.map((item,index)=><article key={`${item.user?.id}-${item.source}-${index}`} className="flex gap-3 border-b border-stone-100 pb-4 last:border-0"><Avatar person={item.user}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-stone-900">{item.user?.name}</p><p className="break-words text-xs text-stone-500">{item.role}{item.department?` • ${item.department}`:''}</p><p className="mt-1 text-xs text-arms-green">{item.source}</p>{item.granted_by&&<p className="mt-1 text-[11px] text-stone-400">Added by {item.granted_by.name}{item.granted_at?` • ${when(item.granted_at)}`:''}</p>}</div><div className="text-right"><span className="block text-xs text-stone-500">{item.can_upload?'Uploader':item.can_download?'Viewer + download':'Viewer'}</span>{data.can_manage_access&&item.source.startsWith('Direct')&&<button type="button" disabled={busy===item.user?.id} onClick={()=>remove(item)} className="mt-2 text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-40">Remove</button>}</div></article>)}</div>}</div>
}

function groupActivity(items:Activity[]) {
    const now=new Date();
    const thisYear=now.getFullYear();
    const buckets=new Map<string,Activity[]>();
    items.forEach(item=>{
        const date=item.created_at?new Date(item.created_at):new Date(0);
        let label='Earlier';
        const today=new Date(now); today.setHours(0,0,0,0);
        const yesterday=new Date(today); yesterday.setDate(yesterday.getDate()-1);
        const week=new Date(today); week.setDate(week.getDate()-7);
        if(date>=today) label='Today';
        else if(date>=yesterday) label='Yesterday';
        else if(date>=week) label='This week';
        else if(date.getFullYear()===thisYear) label='Earlier this year';
        else if(date.getFullYear()===thisYear-1) label='Last year';
        else label=String(date.getFullYear());
        if(!buckets.has(label)) buckets.set(label,[]);
        buckets.get(label)!.push(item);
    });
    return Array.from(buckets.entries()).map(([label,groupItems])=>({label,items:groupItems}));
}
const dateTimeLong=(value?:string|null)=>value?new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'—';
function activityAction(item:Activity) {
    if(item.event==='folder.created'||item.event==='folder.root_created') return 'created a folder';
    if(item.event==='folder.renamed') return 'renamed a folder';
    if(item.event==='folder.moved') return 'moved a folder';
    if(item.event==='folder.published') return 'published a folder';
    if(item.event==='folder.unpublished') return 'unpublished a folder';
    if(item.event==='document.uploaded') return 'uploaded a document';
    if(item.event==='document.renamed'||item.event==='document.updated') return 'updated a document';
    if(item.event==='document.moved') return 'moved a document';
    if(item.event.includes('downloaded')) return 'downloaded a document';
    if(item.event==='document.viewed') return 'viewed a document';
    if(item.event==='pin.created') return 'pinned an item';
    if(item.event==='pin.removed') return 'unpinned an item';
    if(item.event==='access.granted') return `granted access${item.target_user_name?` to ${item.target_user_name}`:''}`;
    if(item.event==='access.removed') return `removed access${item.target_user_name?` from ${item.target_user_name}`:''}`;
    return item.description ? item.description.replace(/^\s*[A-Z][^ ]*\s*/,'') : item.event.replace(/[._]/g,' ');
}
function ActivityChip({name,document=false,compact=false}:{name:string;document?:boolean;compact?:boolean}) { return <span className={'inline-flex max-w-full items-center gap-2 rounded-lg border border-stone-300 bg-white text-[#2c2c2c] shadow-sm '+(compact?'px-3 py-1.5 text-[13px]':'px-3 py-2 text-sm')}><ArmsIcon name={document?'document':'folder'} className={'shrink-0 '+(document?'h-4 w-4 text-blue-600':'h-4 w-4 text-amber-500')} /><span className="truncate">{name}</span></span> }
function PersonLine({person}:{person:Person}) { return person?<span><span className="font-medium text-stone-800">{person.name}</span>{person.email&&<span className="block break-all text-xs text-stone-500">{person.email}</span>}</span>:<span>—</span> }
function Avatar({person}:{person:Person}) { return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-arms-green">{person?.name?.split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'S'}</span> }
function AvatarLarge({person}:{person:Person}) { return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-stone-200 text-sm font-bold text-arms-green ring-1 ring-stone-200">{person?.name?.split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'S'}</span> }
function Empty({title,text}:{title:string;text:string}) { return <div className="py-12 text-center"><p className="font-semibold text-stone-700">{title}</p><p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">{text}</p></div> }
