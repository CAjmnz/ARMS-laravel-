import ArmsIcon from '@/Components/ArmsIcon';
import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

type PinType = 'all' | 'filenames' | 'subfolders' | 'documents';

const pinPathColors = ['#0b2417','#123b25','#18502f','#20643a','#287846','#318b52','#3b9b5d'];

function pinPathParts(item: PinnedItem): string[] {
    let parts = item.path.split('/').map((part) => part.trim()).filter(Boolean);
    if (item.kind === 'document' && parts.length && parts[parts.length - 1].toLowerCase() === item.name.trim().toLowerCase()) parts = parts.slice(0, -1);
    if (parts.length > 5) parts = ['..', ...parts.slice(-5)];
    return parts;
}

function pinParent(item: PinnedItem): string | null {
    const parts = item.path.split('/').map((part) => part.trim()).filter(Boolean);
    if (item.kind === 'document' && parts.length && parts[parts.length - 1].toLowerCase() === item.name.trim().toLowerCase()) parts.pop();
    return parts.length > 1 ? parts[parts.length - 2] : null;
}

interface PinnedItem {
    pin_id: number;
    kind: 'folder' | 'document';
    type: string;
    id: number;
    route_key: string;
    name: string;
    path: string;
    href: string;
    opens_viewer?: boolean;
    file_type?: string;
    information_url?: string;
}

export default function PinnedItemsDropdown({ count, onInformation }: { count: number; onInformation?: (target:{name:string;url:string;kind:'folder'|'document'})=>void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [type, setType] = useState<PinType>('all');
    const [items, setItems] = useState<PinnedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionOpen, setActionOpen] = useState<number|null>(null);
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleDropdownOpen = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== 'pinned-items') {
                setOpen(false);
                setActionOpen(null);
            }
        };
        const close = (event: MouseEvent) => {
            if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        window.addEventListener('keydown', escape);
        window.addEventListener('arms:dropdown-open', handleDropdownOpen);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', escape);
            window.removeEventListener('arms:dropdown-open', handleDropdownOpen);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ type, limit: '25' });
                if (search.trim()) params.set('search', search.trim());
                const response = await fetch(`${route('documents.pins.index')}?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });
                if (response.ok) {
                    const payload = await response.json();
                    setItems(payload.items ?? []);
                }
            } finally {
                setLoading(false);
            }
        }, 180);
        return () => window.clearTimeout(timer);
    }, [open, search, type]);

    const folderLevels = Array.from(new Set(items
        .filter((item) => /^Subfolder\d+$/.test(item.type))
        .map((item) => Number(item.type.replace('Subfolder', '')))
        .filter((level) => Number.isFinite(level) && level > 0)))
        .sort((left, right) => left - right);
    const levelOrder = ['Filename', ...folderLevels.map((level) => `Subfolder${level}`), 'Document'];
    const groupedItems = levelOrder
        .map((label) => ({ label, items: items.filter((item) => item.type === label) }))
        .filter((group) => group.items.length > 0);

    const openPinnedItem = (event: React.MouseEvent<HTMLAnchorElement>, item: PinnedItem) => {
        setOpen(false);
        setActionOpen(null);

        // Documents must perform a full browser navigation so Manage Documents
        // receives open_document, loads the containing folder, then opens the
        // existing document View modal. Closing that modal leaves the user in
        // the containing folder.
        if (item.kind === 'document') {
            event.preventDefault();
            window.location.assign(item.href);
        }
    };

    return <div ref={wrapper} className="relative min-w-[170px]">
        <button
            type="button"
            onClick={() => {
                const nextOpen = !open;
                if (nextOpen) {
                    window.dispatchEvent(
                        new CustomEvent('arms:dropdown-open', {
                            detail: 'pinned-items',
                        }),
                    );
                }
                setOpen(nextOpen);
            }}
            aria-expanded={open}
            className={'group flex min-h-[68px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-2 text-left shadow-[0_4px_14px_rgba(6,59,45,0.05)] transition ' + (open ? 'border-[#0a865e] ring-2 ring-emerald-100' : 'border-[#d7e7df] hover:border-[#98ccb7]')}
        >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-arms-green">
                <ArmsIcon name="pin" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
                <strong className="block text-xl font-bold leading-none text-[#073d2f]">{count.toLocaleString()}</strong>
                <span className="mt-1 block truncate text-[11px] font-medium text-stone-600">Pinned items</span>
            </span>
        </button>

        {open && <>
            <span className="absolute left-1/2 top-[62px] z-[91] h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-stone-200 bg-white" />
            <div className="absolute right-0 top-[76px] z-[90] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                <div className="border-b border-stone-100 bg-white px-4 pb-3 pt-4">
                    <div className="flex items-center justify-between gap-4">
                        <h3 className="font-semibold text-[#073d2f]">Pinned Items</h3>
                        <span className="text-xs text-stone-400">Your shortcuts</span>
                    </div>
                    <label className="relative mt-3 block">
                        <ArmsIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pinned items..." className="h-10 w-full rounded-xl border-stone-200 bg-stone-50 pl-9 pr-9 text-sm focus:border-arms-green focus:bg-white focus:ring-arms-green" />
                        {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">×</button>}
                    </label>
                    <div className="mt-3 flex flex-wrap gap-1 text-xs font-semibold">
                        {([['all','All'],['filenames','Filenames'],['subfolders','Subfolders'],['documents','Documents']] as [PinType,string][]).map(([value,label]) => <button key={value} type="button" onClick={() => setType(value)} className={'rounded-lg px-3 py-1.5 transition ' + (type === value ? 'bg-emerald-50 text-arms-green' : 'text-stone-500 hover:bg-stone-50')}>{label}</button>)}
                    </div>
                </div>
                <div className="max-h-[270px] overflow-y-auto bg-white p-0 [scrollbar-gutter:stable]">
                    {loading ? <div className="py-10 text-center text-sm text-stone-400">Loading pinned items…</div> : groupedItems.length ? groupedItems.map((group) => <section key={group.label} className="last:mb-0">
                        <div className="sticky top-0 z-10 border-b border-stone-50 bg-white px-4 py-2 text-[12px] font-bold text-[#1f2d26]">{group.label}</div>
                        {group.items.map((item) => <div key={item.pin_id} className="relative flex items-start gap-2 border-b border-stone-100 px-4 py-3 transition last:border-b-0 hover:bg-emerald-50/60">
                            <a href={item.href} onClick={(event) => openPinnedItem(event, item)} className="group flex min-w-0 flex-1 items-start gap-3">
                                <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-arms-green">
                                    {item.kind === 'folder'
                                        ? <ArmsIcon name="folder" className="h-5 w-5" />
                                        : <span className="text-[10px] font-extrabold leading-none tracking-tight text-arms-green">{(item.file_type || 'FILE').slice(0, 4)}</span>}
                                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm" title="Pinned">
                                        <ArmsIcon name="pin" className="h-3 w-3 fill-current text-red-500" />
                                    </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="break-words text-sm font-semibold leading-5 text-[#173d32] group-hover:text-arms-green">{item.name}</span>
                                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">{item.type}</span>
                                    </span>
                                    {pinParent(item) && <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-4">
                                        <span className="font-semibold uppercase tracking-wide text-stone-400">Parent</span>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-[#123b25] ring-1 ring-inset ring-emerald-100">{pinParent(item)}</span>
                                    </span>}
                                    <span className="mt-1.5 block whitespace-normal break-words text-[10px] font-semibold leading-4">
                                        {pinPathParts(item).map((part,index)=><span key={`${item.pin_id}-path-${index}`}>
                                            {index>0&&<span className="mx-1 text-stone-400">/</span>}
                                            <span style={{color:part==='..'?'#6b7280':pinPathColors[Math.min(index,pinPathColors.length-1)]}}>{part}</span>
                                        </span>)}
                                    </span>
                                </span>
                            </a>
                            {item.information_url && onInformation && <div className="relative shrink-0"><button type="button" onClick={() => setActionOpen(actionOpen===item.pin_id?null:item.pin_id)} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-stone-500 hover:bg-white hover:text-stone-700">⋮</button>{actionOpen===item.pin_id&&<div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-stone-200 bg-white p-1 text-xs shadow-xl"><a href={item.href} onClick={(event)=>openPinnedItem(event,item)} className="block rounded-md px-2.5 py-2 hover:bg-stone-50">Open</a><button type="button" onClick={()=>{setActionOpen(null);setOpen(false);onInformation({name:item.name,url:item.information_url!,kind:item.kind});}} className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-emerald-50">Information</button></div>}</div>}
                        </div>)}
                    </section>) : <div className="py-10 text-center text-sm text-stone-400">No pinned items found.</div>}
                </div>
                <div className="border-t border-stone-100 bg-white px-4 py-3 text-center"><Link href={route('documents.manage') + '?search=pin'} onClick={() => setOpen(false)} className="text-xs font-semibold text-arms-green hover:text-arms-dark">View all pinned items</Link></div>
            </div>
        </>}
    </div>;
}
