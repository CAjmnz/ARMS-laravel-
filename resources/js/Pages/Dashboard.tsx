import ArmsIcon from '@/Components/ArmsIcon';
import { CategoryOverview, DashboardPanel, DashboardStatCard, MemberOverview, QuickAccess, RecentActivities, StorageOverview, type CategoryItem, type DashboardSummary, type MemberRoleItem, type QuickActionItem, type RecentActivityItem } from '@/Components/DashboardSections';
import { DocumentActivityChart } from '@/Components/DashboardCharts';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';

interface ActivityPoint {
    cumulative: number;
    label: string;
    uploads: number;
}
interface AccountDetails { department:string|null; employeeId:string; lastLoginAt:string|null; name:string; position:string|null; subsidiary:string|null }
interface PinnedItem { pin_id:number; kind:'folder'|'document'; type:string; file_type?:string; id:number; route_key:string; name:string; path:string; updated_at?:string|null; href:string; opens_viewer?:boolean; information_url?:string; is_pinned?:boolean }
interface DashboardPinPreview { kind:'folder'|'document'; name:string; type:string; size?:number|null; description?:string|null; path:string[]; created_at?:string|null; updated_at?:string|null; status?:string|null; children_count?:number|null; documents_count?:number|null; preview_url?:string|null; created_by?:{name:string}|null; modified_by?:{name:string}|null }
interface DashboardProps { account:AccountDetails; activity:ActivityPoint[]; greeting:string; lastLoginAt:string|null; summary:DashboardSummary; recentActivities:RecentActivityItem[]; pinnedItems:PinnedItem[]; topCategories:CategoryItem[]; storageBytes:number; memberRoles:MemberRoleItem[] }

function formatDateTime(value:string|null):string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
}

function currentDateLabel():string {
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());
}

type DashboardPinFilter = 'all'|'filenames'|'subfolders'|'documents';

const pinPathColors = ['#0b2417','#123b25','#18502f','#20643a','#287846','#318b52','#3b9b5d'];

function dashboardPinPathParts(item:PinnedItem):string[] {
    let parts = item.path.split('/').map(part=>part.trim()).filter(Boolean);

    if(item.kind==='document' && parts.length && parts[parts.length-1].toLowerCase()===item.name.trim().toLowerCase()) {
        parts = parts.slice(0,-1);
    }

    if(parts.length>5) parts = ['..', ...parts.slice(-5)];

    return parts;
}

function dashboardPinParent(item:PinnedItem):string|null {
    const parts = item.path.split('/').map(part=>part.trim()).filter(Boolean);
    if(item.kind==='document' && parts.length && parts[parts.length-1].toLowerCase()===item.name.trim().toLowerCase()) {
        parts.pop();
    }
    return parts.length>1 ? parts[parts.length-2] : null;
}

function DashboardPinnedItems({initialItems}:{initialItems:PinnedItem[]}) {
    const [search,setSearch] = useState('');
    const [filter,setFilter] = useState<DashboardPinFilter>('all');
    const [items,setItems] = useState<PinnedItem[]>(initialItems);
    const [loading,setLoading] = useState(false);
    const [previewItem,setPreviewItem] = useState<PinnedItem|null>(null);
    const [previewInfo,setPreviewInfo] = useState<DashboardPinPreview|null>(null);
    const [previewLoading,setPreviewLoading] = useState(false);
    const [previewPosition,setPreviewPosition] = useState({top:0,left:0});
    const hoverTimer = useRef<number|null>(null);
    const closeTimer = useRef<number|null>(null);
    const previewCache = useRef(new Map<number,DashboardPinPreview>());

    const cancelHoverTimer = () => {
        if(hoverTimer.current!==null){ window.clearTimeout(hoverTimer.current); hoverTimer.current=null; }
    };
    const cancelCloseTimer = () => {
        if(closeTimer.current!==null){ window.clearTimeout(closeTimer.current); closeTimer.current=null; }
    };
    const schedulePreviewClose = () => {
        cancelHoverTimer();
        cancelCloseTimer();
        closeTimer.current = window.setTimeout(()=>{ setPreviewItem(null); setPreviewInfo(null); },140);
    };
    const schedulePreview = (item:PinnedItem,event:ReactMouseEvent<HTMLElement>) => {
        cancelHoverTimer();
        cancelCloseTimer();
        if(!item.information_url) return;
        const rect = event.currentTarget.getBoundingClientRect();
        hoverTimer.current = window.setTimeout(async()=>{
            setPreviewPosition({
                top:Math.max(12,Math.min(rect.top,window.innerHeight-360)),
                left:Math.max(12,rect.left-324),
            });
            setPreviewItem(item);
            const cached = previewCache.current.get(item.pin_id);
            if(cached){ setPreviewInfo(cached); return; }
            setPreviewLoading(true);
            setPreviewInfo(null);
            try {
                const response = await fetch(item.information_url!,{headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'},credentials:'same-origin'});
                if(response.ok){
                    const payload = await response.json() as DashboardPinPreview;
                    previewCache.current.set(item.pin_id,payload);
                    setPreviewInfo(payload);
                }
            } finally {
                setPreviewLoading(false);
            }
        },1000);
    };

    useEffect(()=>{
        const timer = window.setTimeout(async()=>{
            setLoading(true);
            try {
                const params = new URLSearchParams({type:filter,limit:'25'});
                if(search.trim()) params.set('search',search.trim());
                const response = await fetch(`${route('documents.pins.index')}?${params.toString()}`,{headers:{Accept:'application/json'},credentials:'same-origin'});
                if(response.ok){
                    const payload = await response.json();
                    setItems(payload.items ?? []);
                }
            } finally {
                setLoading(false);
            }
        },180);
        return ()=>window.clearTimeout(timer);
    },[search,filter]);

    const folderLevels = Array.from(new Set(items.filter(item=>/^Subfolder\d+$/.test(item.type)).map(item=>Number(item.type.replace('Subfolder',''))).filter(level=>Number.isFinite(level)&&level>0))).sort((a,b)=>a-b);
    const order = ['Filename',...folderLevels.map(level=>`Subfolder${level}`),'Document'];
    const groups = order.map(label=>({label,items:items.filter(item=>item.type===label)})).filter(group=>group.items.length>0);

    return <div className="overflow-hidden rounded-xl border border-stone-100 bg-white">
        <div className="border-b border-stone-100 px-4 py-4">
            <label className="relative block">
                <ArmsIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search pinned items..." className="h-10 w-full rounded-xl border-stone-200 bg-white pl-9 pr-9 text-sm focus:border-arms-green focus:ring-arms-green" />
                {search&&<button type="button" onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">×</button>}
            </label>
            <div className="mt-3 flex flex-wrap gap-1 text-xs font-semibold">
                {([['all','All'],['filenames','Filenames'],['subfolders','Subfolders'],['documents','Documents']] as [DashboardPinFilter,string][]).map(([value,label])=><button key={value} type="button" onClick={()=>setFilter(value)} className={'rounded-lg px-3 py-1.5 transition '+(filter===value?'bg-emerald-50 text-arms-green':'text-stone-500 hover:bg-stone-50')}>{label}</button>)}
            </div>
        </div>

        <div className="max-h-[310px] overflow-y-auto bg-white">
            {loading?<div className="py-12 text-center text-sm text-stone-400">Loading pinned items…</div>:groups.length?groups.map(group=><section key={group.label}>
                <div className="sticky top-0 z-10 bg-white px-4 py-2 text-xs font-bold text-[#1f2d26]">{group.label}</div>
                {group.items.map(item=><div key={item.pin_id} onMouseEnter={(event)=>schedulePreview(item,event)} onMouseLeave={schedulePreviewClose} className="relative border-t border-stone-100">
                    <a href={item.href} className="group flex items-start gap-3 px-4 py-3 transition hover:bg-emerald-50/55">
                        <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef9f3] text-arms-green">
                            {item.kind==='folder'?<ArmsIcon name="folder" className="h-5 w-5" />:<span className="text-[9px] font-extrabold leading-none tracking-tight text-arms-green">{(item.file_type||'FILE').slice(0,4)}</span>}
                            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm"><ArmsIcon name="pin" className="h-3 w-3 fill-current text-red-500" /></span>
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="break-words text-sm font-semibold leading-5 text-[#173d32] group-hover:text-arms-green">{item.name}</span>
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">{item.type}</span>
                            </span>
                            {dashboardPinParent(item)&&<span className="mt-1 flex items-center gap-1.5 text-[10px] leading-4">
                                <span className="font-semibold uppercase tracking-wide text-stone-400">Parent</span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-[#123b25] ring-1 ring-inset ring-emerald-100">{dashboardPinParent(item)}</span>
                            </span>}
                            <span className="mt-1.5 block whitespace-normal break-words text-[10px] font-semibold leading-4">
                                {dashboardPinPathParts(item).map((part,index)=><span key={`${item.pin_id}-path-${index}`}>
                                    {index>0&&<span className="mx-1 text-stone-400">/</span>}
                                    <span style={{color:part==='..'?'#6b7280':pinPathColors[Math.min(index,pinPathColors.length-1)]}}>{part}</span>
                                </span>)}
                            </span>
                        </span>
                        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-lg leading-none text-stone-400 transition group-hover:bg-white group-hover:text-arms-green">⋮</span>
                    </a>
                </div>)}
            </section>):<div className="px-4 py-10 text-center text-sm text-stone-400">No pinned items found.</div>}
        </div>

        <div className="border-t border-stone-100 bg-white px-4 py-3 text-center"><Link href={route('documents.manage')+'?search=pin'} className="text-xs font-semibold text-arms-green hover:text-arms-dark">View all pinned items</Link></div>

        {previewItem&&<div
            onMouseEnter={cancelCloseTimer}
            onMouseLeave={schedulePreviewClose}
            style={{top:previewPosition.top,left:previewPosition.left}}
            className="fixed z-[120] w-[300px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
        >
            <div className="border-b border-stone-100 bg-[#f8fcfa] px-4 py-3">
                <div className="flex items-start gap-3">
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-arms-green">
                        {previewItem.kind==='folder'?<ArmsIcon name="folder" className="h-5 w-5" />:<span className="text-[9px] font-extrabold">{(previewItem.file_type||'FILE').slice(0,4)}</span>}
                        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm"><ArmsIcon name="pin" className="h-3 w-3 fill-current text-red-500" /></span>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold leading-5 text-[#173d32]">{previewItem.name}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{previewItem.type}</p>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {previewLoading?<div className="py-10 text-center text-xs text-stone-400">Loading preview…</div>:previewInfo?<>
                    {previewInfo.kind==='document'&&previewInfo.preview_url?<div className="mb-3 h-28 overflow-hidden rounded-xl border border-stone-200 bg-stone-50"><iframe title={`Preview ${previewInfo.name}`} src={previewInfo.preview_url} className="pointer-events-none h-full w-full border-0 bg-white" /></div>:<div className="mb-3 grid h-20 place-items-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 text-arms-green"><ArmsIcon name={previewInfo.kind==='folder'?'folder':'document'} className="h-8 w-8" /></div>}
                    {previewInfo.description&&<p className="mb-3 line-clamp-3 text-xs leading-5 text-stone-600">{previewInfo.description}</p>}
                    <dl className="grid grid-cols-[78px_1fr] gap-x-3 gap-y-2 text-[11px]">
                        <dt className="text-stone-400">Type</dt><dd className="font-medium text-stone-700">{previewInfo.type}</dd>
                        {previewInfo.kind==='folder'&&<><dt className="text-stone-400">Contents</dt><dd className="font-medium text-stone-700">{previewInfo.children_count??0} folders • {previewInfo.documents_count??0} documents</dd></>}
                        <dt className="text-stone-400">Updated</dt><dd className="font-medium text-stone-700">{previewInfo.updated_at?formatDateTime(previewInfo.updated_at):'—'}</dd>
                        <dt className="text-stone-400">Modified by</dt><dd className="font-medium text-stone-700">{previewInfo.modified_by?.name||'—'}</dd>
                    </dl>
                    <div className="mt-3 border-t border-stone-100 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Location</p>
                        <p className="mt-1 break-words text-[11px] leading-4 text-stone-600">{previewInfo.path.join(' / ')}</p>
                    </div>
                </>:<div className="py-8 text-center text-xs text-stone-400">Preview unavailable.</div>}
            </div>
            <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-center text-[10px] text-stone-400">Hover for 1 second to preview</div>
        </div>}
    </div>;
}

export default function Dashboard({account,activity,greeting,lastLoginAt,summary,recentActivities,pinnedItems,topCategories,storageBytes,memberRoles}:DashboardProps) {
    const { auth } = usePage().props;
    const [search,setSearch] = useState('');
    const quickActions = useMemo<QuickActionItem[]>(() => {
        const actions:QuickActionItem[] = [{label:'Document Management',description:'Browse records',icon:'document',href:route('documents.manage')}];
        if (auth.permissions.includes('documents.upload')) {
    actions.push({
        label: 'Upload Document',
        description: 'Choose a destination',
        icon: 'document',
        href: route('documents.manage'),
    });
}
        if (auth.permissions.includes('folders.manage')) actions.push({label:'Create Folder',description:'Build record structure',icon:'folder',href:route('documents.manage')});
        if (auth.permissions.includes('users.manage')) actions.push({label:'Manage Users',description:'Accounts and access',icon:'users',href:route('users.index')});
        if (auth.permissions.includes('system-settings.manage')) actions.push({label:'System Settings',description:'Configure ARMS',icon:'gear',href:route('system.index')});
        return actions.slice(0,5);
    },[auth.permissions]);

    const submitSearch = (event:FormEvent) => {
        event.preventDefault();
        const query = search.trim();
        if (query) router.get(route('documents.manage'),{search:query});
    };

    return <AuthenticatedLayout title="Dashboard">
        <Head title="Dashboard" />
        <main className="mx-auto max-w-[1680px] space-y-5 px-5 py-6 sm:px-8 lg:px-10">
            <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-arms-green-light">ARMS Dashboard</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-arms-dark sm:text-3xl">Welcome back, {account.name || 'Administrator'}!</h1>
                    <p className="mt-1 text-sm text-stone-500">{greeting}. Here&apos;s what&apos;s happening with your records today.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form onSubmit={submitSearch} className="relative min-w-0 sm:w-80">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"><ArmsIcon name="search" className="h-4 w-4" /></span>
                        <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search documents, folders..." className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                    </form>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-sm"><ArmsIcon name="clock" className="h-4 w-4 text-[]" /><span>{currentDateLabel()}</span></div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard summary">
                <DashboardStatCard icon="document" label="Total Documents" value={summary.documents} description="Current document records" />
                <DashboardStatCard icon="folder" label="Total Folders" value={summary.folders} description="Folders in the records hierarchy" />
                <DashboardStatCard icon="folder" label="Pending" value={summary.pending} description="Unpublished folders awaiting publication" />
                <DashboardStatCard icon="users" label="Total Users" value={summary.users} description="Registered system accounts" />
                <DashboardStatCard icon="users" label="Online Now" value={summary.online} description="Active in the last 15 minutes" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.85fr)]">
                <DashboardPanel title="Document Activity" action={<span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">Last 6 months</span>}><DocumentActivityChart activity={activity} /></DashboardPanel>
                <DashboardPanel title="Recent Activities"><RecentActivities items={recentActivities} formatDate={formatDateTime} /></DashboardPanel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
                <DashboardPanel title="Quick Access"><QuickAccess actions={quickActions} /></DashboardPanel>
                <DashboardPanel title="Pinned Items" action={<Link href={route('documents.manage') + '?search=pin'} className="text-xs font-semibold text-arms-green hover:text-arms-dark">View all</Link>}>
                    <DashboardPinnedItems initialItems={pinnedItems} />
                </DashboardPanel>
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
                <DashboardPanel title="Top Document Categories"><CategoryOverview categories={topCategories} /></DashboardPanel>
                <DashboardPanel title="Storage Overview"><StorageOverview bytes={storageBytes} /></DashboardPanel>
                <DashboardPanel title="Member Overview"><MemberOverview roles={memberRoles} /></DashboardPanel>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-xs text-stone-500 shadow-sm">
                <span>Last login: <strong className="font-semibold text-[#173d32]">{formatDateTime(lastLoginAt)}</strong></span>
                <span>{account.department || 'No department'} · {account.subsidiary || 'No subsidiary'}</span>
            </section>
        </main>
    </AuthenticatedLayout>;
}
