import ArmsIcon from '@/Components/ArmsIcon';
import UserPortalLayout from '@/Layouts/UserPortalLayout';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type FolderItem = {
    id: number;
    route_key: string;
    name: string;
    type: 'Folder';
    modified_at?: string | null;
    children_count: number;
    documents_count: number;
    is_pinned: boolean;
    pin_url: string;
    open_url: string;
    information_url: string;
};

type DocumentItem = {
    id: number;
    route_key: string;
    name: string;
    type: string;
    modified_at?: string | null;
    owner: string;
    size?: number | null;
    status: string;
    is_pinned: boolean;
    pin_url: string;
    viewer_url?: string | null;
    download_url?: string | null;
    information_url: string;
};

type Props = {
    summary: { visible_documents: number; can_download: boolean };
    currentFolder: { id: number; route_key: string; name: string } | null;
    breadcrumbs: { id: number; route_key: string; name: string }[];
    folders: FolderItem[];
    documents: DocumentItem[];
    filters: { search: string };
};

type InfoTarget =
    | { kind: 'folder'; item: FolderItem }
    | { kind: 'document'; item: DocumentItem };

const formatDate = (value?: string | null) =>
    value ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';

const formatSize = (bytes?: number | null) => {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function Documents({ summary, currentFolder, breadcrumbs, folders, documents, filters }: Props) {
    const [view, setView] = useState<'grid' | 'list'>(() => (window.localStorage.getItem('portal-documents-view') === 'list' ? 'list' : 'grid'));
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingDocument, setViewingDocument] = useState<DocumentItem | null>(null);
    const [infoTarget, setInfoTarget] = useState<InfoTarget | null>(null);
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<number>>(new Set());
    const [batchDownloadProcessing, setBatchDownloadProcessing] = useState(false);
    const [batchDownloadError, setBatchDownloadError] = useState('');

    const downloadableDocumentIds = useMemo(
        () => new Set(documents.filter((document) => Boolean(document.download_url)).map((document) => document.id)),
        [documents],
    );

    useEffect(() => {
        window.localStorage.setItem('portal-documents-view', view);
    }, [view]);

    useEffect(() => {
        setSearch(filters.search ?? '');
    }, [filters.search]);

    useEffect(() => {
        setSelectedDocumentIds((current) => new Set([...current].filter((id) => downloadableDocumentIds.has(id))));
    }, [downloadableDocumentIds]);

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('portal.documents', currentFolder?.route_key),
            search.trim() ? { search: search.trim() } : {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const clearSearch = () => {
        setSearch('');
        router.get(route('portal.documents', currentFolder?.route_key), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const togglePin = (url: string) => {
        router.patch(url, {}, { preserveScroll: true, preserveState: true });
    };

    const toggleDocumentSelection = (documentId: number) => {
        if (!summary.can_download || !downloadableDocumentIds.has(documentId) || batchDownloadProcessing) return;

        setBatchDownloadError('');
        setSelectedDocumentIds((current) => {
            const next = new Set(current);
            if (next.has(documentId)) {
                next.delete(documentId);
                return next;
            }
            if (next.size >= 50) {
                setBatchDownloadError('You can select a maximum of 50 documents at a time.');
                return current;
            }
            next.add(documentId);
            return next;
        });
    };

    const clearSelection = () => {
        if (batchDownloadProcessing) return;
        setSelectedDocumentIds(new Set());
        setBatchDownloadError('');
    };

    const downloadSelected = async () => {
        const documentIds = [...selectedDocumentIds];
        if (!summary.can_download || documentIds.length === 0 || batchDownloadProcessing) return;

        setBatchDownloadProcessing(true);
        setBatchDownloadError('');

        try {
            const response = await axios.post(
                route('documents.bulk-download'),
                { document_ids: documentIds },
                { responseType: 'blob' },
            );

            const disposition = response.headers['content-disposition'] as string | undefined;
            const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
            const quotedName = disposition?.match(/filename="([^"]+)"/i)?.[1];
            const filename = encodedName
                ? decodeURIComponent(encodedName)
                : quotedName || `RMS-selected-documents-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.zip`;

            const url = window.URL.createObjectURL(response.data);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = filename;
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setSelectedDocumentIds(new Set());
        } catch (error) {
            let message = 'The selected documents could not be downloaded. Please try again.';
            if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
                try {
                    const payload = JSON.parse(await error.response.data.text()) as { message?: string; errors?: Record<string, string[]> };
                    message = Object.values(payload.errors ?? {}).flat()[0] ?? payload.message ?? message;
                } catch {
                    // Keep the safe fallback when the server did not return JSON.
                }
            }
            setBatchDownloadError(message);
        } finally {
            setBatchDownloadProcessing(false);
        }
    };

    const itemCount = folders.length + documents.length;

    return (
        <UserPortalLayout title="My Documents" description="Browse records that have been shared with your RMS account.">
            <Head title="My Documents" />

            <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <nav aria-label="Document path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
                        <Link href={route('portal.documents')} className="rounded-lg px-2 py-1 font-semibold text-arms-green hover:bg-emerald-50">
                            My Documents
                        </Link>
                        {breadcrumbs.map((item) => (
                            <span key={item.id} className="flex min-w-0 items-center gap-1">
                                <span className="text-stone-400">›</span>
                                <Link href={route('portal.documents', item.route_key)} className="max-w-48 truncate rounded-lg px-2 py-1 font-medium text-stone-700 hover:bg-stone-100">
                                    {item.name}
                                </Link>
                            </span>
                        ))}
                    </nav>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-arms-green">
                        {summary.can_download ? 'View & download' : 'View only'}
                    </span>
                </div>

                <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                    <header className="border-b border-stone-100 px-5 py-5 sm:px-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087451]">Authorized records</p>
                                <h2 className="mt-1 truncate text-2xl font-semibold text-[#073d2f]">{currentFolder?.name ?? 'My Documents'}</h2>
                                <p className="mt-1 text-sm text-stone-500">{itemCount} {itemCount === 1 ? 'item' : 'items'} in this location · {summary.visible_documents} documents assigned to you</p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <form onSubmit={submitSearch} className="relative min-w-0 sm:w-80">
                                    <ArmsIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search this folder"
                                        className="h-11 w-full rounded-xl border-stone-300 bg-stone-50 pl-10 pr-20 text-sm focus:border-arms-green focus:bg-white focus:ring-arms-green"
                                    />
                                    {search && <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500 hover:text-arms-green">Clear</button>}
                                </form>
                                <div className="flex rounded-xl border border-stone-200 bg-stone-50 p-1">
                                    <button type="button" onClick={() => setView('grid')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'grid' ? 'bg-white text-arms-green shadow-sm' : 'text-stone-500'}`}>Grid</button>
                                    <button type="button" onClick={() => setView('list')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'list' ? 'bg-white text-arms-green shadow-sm' : 'text-stone-500'}`}>List</button>
                                </div>
                            </div>
                        </div>

                        {summary.can_download && (
                            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#073d2f]">{selectedDocumentIds.size} selected</p>
                                    <p className="text-xs text-stone-500">Select up to 50 downloadable documents in this folder.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedDocumentIds.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            disabled={batchDownloadProcessing}
                                            className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Clear selection
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={downloadSelected}
                                        disabled={selectedDocumentIds.size === 0 || batchDownloadProcessing}
                                        className="rounded-xl bg-arms-green px-4 py-2 text-sm font-semibold text-white hover:bg-[#076244] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {batchDownloadProcessing ? 'Creating ZIP…' : 'Download Selected'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {batchDownloadError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {batchDownloadError}
                            </div>
                        )}
                    </header>

                    {itemCount === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-8 w-8" /></span>
                            <h3 className="mt-5 text-xl font-semibold text-[#073d2f]">{filters.search ? 'No matching records' : 'No records in this location'}</h3>
                            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
                                {filters.search ? 'Try a different search term or clear the search.' : 'Only folders and documents shared with your account appear here.'}
                            </p>
                            {filters.search && <button type="button" onClick={clearSearch} className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-arms-green">Clear search</button>}
                        </div>
                    ) : view === 'grid' ? (
                        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
                            {folders.map((folder) => (
                                <div key={`folder-${folder.id}`} className="group rounded-2xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                                    <div className="flex items-start justify-between gap-3">
                                        <Link href={folder.open_url} className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-6 w-6" /></Link>
                                        <button type="button" onClick={() => togglePin(folder.pin_url)} title={folder.is_pinned ? 'Unpin' : 'Pin'} className={`rounded-lg p-2 ${folder.is_pinned ? 'bg-amber-50 text-amber-600' : 'text-stone-400 hover:bg-stone-50'}`}><ArmsIcon name="pin" className="h-4 w-4" /></button>
                                    </div>
                                    <Link href={folder.open_url} className="mt-4 block truncate font-semibold text-[#173d33] hover:text-arms-green">{folder.name}</Link>
                                    <p className="mt-1 text-xs text-stone-500">{folder.children_count} folders · {folder.documents_count} files</p>
                                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                                        <span>{formatDate(folder.modified_at)}</span>
                                        <button type="button" onClick={() => setInfoTarget({ kind: 'folder', item: folder })} className="font-semibold text-arms-green hover:underline">Details</button>
                                    </div>
                                </div>
                            ))}
                            {documents.map((document) => (
                                <div key={`document-${document.id}`} className={`group rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md ${selectedDocumentIds.has(document.id) ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-stone-200 hover:border-emerald-200'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2">
                                            {summary.can_download && document.download_url && (
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${document.name}`}
                                                    checked={selectedDocumentIds.has(document.id)}
                                                    onChange={() => toggleDocumentSelection(document.id)}
                                                    disabled={batchDownloadProcessing}
                                                    className="mt-1 h-4 w-4 rounded border-stone-300 text-arms-green focus:ring-arms-green"
                                                />
                                            )}
                                            <button type="button" disabled={!document.viewer_url} onClick={() => document.viewer_url && setViewingDocument(document)} className="grid h-12 w-12 place-items-center rounded-xl bg-stone-100 text-stone-700 disabled:opacity-40"><ArmsIcon name="document" className="h-6 w-6" /></button>
                                        </div>
                                        <button type="button" onClick={() => togglePin(document.pin_url)} title={document.is_pinned ? 'Unpin' : 'Pin'} className={`rounded-lg p-2 ${document.is_pinned ? 'bg-amber-50 text-amber-600' : 'text-stone-400 hover:bg-stone-50'}`}><ArmsIcon name="pin" className="h-4 w-4" /></button>
                                    </div>
                                    <button type="button" disabled={!document.viewer_url} onClick={() => document.viewer_url && setViewingDocument(document)} className="mt-4 block w-full truncate text-left font-semibold text-[#173d33] hover:text-arms-green disabled:cursor-default">{document.name}</button>
                                    <p className="mt-1 text-xs text-stone-500">{document.type} · {formatSize(document.size)}</p>
                                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                                        <button type="button" onClick={() => setInfoTarget({ kind: 'document', item: document })} className="text-xs font-semibold text-arms-green hover:underline">Details</button>
                                        {document.download_url && <a href={document.download_url} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-arms-green hover:bg-emerald-100">Download</a>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-stone-100 text-left text-sm">
                                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                                    <tr>{summary.can_download && <th className="w-12 px-4 py-4"><span className="sr-only">Select</span></th>}<th className="px-6 py-4">Name</th><th className="px-4 py-4">Type</th><th className="px-4 py-4">Modified</th><th className="hidden px-4 py-4 md:table-cell">Owner / Details</th><th className="px-4 py-4 text-right">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {folders.map((folder) => (
                                        <tr key={`folder-${folder.id}`} className="hover:bg-stone-50">
                                            {summary.can_download && <td className="px-4 py-4" />}
                                            <td className="px-6 py-4"><Link href={folder.open_url} className="flex items-center gap-3 font-semibold text-[#173d33] hover:text-arms-green"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-5 w-5" /></span>{folder.name}</Link></td>
                                            <td className="px-4 py-4 text-stone-600">Folder</td><td className="px-4 py-4 text-stone-600">{formatDate(folder.modified_at)}</td><td className="hidden px-4 py-4 text-stone-500 md:table-cell">{folder.children_count} folders · {folder.documents_count} files</td>
                                            <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => togglePin(folder.pin_url)} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">{folder.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => setInfoTarget({ kind: 'folder', item: folder })} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Details</button></div></td>
                                        </tr>
                                    ))}
                                    {documents.map((document) => (
                                        <tr key={`document-${document.id}`} className={selectedDocumentIds.has(document.id) ? 'bg-emerald-50/50' : 'hover:bg-stone-50'}>
                                            {summary.can_download && (
                                                <td className="px-4 py-4">
                                                    {document.download_url && (
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${document.name}`}
                                                            checked={selectedDocumentIds.has(document.id)}
                                                            onChange={() => toggleDocumentSelection(document.id)}
                                                            disabled={batchDownloadProcessing}
                                                            className="h-4 w-4 rounded border-stone-300 text-arms-green focus:ring-arms-green"
                                                        />
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4"><button type="button" disabled={!document.viewer_url} onClick={() => document.viewer_url && setViewingDocument(document)} className="flex items-center gap-3 font-semibold text-[#173d33] hover:text-arms-green disabled:cursor-default"><span className="grid h-9 w-9 place-items-center rounded-lg bg-stone-100 text-stone-700"><ArmsIcon name="document" className="h-5 w-5" /></span>{document.name}</button></td>
                                            <td className="px-4 py-4 text-stone-600">{document.type}</td><td className="px-4 py-4 text-stone-600">{formatDate(document.modified_at)}</td><td className="hidden px-4 py-4 text-stone-500 md:table-cell">{document.owner}</td>
                                            <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setInfoTarget({ kind: 'document', item: document })} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Details</button>{document.download_url && <a href={document.download_url} className="rounded-lg bg-arms-green px-2.5 py-1.5 text-xs font-semibold text-white">Download</a>}</div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {viewingDocument && (
                <PortalProtectedViewer
                    initialDocument={viewingDocument}
                    documents={documents}
                    folderPath={['My Documents', ...breadcrumbs.map((item) => item.name)].join(' › ')}
                    onClose={() => setViewingDocument(null)}
                />
            )}

            {infoTarget && (
                <div className="fixed inset-0 z-[110] grid place-items-center bg-[#012a21]/55 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-arms-green">Item details</p><h3 className="mt-1 text-xl font-semibold text-[#073d2f]">{infoTarget.item.name}</h3></div><button type="button" onClick={() => setInfoTarget(null)} className="text-2xl text-stone-400">×</button></div>
                        <dl className="mt-6 space-y-4 text-sm">
                            <Detail label="Type" value={infoTarget.kind === 'folder' ? 'Folder' : infoTarget.item.type} />
                            <Detail label="Modified" value={formatDate(infoTarget.item.modified_at)} />
                            {infoTarget.kind === 'folder' ? <><Detail label="Visible folders" value={String(infoTarget.item.children_count)} /><Detail label="Visible documents" value={String(infoTarget.item.documents_count)} /></> : <><Detail label="Owner / Uploaded by" value={infoTarget.item.owner} /><Detail label="Size" value={formatSize(infoTarget.item.size)} /><Detail label="Status" value={infoTarget.item.status} /></>}
                        </dl>
                        <div className="mt-6 flex justify-end"><button type="button" onClick={() => setInfoTarget(null)} className="rounded-xl bg-arms-green px-4 py-2 text-sm font-semibold text-white">Done</button></div>
                    </div>
                </div>
            )}
        </UserPortalLayout>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-3"><dt className="text-stone-500">{label}</dt><dd className="max-w-[65%] text-right font-medium text-[#173d33]">{value}</dd></div>;
}

function PortalProtectedViewer({ initialDocument, documents, folderPath, onClose }: { initialDocument: DocumentItem; documents: DocumentItem[]; folderPath: string; onClose: () => void }) {
    const [current, setCurrent] = useState(initialDocument);
    const [zoom, setZoom] = useState(1);
    const [fit, setFit] = useState(true);
    const [page, setPage] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragOrigin = useRef({ x: 0, y: 0 });
    const positionOrigin = useRef({ x: 0, y: 0 });
    const index = documents.findIndex((document) => document.id === current.id);
    const type = current.type.toUpperCase();
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(type);
    const isPdf = type === 'PDF';

    const resetForDocument = (document: DocumentItem) => {
        setCurrent(document);
        setZoom(1);
        setFit(true);
        setPage(1);
        setPosition({ x: 0, y: 0 });
    };

    const changeDocument = (nextIndex: number) => {
        if (nextIndex < 0 || nextIndex >= documents.length) return;
        resetForDocument(documents[nextIndex]);
    };

    useEffect(() => {
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft' && index > 0) changeDocument(index - 1);
            if (event.key === 'ArrowRight' && index < documents.length - 1) changeDocument(index + 1);
        };
        window.addEventListener('keydown', keyboard);
        return () => {
            window.document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', keyboard);
        };
    }, [index, documents.length]);

    const adjustZoom = (delta: number) => {
        setFit(false);
        setZoom((value) => Math.min(4, Math.max(0.25, Number((value + delta).toFixed(2)))));
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

    const viewerSource = current.viewer_url && isPdf
        ? `${current.viewer_url}#page=${page}&zoom=${fit ? 'page-fit' : Math.round(zoom * 100)}`
        : current.viewer_url;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#012a21]/75 p-3 sm:p-4">
            <div role="dialog" aria-modal="true" aria-label={`Protected viewer for ${current.name}`} className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex flex-wrap items-start justify-between gap-4 bg-[#073d2f] px-5 py-4 text-white sm:px-6">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e2b83b]">Protected RMS viewer</p>
                        <h2 className="mt-1 truncate text-lg font-semibold sm:text-xl">{current.name}</h2>
                        <p className="mt-1 truncate text-xs text-emerald-100">{folderPath} · Document {index + 1} of {documents.length}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {current.download_url && <a href={current.download_url} className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">Download</a>}
                        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/30 text-xl hover:bg-white/10" aria-label="Close protected viewer">×</button>
                    </div>
                </header>

                <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 text-sm">
                    <button type="button" disabled={index <= 0} onClick={() => changeDocument(index - 1)} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">‹ Previous</button>
                    <button type="button" disabled={index >= documents.length - 1} onClick={() => changeDocument(index + 1)} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">Next ›</button>
                    <span className="mx-1 h-6 w-px bg-stone-200" />
                    <button type="button" onClick={() => adjustZoom(-0.1)} disabled={!isImage && !isPdf} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">− Zoom</button>
                    <span className="min-w-14 text-center font-semibold text-arms-green">{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={() => adjustZoom(0.1)} disabled={!isImage && !isPdf} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">+ Zoom</button>
                    <button type="button" onClick={() => { setFit(true); setZoom(1); setPosition({ x: 0, y: 0 }); }} disabled={!isImage && !isPdf} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">Fit to screen</button>
                    <button type="button" onClick={() => { setFit(false); setZoom(1); setPosition({ x: 0, y: 0 }); }} disabled={!isImage && !isPdf} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">Actual size</button>
                    {isPdf && <><span className="mx-1 h-6 w-px bg-stone-200" /><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold disabled:opacity-35">Prev page</button><label className="flex items-center gap-2 text-stone-600">Page <input type="number" min={1} value={page} onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))} className="w-16 rounded-lg border-stone-300 py-1.5 text-center text-sm" /></label><button type="button" onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-stone-300 px-3 py-2 font-semibold">Next page</button></>}
                </div>

                <div
                    onMouseDown={startDrag}
                    onMouseMove={moveDrag}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                    onWheel={(event) => { if (event.ctrlKey && (isImage || isPdf)) { event.preventDefault(); adjustZoom(event.deltaY < 0 ? 0.1 : -0.1); } }}
                    className={`relative min-h-0 flex-1 overflow-auto scroll-smooth bg-[#26343d] p-4 ${isImage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                    {!viewerSource ? (
                        <div className="grid h-full min-h-[420px] place-items-center rounded-xl bg-white text-stone-500">Protected preview is not available.</div>
                    ) : isImage ? (
                        <div className="grid min-h-full min-w-full place-items-center overflow-visible">
                            <img
                                draggable={false}
                                src={viewerSource}
                                alt={current.name}
                                className={`select-none ${fit ? 'max-h-full max-w-full object-contain' : 'max-h-none max-w-none'}`}
                                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
                            />
                        </div>
                    ) : (
                        <iframe title={current.name} src={viewerSource} className="h-full min-h-[520px] w-full rounded-lg border-0 bg-white" />
                    )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-3 text-xs text-stone-500">
                    <span className="truncate">{folderPath}</span>
                    <span>{isImage ? 'Drag image to pan · Ctrl + wheel to zoom' : isPdf ? 'PDF page and zoom controls use the protected browser viewer.' : 'Protected viewer copy only.'}</span>
                </footer>
            </div>
        </div>
    );
}
