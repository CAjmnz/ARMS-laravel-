import ArmsIcon from '@/Components/ArmsIcon';
import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

type PinType = 'all' | 'filenames' | 'subfolders' | 'documents';

interface PinnedItem {
    pin_id: number;
    kind: 'folder' | 'document';
    type: string;
    id: number;
    route_key: string;
    name: string;
    path: string;
    href: string;
    file_type?: string;
}

export default function PinnedItemsDropdown({ count }: { count: number }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [type, setType] = useState<PinType>('all');
    const [items, setItems] = useState<PinnedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', close);
        window.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', escape);
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

    return <div ref={wrapper} className="relative min-w-[170px]">
        <button
            type="button"
            onClick={() => setOpen((value) => !value)}
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
            <div className="absolute right-0 top-[76px] z-[90] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                <div className="border-b border-stone-100 p-4">
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
                <div className="max-h-80 overflow-y-auto bg-white p-0">
                    {loading ? <div className="py-10 text-center text-sm text-stone-400">Loading pinned items…</div> : groupedItems.length ? groupedItems.map((group) => <section key={group.label} className="last:mb-0">
                        <div className="sticky top-0 z-10 bg-white px-4 py-1.5 text-xs font-bold text-[#1f2d26]">{group.label}</div>
                        {group.items.map((item) => <Link key={item.pin_id} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-1.5 transition hover:bg-[#e8f1ff] hover:text-[#0b57d0] focus:bg-[#0b66d4] focus:text-white">
                            <span className="relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-arms-green">
                                {item.kind === 'folder'
                                    ? <ArmsIcon name="folder" className="h-4 w-4" />
                                    : <span className="text-[9px] font-extrabold leading-none tracking-tight text-arms-green">{(item.file_type || 'FILE').slice(0, 4)}</span>}
                                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm" title="Pinned">
                                    <ArmsIcon name="pin" className="h-3 w-3 fill-current text-red-500" />
                                </span>
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium leading-5 text-[#26352f]">{item.name}</span>
                                <span className="block whitespace-normal break-words text-xs leading-4 text-stone-600 [overflow-wrap:anywhere]">{item.path}</span>
                            </span>
                        </Link>)}
                    </section>) : <div className="py-10 text-center text-sm text-stone-400">No pinned items found.</div>}
                </div>
                <div className="border-t border-stone-100 p-3 text-center"><Link href={route('documents.manage') + '?search=pin'} onClick={() => setOpen(false)} className="text-xs font-semibold text-arms-green hover:text-arms-dark">View all pinned items</Link></div>
            </div>
        </>}
    </div>;
}
