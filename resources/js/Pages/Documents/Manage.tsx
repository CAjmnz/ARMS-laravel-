import ArmsIcon from '@/Components/ArmsIcon';
import PinnedItemsDropdown from '@/Components/PinnedItemsDropdown';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { DragEvent, FormEvent, useEffect, useRef, useState, useMemo } from 'react';

interface Folder {
    id: number;
    route_key: string;
    name: string;
    children_count: number;
    documents_count: number;
    depth?: number;
    can_manage: boolean;
    can_upload?: boolean;
    is_pinned?: boolean;
    pin_url?: string;
    is_published?: boolean;
    can_publish?: boolean;
    can_unpublish?: boolean;
    rename_url?: string | null;
    delete_url?: string | null;
    updated_at?: string | null;
    owner?: string | null;
}

interface DocumentItem { id:number; route_key:string; name:string; type:string; modified_at?:string|null; owner:string; show_url:string; viewer_url?:string|null; download_url?:string|null; edit_url?:string|null; update_url?:string|null; move_url?:string|null; delete_url?:string|null; is_pinned?:boolean; pin_url?:string; }
interface PinnedSearchItem { pin_id:number; kind:'folder'|'document'; type:string; id:number; route_key:string; name:string; path:string; updated_at?:string|null; href:string; is_pinned:boolean; }
interface PinnedSearchPage { data:PinnedSearchItem[]; current_page:number; last_page:number; prev_page_url:string|null; next_page_url:string|null; total:number; }

interface Organization {
    id: number;
    name: string;
    departments: { id: number; name: string; subsidiary_id: number }[];
}

interface Props {
    currentFolder: Folder | null;
    documentStats: { documents:number; folders:number; pins:number; users:number; departments:number };
    breadcrumbs: { id: number; route_key: string; name: string }[];
    folders: { data: Folder[]; current_page: number; last_page: number; prev_page_url: string | null; next_page_url: string | null };
    documents: DocumentItem[];
    filters: { search: string; sort?: string; order?: 'asc' | 'desc'; per_page?: number };
    pinnedSearch: PinnedSearchPage | null;
    pinnedSearchMode: boolean;
    pinnedSearchKeyword: string | null;
    canCreateRoot: boolean;
    organizations: Organization[];
    uploadFolders: { id: number; route_key: string; name: string; path: string; depth: number; group_label: string }[];
}

const formatDate = (value?: string | null) =>
    value ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';

function PinMarker({ pinned }: { pinned?: boolean }) {
    if (!pinned) return null;
    return <span title="Pinned" className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm"><ArmsIcon name="pin" className="h-3 w-3 fill-current text-red-500" /></span>;
}

export default function Manage({
    currentFolder,
    documentStats,
    breadcrumbs,
    folders,
    documents,
    filters,
    pinnedSearch,
    pinnedSearchMode,
    pinnedSearchKeyword,
    canCreateRoot,
    organizations,
    uploadFolders,
}: Props) {
    const [creating, setCreating] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadFolderId, setUploadFolderId] = useState('');
    const [view, setView] = useState<'list' | 'grid'>('grid');
    const [viewingDocument, setViewingDocument] = useState<DocumentItem | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkDestinationId, setBulkDestinationId] = useState('');
    const form = useForm({ name: '', subsidiary_id: '', department_id: '' });
    const uploadForm = useForm({ original_files: [] as File[], viewer_files: [] as File[] });
    const itemCount = folders.data.length + documents.length;
    const visibleKeys = useMemo(() => [...folders.data.map((item) => `folder:${item.id}`), ...documents.map((item) => `document:${item.id}`)], [folders.data, documents]);
    const selectedFolderIds = useMemo(() => Array.from(selectedItems).filter((key) => key.startsWith('folder:')).map((key) => Number(key.split(':')[1])), [selectedItems]);
    const selectedDocumentIds = useMemo(() => Array.from(selectedItems).filter((key) => key.startsWith('document:')).map((key) => Number(key.split(':')[1])), [selectedItems]);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedItems.has(key));
    const isRoot = !currentFolder;
    const canChooseUploadDestination = isRoot;
    const uploadFolderGroups = useMemo(() => {
        return uploadFolders.reduce<Record<string, Props['uploadFolders']>>((groups, folder) => {
            (groups[folder.group_label] ??= []).push(folder);
            return groups;
        }, {});
    }, [uploadFolders]);
    const departments = useMemo(
        () => organizations.find((item) => String(item.id) === form.data.subsidiary_id)?.departments ?? [],
        [form.data.subsidiary_id, organizations],
    );

    const openCreate = () => {
        form.clearErrors();
        form.reset();
        setCreating(true);
    };

    const addUploadFiles = (kind: 'original_files' | 'viewer_files', files: File[]) => {
        const current = uploadForm.data[kind];
        const combined = [...current, ...files].slice(0, 30);
        uploadForm.setData(kind, combined);
    };

    const handleUploadDrop = (event: DragEvent<HTMLLabelElement>, kind: 'original_files' | 'viewer_files') => {
        event.preventDefault();
        addUploadFiles(kind, Array.from(event.dataTransfer.files));
    };

    const normalizedUploadName = (name: string) => {
        const lastDot = name.lastIndexOf('.');
        const base = lastDot > 0 ? name.slice(0, lastDot) : name;
        const extension = lastDot > 0 ? name.slice(lastDot) : '';
        return base.trim().replace(/\s+/g, '_') + extension.toLowerCase();
    };

    const submitUpload = (event: FormEvent) => {
        event.preventDefault();
        const destinationKey = canChooseUploadDestination
            ? uploadFolders.find((folder) => String(folder.id) === uploadFolderId)?.route_key
            : currentFolder?.route_key;
        if (!destinationKey) return;
        uploadForm.post(route('documents.upload', destinationKey), { preserveScroll: true, forceFormData: true, onSuccess: () => { uploadForm.reset(); setUploadFolderId(''); setUploadOpen(false); } });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (isRoot) {
            form.post(route('documents.filenames.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    form.reset();
                    setCreating(false);
                },
            });
            return;
        }

        form.post(route('documents.folders.store', currentFolder.route_key), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setCreating(false);
            },
        });
    };

    const toggleSelection = (key: string, checked: boolean) => {
        setSelectedItems((current) => {
            const next = new Set(current);
            checked ? next.add(key) : next.delete(key);
            return next;
        });
    };

    const toggleAllVisible = (checked: boolean) => {
        setSelectedItems((current) => {
            const next = new Set(current);
            visibleKeys.forEach((key) => checked ? next.add(key) : next.delete(key));
            return next;
        });
    };

    const bulkDownload = () => {
        const selectedDocuments = documents.filter((document) => selectedItems.has(`document:${document.id}`) && document.download_url);
        setBulkOpen(false);
        selectedDocuments.forEach((document, index) => {
            window.setTimeout(() => {
                const link = window.document.createElement('a');
                link.href = document.download_url as string;
                link.download = '';
                window.document.body.appendChild(link);
                link.click();
                link.remove();
            }, index * 250);
        });
    };

    const submitBulkTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!selectedDocumentIds.length || !bulkDestinationId) return;
        router.patch(route('documents.bulk-move'), { document_ids: selectedDocumentIds, folder_id: bulkDestinationId }, {
            preserveScroll: true,
            onSuccess: () => { setSelectedItems(new Set()); setBulkDestinationId(''); setBulkTransferOpen(false); },
        });
    };

    const bulkDelete = () => {
        if (!selectedItems.size) return;
        setBulkOpen(false);
        setBulkDeleteOpen(true);
    };

    const confirmBulkDelete = () => {
        router.delete(route('documents.bulk-delete'), {
            data: { folder_ids: selectedFolderIds, document_ids: selectedDocumentIds },
            preserveScroll: true,
            onSuccess: () => { setSelectedItems(new Set()); setBulkDeleteOpen(false); },
        });
    };

    const updateTable = (changes: Record<string, string | number>) => {
        router.get(route('documents.manage', currentFolder?.route_key), { ...filters, ...changes }, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AuthenticatedLayout
            kicker="DOCUMENTS DIRECTORY"
            title="Documents"
            description="Open a filename to browse its subfolders one level at a time."
            showClock={false}
            header={<div className="flex min-w-0 items-center justify-end gap-3">
                <DocumentSummaryCard icon="document" value={documentStats.documents} label="Total documents" />
                <PinnedItemsDropdown count={documentStats.pins} />
            </div>}
        >
            <Head title="Documents" />

            <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                    {(isRoot ? canCreateRoot : (currentFolder?.can_manage || currentFolder?.can_upload)) && (
                        <div className="relative shrink-0">
                            <button type="button" onClick={() => setNewOpen((open) => !open)} aria-expanded={newOpen} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-arms-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#033b2d]">
                                <span className="text-lg leading-none">+</span> New <span className="text-xs">▾</span>
                            </button>
                            {newOpen && <div className="absolute left-0 top-12 z-30 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
                                {isRoot && canCreateRoot && <button type="button" onClick={() => { setNewOpen(false); openCreate(); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">▣ Add new filename</button>}
                                {!isRoot && currentFolder?.can_manage && <button type="button" onClick={() => { setNewOpen(false); openCreate(); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">▣ New folder</button>}
                                {(currentFolder?.can_upload || (isRoot && canCreateRoot)) && <button type="button" onClick={() => { setNewOpen(false); setUploadOpen(true); }} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">⇧ Add new documents</button>}
                            </div>}
                        </div>
                    )}


                    <label className="relative block min-w-0 flex-1">
                        <ArmsIcon name="folder" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                        <input
                            defaultValue={filters.search}
                            onChange={(event) => updateTable({ search: event.target.value })}
                            placeholder="Search in Document Management"
                            aria-label="Search in Document Management"
                            className="h-11 w-full rounded-xl border-stone-200 bg-stone-50 py-2 pl-12 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-arms-green focus:bg-white focus:ring-arms-green"
                        />
                    </label>
                </div>

                <nav aria-label="Document path" className="mt-6 flex flex-wrap items-center gap-1 text-sm">
                    <Link href={route('documents.manage')} className="rounded-lg px-2 py-1 font-semibold text-arms-green transition hover:bg-emerald-50">Documents</Link>
                    {breadcrumbs.map((item) => (
                        <span key={item.id} className="flex items-center gap-1">
                            <span aria-hidden="true" className="text-stone-400">›</span>
                            <Link href={route('documents.manage', item.route_key)} className="rounded-lg px-2 py-1 font-medium text-stone-700 transition hover:bg-stone-100">{item.name}</Link>
                        </span>
                    ))}
                </nav>

                <main className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-6">
                        <div>
                            <h2 className="text-xl font-semibold text-[#073d2f] sm:text-2xl">{pinnedSearchMode ? 'Pinned Search Results' : (currentFolder?.name ?? 'Documents')}</h2>
                            <p className="mt-1 text-sm text-stone-500">{pinnedSearchMode ? 'Pinned items from all accessible locations' : 'Folders and documents in this location'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-stone-500">{pinnedSearchMode ? (pinnedSearch?.total ?? 0) : itemCount} {(pinnedSearchMode ? (pinnedSearch?.total ?? 0) : itemCount) === 1 ? 'item' : 'items'}</span>
                            {!pinnedSearchMode && <div className="flex overflow-hidden rounded-lg border border-stone-200 p-0.5" aria-label="Choose view">
                                <button type="button" onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'} className={'grid h-8 w-9 place-items-center rounded-md text-sm font-bold transition ' + (view === 'list' ? 'bg-arms-green text-white' : 'text-stone-500 hover:bg-stone-100')}>☰</button>
                                <button type="button" onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={'grid h-8 w-9 place-items-center rounded-md text-lg transition ' + (view === 'grid' ? 'bg-arms-green text-white' : 'text-stone-500 hover:bg-stone-100')}>⊞</button>
                            </div>}
                        </div>
                    </header>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
                        {pinnedSearchMode ? <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-arms-green"><ArmsIcon name="pin" className="h-4 w-4" /> Pinned items from all locations</span>
                            {pinnedSearchKeyword && <span className="text-stone-500">matching “{pinnedSearchKeyword}”</span>}
                            <button type="button" onClick={() => router.get(route('documents.manage', currentFolder?.route_key), { sort:filters.sort, order:filters.order, per_page:filters.per_page }, { preserveScroll:true, replace:true })} className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-600 hover:bg-stone-50">Clear search</button>
                        </div> : <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <button type="button" onClick={() => setBulkOpen((open) => !open)} disabled={!selectedItems.size} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45">Bulk actions <span className="text-xs">⌄</span></button>
                                {bulkOpen && <div className="absolute left-0 top-12 z-40 w-60 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl">
                                    <button type="button" disabled={!selectedDocumentIds.length} onClick={bulkDownload} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300">⇩ Download selected files</button>
                                    <button type="button" disabled={!selectedDocumentIds.length} onClick={() => { setBulkOpen(false); setBulkTransferOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300">⇄ Transfer selected files</button>
                                    <button type="button" onClick={bulkDelete} className="mt-1 block w-full border-t border-stone-100 rounded-lg px-3 py-2.5 text-left text-red-700 hover:bg-red-50">♜ Delete selected items</button>
                                </div>}
                            </div>
                            <span className="text-sm text-stone-500">{selectedItems.size ? `${selectedItems.size} item(s) selected` : 'No records selected'}</span>
                        </div>}
                        <label className="flex items-center gap-2 text-sm text-stone-600">Show
                            <select value={filters.per_page ?? 10} onChange={(event) => updateTable({ per_page: Number(event.target.value) })} className="h-10 rounded-xl border-stone-300 bg-white py-1 pl-3 pr-8 text-sm">
                                {[10,25,50,100].map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                            entries
                        </label>
                    </div>

                    {pinnedSearchMode ? (
                        <PinnedSearchResults page={pinnedSearch} />
                    ) : itemCount === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-8 w-8" /></span>
                            <h3 className="mt-5 text-xl font-semibold text-[#073d2f]">No folders found</h3>
                            <p className="mt-2 text-sm text-stone-500">Create a folder here, or adjust your search.</p>
                        </div>
                    ) : view === 'list' ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-stone-100 text-left">
                                <thead className="bg-stone-50/80">
                                    <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                                        <th className="w-12 px-5 py-3.5 sm:px-6"><input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAllVisible(event.target.checked)} aria-label="Select all visible items" className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /></th>
                                        <th className="px-5 py-3.5"><button type="button" onClick={() => updateTable({ sort: 'name', order: filters.sort === 'name' && filters.order === 'asc' ? 'desc' : 'asc' })} className="font-semibold uppercase tracking-wide hover:text-arms-green">Name ↕</button></th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="hidden px-5 py-3.5 md:table-cell"><button type="button" onClick={() => updateTable({ sort: 'created_at', order: filters.sort === 'created_at' && filters.order === 'asc' ? 'desc' : 'asc' })} className="font-semibold uppercase tracking-wide hover:text-arms-green">Modified date ↕</button></th>
                                        <th className="hidden px-5 py-3.5 lg:table-cell">Owner / Uploaded by</th><th className="w-14 px-4 py-3.5"><span className="sr-only">More actions</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {folders.data.map((folder) => <FolderRow key={'folder-' + folder.id} folder={folder} selected={selectedItems.has(`folder:${folder.id}`)} onSelected={(checked) => toggleSelection(`folder:${folder.id}`, checked)} />)}
                                    {documents.map((document) => <DocumentRow key={'document-' + document.id} document={document} destinations={uploadFolders} onOpen={setViewingDocument} selected={selectedItems.has(`document:${document.id}`)} onSelected={(checked) => toggleSelection(`document:${document.id}`, checked)} />)}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-7 p-5 sm:p-6">
                            {folders.data.length > 0 && <section>
                                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-stone-700">Folders</h3><span className="text-xs text-stone-400">{folders.data.length}</span></div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {folders.data.map((folder) => <FolderCard key={'folder-' + folder.id} folder={folder} selected={selectedItems.has(`folder:${folder.id}`)} onSelected={(checked) => toggleSelection(`folder:${folder.id}`, checked)} />)}
                                </div>
                            </section>}
                            {documents.length > 0 && <section>
                                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-stone-700">Files</h3><span className="text-xs text-stone-400">{documents.length}</span></div>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {documents.map((document) => <DocumentCard key={'document-' + document.id} document={document} destinations={uploadFolders} onOpen={setViewingDocument} selected={selectedItems.has(`document:${document.id}`)} onSelected={(checked) => toggleSelection(`document:${document.id}`, checked)} />)}
                                </div>
                            </section>}
                        </div>
                    )}

                    {!pinnedSearchMode && folders.last_page > 1 && (
                        <footer className="flex items-center justify-between border-t border-stone-100 px-5 py-4 text-sm sm:px-6">
                            <span className="text-stone-500">Page {folders.current_page} of {folders.last_page}</span>
                            <div className="flex gap-2">
                                <PageButton url={folders.prev_page_url} label="Previous" />
                                <PageButton url={folders.next_page_url} label="Next" />
                            </div>
                        </footer>
                    )}
                </main>
            </section>

            {bulkDeleteOpen && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-[#012a21]/45 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div>
                        <h2 className="mt-4 text-xl font-semibold text-[#073d2f]">Delete selected items?</h2>
                        <p className="mt-2 text-sm text-stone-500">You are about to delete {selectedItems.size} selected item(s). This action cannot be undone.</p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button type="button" onClick={() => setBulkDeleteOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700">Cancel</button>
                            <button type="button" onClick={confirmBulkDelete} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Yes, delete</button>
                        </div>
                    </div>
                </div>
            )}

            {bulkTransferOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4">
                    <form onSubmit={submitBulkTransfer} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-semibold text-[#073d2f]">Transfer selected files</h2>
                        <p className="mt-1 text-sm text-stone-500">Move {selectedDocumentIds.length} selected document(s) to another authorized destination.</p>
                        <select value={bulkDestinationId} onChange={(event) => setBulkDestinationId(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300">
                            <option value="">Select destination path</option>
                            {uploadFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
                        </select>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => { setBulkTransferOpen(false); setBulkDestinationId(''); }} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">Cancel</button>
                            <button disabled={!bulkDestinationId || !selectedDocumentIds.length} className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Transfer files</button>
                        </div>
                    </form>
                </div>
            )}

            {uploadOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4">
                    <form onSubmit={submitUpload} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-semibold text-[#073d2f]">Upload New Documents</h2>
                        <p className="mt-1 text-sm text-stone-500">Upload original files and optional watermarked viewer files to the selected folder.</p>
                        {canChooseUploadDestination ? (
                            <label className="mt-5 block text-sm font-medium text-stone-700">
                                Destination Path
                                <select
                                    value={uploadFolderId}
                                    onChange={(event) => setUploadFolderId(event.target.value)}
                                    className="mt-2 h-11 w-full rounded-xl border-stone-300 bg-white px-3 text-sm text-stone-800 shadow-sm focus:border-[#0b8a64] focus:ring-[#0b8a64]"
                                >
                                    <option value="">Select a destination path</option>
                                    {Object.entries(uploadFolderGroups).map(([group, items]) => (
                                        <optgroup key={group} label={group}>
                                            {items.map((folder) => (
                                                <option key={folder.id} value={folder.id}>{folder.path}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <span className="mt-1 block text-xs font-normal text-stone-500">Choose a Filename or any available Subfolder path.</span>
                            </label>
                        ) : (
                            <div className="mt-5">
                                <span className="mb-2 block text-sm font-medium text-stone-700">Destination Path</span>
                                <div className="flex min-h-11 items-center rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#073d2f] shadow-sm ring-1 ring-emerald-100">
                                    /{breadcrumbs.map((item) => item.name).join('/')}
                                </div>
                                <span className="mt-1 block text-xs text-stone-500">Current location selected automatically. No destination selection is required.</span>
                            </div>
                        )}
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleUploadDrop(event, 'original_files')} className="cursor-pointer rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-sm font-medium text-arms-green transition hover:border-arms-green hover:bg-emerald-50">
                                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-sm">⇧</span>
                                <span className="mt-3 block font-semibold">Drag and drop original files here</span>
                                <span className="mt-1 block text-xs font-normal text-stone-500">or click to browse · up to 30 files</span>
                                <input type="file" multiple className="sr-only" onChange={(event) => { addUploadFiles('original_files', Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
                                {uploadForm.data.original_files.length > 0 && <span className="mt-3 block text-xs font-semibold">{uploadForm.data.original_files.length} file(s) selected</span>}
                            </label>
                            <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleUploadDrop(event, 'viewer_files')} className="cursor-pointer rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-5 text-center text-sm font-medium text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50/40">
                                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-sm">⇧</span>
                                <span className="mt-3 block font-semibold">Drag and drop watermark files here</span>
                                <span className="mt-1 block text-xs font-normal text-stone-500">Optional · same order as originals · up to 30 files</span>
                                <input type="file" multiple className="sr-only" onChange={(event) => { addUploadFiles('viewer_files', Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
                                {uploadForm.data.viewer_files.length > 0 && <span className="mt-3 block text-xs font-semibold">{uploadForm.data.viewer_files.length} file(s) selected</span>}
                            </label>
                        </div>
                        {uploadForm.data.original_files.length > 0 && <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Files to upload</p><div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-stone-700">{uploadForm.data.original_files.map((file, index) => <div key={index + '-' + file.name} className="flex items-center justify-between gap-3"><span className="truncate">{file.name}</span><span className="shrink-0 font-medium text-arms-green">{normalizedUploadName(file.name)}</span></div>)}</div><p className="mt-2 text-xs text-stone-500">Spaces will be converted to underscores. Windows-invalid filename characters (&lt; &gt; : &quot; / \\ | ? *) are rejected.</p></div>}
                        {uploadForm.errors.original_files && <p className="mt-3 text-sm text-red-700">{uploadForm.errors.original_files}</p>}
                        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setUploadOpen(false)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">Cancel</button><button disabled={uploadForm.processing || !uploadForm.data.original_files.length || (canChooseUploadDestination && !uploadFolderId)} className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Upload documents</button></div>
                    </form>
                </div>
            )}

            {viewingDocument && <LegacyDocumentViewer document={viewingDocument} documents={documents} destinations={uploadFolders} close={() => setViewingDocument(null)} />}

            {creating && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4">
                    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h2 className="text-lg font-semibold text-[#073d2f]">{isRoot ? 'Add new filename' : 'New folder'}</h2>
                        <p className="mt-1 text-sm text-stone-500">{isRoot ? 'Create the first folder in a tracked document hierarchy.' : 'Create a folder in ' + currentFolder?.name + '.'}</p>
                        {isRoot && (
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-stone-700">Subsidiary
                                    <select value={form.data.subsidiary_id} onChange={(event) => { form.setData('subsidiary_id', event.target.value); form.setData('department_id', ''); }} className="mt-2 w-full rounded-xl border-stone-300">
                                        <option value="">Select subsidiary</option>
                                        {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                    {form.errors.subsidiary_id && <span className="mt-1 block text-xs text-red-700">{form.errors.subsidiary_id}</span>}
                                </label>
                                <label className="block text-sm font-medium text-stone-700">Department
                                    <select value={form.data.department_id} onChange={(event) => form.setData('department_id', event.target.value)} disabled={!form.data.subsidiary_id} className="mt-2 w-full rounded-xl border-stone-300 disabled:bg-stone-100">
                                        <option value="">Select department</option>
                                        {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                    </select>
                                    {form.errors.department_id && <span className="mt-1 block text-xs text-red-700">{form.errors.department_id}</span>}
                                </label>
                            </div>
                        )}
                        <label className="mt-5 block text-sm font-medium text-stone-700">{isRoot ? 'Filename' : 'Folder name'}
                            <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder={isRoot ? 'Enter filename' : 'Folder name'} className="mt-2 w-full rounded-xl border-stone-300" autoFocus />
                        </label>
                        {form.errors.name && <p className="mt-2 text-sm text-red-700">{form.errors.name}</p>}
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button>
                            <button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white hover:bg-[#033b2d] disabled:opacity-50">{isRoot ? 'Create filename' : 'Create folder'}</button>
                        </div>
                    </form>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

function DocumentSummaryCard({ icon, value, label }: { icon:'document'|'folder'|'users'|'building'; value:number; label:string }) {
    return <div className="flex min-h-[68px] min-w-[170px] items-center gap-3 rounded-xl border border-[#d7e7df] bg-white px-3.5 py-2 shadow-[0_4px_14px_rgba(6,59,45,0.05)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d7eee3] bg-[#effaf4] text-[#087b57]"><ArmsIcon name={icon} className="h-5 w-5" /></span>
        <span className="min-w-0"><strong className="block text-[21px] font-bold leading-none text-[#073d2f]">{value.toLocaleString()}</strong><span className="mt-1.5 block truncate text-[11px] font-medium text-[#71837d]">{label}</span></span>
    </div>;
}

function FolderRow({ folder, selected, onSelected }: { folder: Folder; selected: boolean; onSelected:(checked:boolean)=>void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return <tr className={'group transition ' + (menuOpen || selected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/40')}><td className="px-5 py-4 sm:px-6"><input type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} aria-label={'Select ' + folder.name} className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /></td><td className="px-5 py-4"><Link href={route('documents.manage', folder.route_key)} className="flex min-w-[220px] items-center gap-3 font-medium text-[#073d2f] hover:text-arms-green"><span className="relative grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-5 w-5" /><PinMarker pinned={folder.is_pinned} /></span><span className="min-w-0 truncate">{folder.name}</span></Link></td><td className="px-5 py-4 text-sm text-stone-600">Folder</td><td className="hidden px-5 py-4 text-sm text-stone-500 md:table-cell">{formatDate(folder.updated_at)}</td><td className="hidden px-5 py-4 text-sm text-stone-500 lg:table-cell">{folder.owner ?? '—'}</td><td className="px-4 py-4 text-center"><FolderActions folder={folder} open={menuOpen} onOpenChange={setMenuOpen} /></td></tr>;
}
function FolderCard({ folder, selected, onSelected }: { folder: Folder; selected: boolean; onSelected:(checked:boolean)=>void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return <div className={'group flex min-h-20 items-center gap-3 rounded-xl border px-3 py-3 shadow-sm transition ' + (menuOpen || selected ? 'border-arms-green bg-emerald-50/70 ring-2 ring-emerald-100' : 'border-stone-200 bg-stone-50/70 hover:border-[#b7d9cb] hover:bg-white')}><input type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} aria-label={'Select ' + folder.name} className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /><Link href={route('documents.manage', folder.route_key)} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-arms-green"><ArmsIcon name="folder" className="h-5 w-5" /><PinMarker pinned={folder.is_pinned} /></Link><Link href={route('documents.manage', folder.route_key)} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#073d2f]">{folder.name}</p><p className="mt-0.5 text-xs text-stone-500">{folder.documents_count} {folder.documents_count === 1 ? 'file' : 'files'} · {folder.children_count} subfolders</p></Link><FolderActions folder={folder} open={menuOpen} onOpenChange={setMenuOpen} /></div>;
}
function DocumentThumbnail({ document }: { document: DocumentItem }) {
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(document.type.toUpperCase());
    if (!document.viewer_url) return <ArmsIcon name="document" className="h-9 w-9 text-arms-green" />;
    if (isImage) return <img src={document.viewer_url} alt="" className="h-full w-full object-contain" loading="lazy" />;
    return <iframe src={document.viewer_url} title={'Preview of ' + document.name} tabIndex={-1} className="pointer-events-none h-full w-full border-0 bg-white" />;
}
function DocumentRow({ document, destinations, onOpen, selected, onSelected }: { document: DocumentItem; destinations: Props['uploadFolders']; onOpen:(document:DocumentItem)=>void; selected:boolean; onSelected:(checked:boolean)=>void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return <tr className={'transition ' + (menuOpen || selected ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/40')}><td className="px-5 py-4 sm:px-6"><input type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} aria-label={'Select ' + document.name} className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /></td><td className="px-5 py-4"><button onClick={() => onOpen(document)} className="flex items-center gap-3 font-medium text-[#073d2f]"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name="document" className="h-5 w-5" /><PinMarker pinned={document.is_pinned} /></span><span>{document.name}</span></button></td><td className="px-5 py-4 text-sm">{document.type}</td><td className="hidden px-5 py-4 text-sm md:table-cell">{formatDate(document.modified_at)}</td><td className="hidden px-5 py-4 text-sm lg:table-cell">{document.owner}</td><td className="px-4 py-4 text-center"><DocumentActions document={document} destinations={destinations} onOpen={onOpen} open={menuOpen} onOpenChange={setMenuOpen} /></td></tr>;
}
function DocumentCard({ document, destinations, onOpen, selected, onSelected }: { document: DocumentItem; destinations: Props['uploadFolders']; onOpen:(document:DocumentItem)=>void; selected:boolean; onSelected:(checked:boolean)=>void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return <div className={'rounded-xl border bg-white p-3 text-left shadow-sm transition ' + (menuOpen || selected ? 'border-arms-green bg-emerald-50/60 ring-2 ring-emerald-100' : 'border-stone-200 hover:border-[#b7d9cb] hover:shadow-md')}><div className="flex items-center justify-between"><input type="checkbox" checked={selected} onChange={(event) => onSelected(event.target.checked)} aria-label={'Select ' + document.name} className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /><DocumentActions document={document} destinations={destinations} onOpen={onOpen} open={menuOpen} onOpenChange={setMenuOpen} /></div><button onClick={() => onOpen(document)} className="mt-2 block w-full text-left"><div className="relative grid h-28 place-items-center overflow-visible rounded-lg border border-stone-100 bg-stone-50"><div className="h-full w-full overflow-hidden rounded-lg grid place-items-center"><DocumentThumbnail document={document} /></div><PinMarker pinned={document.is_pinned} /></div><p className="mt-2 truncate text-sm font-semibold text-[#073d2f]">{document.name}</p><p className="text-[11px] text-stone-500">{document.type} · {formatDate(document.modified_at)}</p></button></div>;
}
function LegacyDocumentViewer({ document, documents, destinations, close }: { document:DocumentItem; documents:DocumentItem[]; destinations:Props['uploadFolders']; close:()=>void }) {
    const [current, setCurrent] = useState(document);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(document.name);
    const [destinationId, setDestinationId] = useState('');
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragOrigin = useRef({ x: 0, y: 0 });
    const positionOrigin = useRef({ x: 0, y: 0 });
    const index = documents.findIndex((item) => item.id === current.id);
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(current.type.toUpperCase());

    useEffect(() => {
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';
        const stopBrowserZoom = (event: WheelEvent) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            if (isImage) setZoom((value) => Math.min(4, Math.max(0.25, value + (event.deltaY < 0 ? 0.1 : -0.1))));
        };
        window.addEventListener('wheel', stopBrowserZoom, { passive: false, capture: true });
        return () => {
            window.document.body.style.overflow = previousOverflow;
            window.removeEventListener('wheel', stopBrowserZoom, true);
        };
    }, [isImage]);

    useEffect(() => {
        const navigateWithKeyboard = (event: KeyboardEvent) => {
            if (renameOpen || transferOpen) return;
            if (event.key === 'ArrowRight' && index < documents.length - 1) {
                event.preventDefault();
                changeDocument(index + 1);
            } else if (event.key === 'ArrowLeft' && index > 0) {
                event.preventDefault();
                changeDocument(index - 1);
            }
        };
        window.addEventListener('keydown', navigateWithKeyboard);
        return () => window.removeEventListener('keydown', navigateWithKeyboard);
    }, [index, documents.length, renameOpen, transferOpen]);

    const resetView = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };
    const changeDocument = (nextIndex: number) => {
        if (nextIndex < 0 || nextIndex >= documents.length) return;
        const next = documents[nextIndex];
        setCurrent(next);
        setRenameValue(next.name);
        setActionsOpen(false);
        setRenameOpen(false);
        setTransferOpen(false);
        resetView();
    };
    const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isImage || event.button !== 0) return;
        dragging.current = true;
        dragOrigin.current = { x: event.clientX, y: event.clientY };
        positionOrigin.current = position;
        event.preventDefault();
    };
    const moveDrag = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!dragging.current) return;
        setPosition({ x: positionOrigin.current.x + event.clientX - dragOrigin.current.x, y: positionOrigin.current.y + event.clientY - dragOrigin.current.y });
    };
    const stopDrag = () => { dragging.current = false; };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!current.update_url || !renameValue.trim()) return;
        const normalizedName = renameValue.trim().replace(/\s+/g, '_');
        router.patch(current.update_url, { title: renameValue.trim() }, { preserveScroll: true, onSuccess: () => { setCurrent((item) => ({ ...item, name: normalizedName })); setRenameValue(normalizedName); setRenameOpen(false); } });
    };
    const submitTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!current.move_url || !destinationId) return;
        router.patch(current.move_url, { folder_id: destinationId }, { preserveScroll: true, onSuccess: close });
    };
    const remove = () => {
        if (current.delete_url) router.delete(current.delete_url, { preserveScroll: true, onSuccess: close });
    };

    return <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#012a21]/65 p-4">
        <div role="dialog" aria-modal="true" className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="relative flex items-start justify-between gap-5 bg-[#087d5a] px-7 py-5 text-white">
                <div><span className="text-xs font-bold tracking-wide">DOCUMENT VIEWER</span><h2 className="mt-1 text-xl font-semibold">{current.name}</h2><p className="text-sm">File {index + 1} of {documents.length}</p></div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button type="button" onClick={() => setActionsOpen((open) => !open)} className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10">Actions⌄</button>
                        {actionsOpen && <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm text-stone-700 shadow-2xl">
                            {current.move_url && <button type="button" onClick={() => { setActionsOpen(false); setTransferOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">⇄ Transfer</button>}
                            {current.download_url && <a href={current.download_url} className="block rounded-lg px-3 py-2.5 hover:bg-stone-50">⇩ Download</a>}
                            {current.update_url && <button type="button" onClick={() => { setRenameValue(current.name); setActionsOpen(false); setRenameOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">✎ Rename</button>}
                            {current.delete_url && <button type="button" onClick={() => { setActionsOpen(false); setDeleteOpen(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-red-700 hover:bg-red-50">♜ Delete</button>}
                        </div>}
                    </div>
                    <button onClick={close} aria-label="Close document viewer" className="grid h-10 w-10 place-items-center rounded-xl border border-white/40 text-2xl hover:bg-white/10">×</button>
                </div>
            </header>
            <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
                <button type="button" onClick={() => setZoom((value) => Math.max(0.25, value - 0.1))} className="rounded border px-3 py-2">⌕ Zoom Out</button>
                <strong className="min-w-12 text-center text-arms-green">{Math.round(zoom * 100)}%</strong>
                <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.1))} className="rounded border px-3 py-2">⌕ Zoom In</button>
                <button type="button" onClick={resetView} className="rounded border px-3 py-2">Fit to Screen</button>
                <button type="button" onClick={resetView} className="rounded border px-3 py-2">Actual Size</button>
                <span className="ml-auto text-stone-500">Hold left mouse button and drag to move · Hold Ctrl + mouse wheel to zoom preview</span>
            </div>
            <div onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag} className={'relative min-h-0 flex-1 overflow-hidden bg-[#24313a] p-5 ' + (isImage ? 'cursor-grab active:cursor-grabbing' : '')}>
                {current.viewer_url ? (isImage ? <div className="grid h-full w-full place-items-center overflow-hidden"><img draggable={false} src={current.viewer_url} alt={current.name} className="max-h-full max-w-full select-none object-contain" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transformOrigin: 'center center' }} /></div> : <iframe title="Uploaded document viewer" src={current.viewer_url} className="h-full w-full rounded bg-white" />) : <div className="grid h-full place-items-center bg-white text-stone-500">The protected viewer is not ready.</div>}
                {documents.length > 1 && <><button type="button" disabled={index <= 0} onClick={() => changeDocument(index - 1)} className="absolute left-5 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/20 text-4xl text-white backdrop-blur hover:bg-black/35 disabled:opacity-30">‹</button><button type="button" disabled={index >= documents.length - 1} onClick={() => changeDocument(index + 1)} className="absolute right-5 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/20 text-4xl text-white backdrop-blur hover:bg-black/35 disabled:opacity-30">›</button></>}
            </div>
            <footer className="border-t px-6 py-3 font-semibold text-[#073d2f]">{current.name}</footer>
        </div>
        {renameOpen && <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4"><form onSubmit={submitRename} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-[#073d2f]">Rename document</h3><p className="mt-1 text-sm text-stone-500">Rename this file without leaving the viewer.</p><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300"/><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRenameOpen(false)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white">Save</button></div></form></div>}
        {transferOpen && <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4"><form onSubmit={submitTransfer} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-[#073d2f]">Transfer document</h3><p className="mt-1 text-sm text-stone-500">Choose the destination without leaving the document viewer.</p><select autoFocus value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300"><option value="">Select destination path</option>{destinations.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}</select><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setTransferOpen(false)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={!destinationId} className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Transfer</button></div></form></div>}
        {deleteOpen && <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div><h3 className="mt-4 text-xl font-semibold text-[#073d2f]">Delete document?</h3><p className="mt-2 text-sm text-stone-500">Delete <strong>{current.name}</strong>? This action cannot be undone.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={remove} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Yes, delete</button></div></div></div>}
    </div>;
}
function DocumentActions({ document, destinations, onOpen, open, onOpenChange }: { document: DocumentItem; destinations: Props['uploadFolders']; onOpen:(document:DocumentItem)=>void; open:boolean; onOpenChange:(open:boolean)=>void }) {
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(document.name);
    const [destinationId, setDestinationId] = useState('');
    const closeAndOpen = () => { onOpenChange(false); onOpen(document); };
    const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 208;
        const menuHeight = 270;
        const viewportPadding = 12;
        const availableBelow = window.innerHeight - rect.bottom;
        const top = availableBelow >= menuHeight + viewportPadding
            ? rect.bottom + 6
            : Math.max(viewportPadding, rect.top - menuHeight - 6);
        const left = Math.min(
            window.innerWidth - menuWidth - viewportPadding,
            Math.max(viewportPadding, rect.right - menuWidth),
        );
        setMenuPosition({ top, left });
        onOpenChange(!open);
    };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!document.update_url || !renameValue.trim()) return;
        router.patch(document.update_url, { title: renameValue.trim() }, { preserveScroll: true, onSuccess: () => setRenameOpen(false) });
    };
    const submitTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!document.move_url || !destinationId) return;
        router.patch(document.move_url, { folder_id: destinationId }, { preserveScroll: true, onSuccess: () => { setTransferOpen(false); setDestinationId(''); } });
    };
    const togglePin = () => {
        if (!document.pin_url) return;
        onOpenChange(false);
        router.patch(document.pin_url, {}, { preserveScroll: true });
    };
    const remove = () => {
        if (!document.delete_url) return;
        router.delete(document.delete_url, { preserveScroll: true, onSuccess: () => setDeleteOpen(false) });
    };
    return <div className="inline-block text-left">
        <button type="button" onClick={toggle} aria-label={'Actions for ' + document.name} className={'rounded-lg px-2 py-1 text-lg leading-none transition ' + (open ? 'bg-emerald-100 text-[#073d2f]' : 'text-stone-500 hover:bg-emerald-50')}>⋮</button>
        {open && <div className="fixed z-[80] w-52 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <button onClick={closeAndOpen} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50">Open viewer</button>
            {document.pin_url && <button type="button" onClick={togglePin} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-stone-50"><ArmsIcon name="pin" className={'h-4 w-4 ' + (document.is_pinned ? 'fill-current text-[#a91f1f]' : 'text-stone-500')} />{document.is_pinned ? 'Unpin' : 'Pin'}</button>}
            {document.download_url && <a href={document.download_url} className="block rounded-lg px-3 py-2 hover:bg-stone-50">Download viewer</a>}
            {document.update_url && <button type="button" onClick={() => { setRenameValue(document.name); onOpenChange(false); setRenameOpen(true); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50">Rename</button>}
            {document.move_url && <button type="button" onClick={() => { onOpenChange(false); setTransferOpen(true); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50">Transfer</button>}
            {document.delete_url && <button type="button" onClick={() => { onOpenChange(false); setDeleteOpen(true); }} className="mt-1 block w-full border-t border-stone-100 px-3 py-2 text-left text-red-700 hover:bg-red-50">Delete</button>}
        </div>}
        {renameOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><form onSubmit={submitRename} className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">✎</div><h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">Rename file</h3><p className="mt-1 text-center text-sm text-stone-500">Spaces will automatically become underscores. Windows-invalid characters are not allowed.</p><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300"/><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setRenameOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-arms-dark">Rename</button></div></form></div>}
        {transferOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><form onSubmit={submitTransfer} className="w-full max-w-lg rounded-2xl bg-white p-6 text-left shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">⇄</div><h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">Transfer file</h3><p className="mt-1 text-center text-sm text-stone-500">Choose a destination. You will remain on this page after the transfer.</p><select autoFocus value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300"><option value="">Select destination path</option>{destinations.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}</select><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setTransferOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button disabled={!destinationId} className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Transfer</button></div></form></div>}
        {deleteOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div><h3 className="mt-4 text-xl font-semibold text-[#073d2f]">Delete file?</h3><p className="mt-2 text-sm text-stone-500">Delete <strong>{document.name}</strong>? This action cannot be undone.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={remove} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Yes, delete</button></div></div></div>}
    </div>;
}
function FolderActions({ folder, open, onOpenChange }: { folder: Folder; open:boolean; onOpenChange:(open:boolean)=>void }) {
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(folder.name);
    const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault(); event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 208;
        const menuHeight = 190;
        const viewportPadding = 12;
        const availableBelow = window.innerHeight - rect.bottom;
        const top = availableBelow >= menuHeight + viewportPadding
            ? rect.bottom + 6
            : Math.max(viewportPadding, rect.top - menuHeight - 6);
        const left = Math.min(
            window.innerWidth - menuWidth - viewportPadding,
            Math.max(viewportPadding, rect.right - menuWidth),
        );
        setMenuPosition({ top, left });
        onOpenChange(!open);
    };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!folder.rename_url || !renameValue.trim()) return;
        router.patch(folder.rename_url, { name: renameValue.trim() }, { preserveScroll: true, onSuccess: () => setRenameOpen(false) });
    };
    const togglePin = () => {
        if (!folder.pin_url) return;
        onOpenChange(false);
        router.patch(folder.pin_url, {}, { preserveScroll: true });
    };
    const remove = () => {
        if (!folder.delete_url) return;
        router.delete(folder.delete_url, { preserveScroll: true, onSuccess: () => setDeleteOpen(false) });
    };
    return <div className="inline-block text-left">
        <button type="button" onClick={toggle} aria-label={'Actions for folder ' + folder.name} className={'rounded-lg px-2 py-1 text-lg leading-none transition ' + (open ? 'bg-emerald-100 text-[#073d2f]' : 'text-stone-500 hover:bg-emerald-50 hover:text-[#073d2f]')}>⋮</button>
        {open && <div className="fixed z-[80] w-52 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl" style={{ top: menuPosition.top, left: menuPosition.left }}><Link href={route('documents.manage', folder.route_key)} className="block rounded-lg px-3 py-2 hover:bg-stone-50">Open folder</Link>{folder.pin_url && <button type="button" onClick={togglePin} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-stone-50"><ArmsIcon name="pin" className={'h-4 w-4 ' + (folder.is_pinned ? 'fill-current text-[#a91f1f]' : 'text-stone-500')} />{folder.is_pinned ? 'Unpin' : 'Pin'}</button>}{folder.rename_url && <button type="button" onClick={() => { setRenameValue(folder.name); onOpenChange(false); setRenameOpen(true); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50">Rename</button>}{folder.delete_url && <button type="button" onClick={() => { onOpenChange(false); setDeleteOpen(true); }} className="mt-1 block w-full border-t border-stone-100 px-3 py-2 text-left text-red-700 hover:bg-red-50">Delete</button>}</div>}
        {renameOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><form onSubmit={submitRename} className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">✎</div><h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">Rename folder</h3><p className="mt-1 text-center text-sm text-stone-500">Spaces will automatically become underscores. Windows-invalid characters are not allowed.</p><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="mt-5 w-full rounded-xl border-stone-300"/><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setRenameOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white">Rename</button></div></form></div>}
        {deleteOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div><h3 className="mt-4 text-xl font-semibold text-[#073d2f]">Delete folder?</h3><p className="mt-2 text-sm text-stone-500">Delete <strong>{folder.name}</strong>? Only empty folders can be deleted.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={remove} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Yes, delete</button></div></div></div>}
    </div>;
}
function PinnedSearchResults({ page }: { page: PinnedSearchPage | null }) {
    const items = page?.data ?? [];
    if (!items.length) return <div className="px-6 py-16 text-center"><ArmsIcon name="pin" className="mx-auto h-8 w-8 text-stone-300" /><h3 className="mt-4 text-lg font-semibold text-[#073d2f]">No pinned items found</h3><p className="mt-1 text-sm text-stone-500">Try another pinned keyword, for example “pin audit”.</p></div>;
    return <>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100 text-left">
                <thead className="bg-stone-50/80"><tr className="text-xs font-semibold uppercase tracking-wide text-stone-500"><th className="px-5 py-3.5 sm:px-6">Type</th><th className="px-5 py-3.5">Name</th><th className="px-5 py-3.5">Path</th><th className="hidden px-5 py-3.5 md:table-cell">Last updated</th><th className="w-24 px-5 py-3.5 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-stone-100">{items.map((item)=><tr key={item.pin_id} className="hover:bg-emerald-50/40"><td className="px-5 py-4 sm:px-6"><span className="inline-flex items-center gap-3 text-sm text-stone-600"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name={item.kind === 'folder' ? 'folder' : 'document'} className="h-4 w-4" /><PinMarker pinned /></span>{item.type}</span></td><td className="px-5 py-4"><Link href={item.href} className="font-semibold text-[#073d2f] hover:text-arms-green">{item.name}</Link></td><td className="max-w-md px-5 py-4"><span title={item.path} className="block truncate text-sm text-stone-500">{item.path}</span></td><td className="hidden px-5 py-4 text-sm text-stone-500 md:table-cell">{formatDate(item.updated_at)}</td><td className="px-5 py-4 text-right"><Link href={item.href} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-arms-green hover:bg-emerald-50">Open</Link></td></tr>)}</tbody>
            </table>
        </div>
        {page && page.last_page > 1 && <footer className="flex items-center justify-between border-t border-stone-100 px-5 py-4 text-sm sm:px-6"><span className="text-stone-500">Page {page.current_page} of {page.last_page}</span><div className="flex gap-2"><PageButton url={page.prev_page_url} label="Previous" /><PageButton url={page.next_page_url} label="Next" /></div></footer>}
    </>;
}

function PageButton({ url, label }: { url: string | null; label: string }) {
    return <button type="button" disabled={!url} onClick={() => url && router.visit(url, { preserveScroll: true })} className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">{label}</button>;
}
