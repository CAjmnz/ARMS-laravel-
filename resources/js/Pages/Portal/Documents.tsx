import ArmsIcon from '@/Components/ArmsIcon';
import ProtectedPdfCanvas from '@/Components/ProtectedPdfCanvas';
import ProtectedDocumentPreview from '@/Components/ProtectedDocumentPreview';
import { isDocumentImage, isDocumentPdf } from '@/Components/documentPreview';
import UserPortalLayout from '@/Layouts/UserPortalLayout';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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

type Pagination = {
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
};

type Props = {
    summary: { visible_documents: number; can_download: boolean };
    currentFolder: { id: number; route_key: string; name: string } | null;
    breadcrumbs: { id: number; route_key: string; name: string }[];
    folders: FolderItem[];
    documents: DocumentItem[];
    folderPagination: Pagination;
    documentPagination: Pagination;
    filters: { search: string; folder_per_page: number; document_per_page: number };
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

function withArmsTabId(url: string | null | undefined): string | null {
    if (!url) return null;
    if (typeof window === 'undefined') return url;

    const tabId = window.sessionStorage.getItem('arms_tab_id');
    if (!tabId) return url;

    try {
        const previewUrl = new URL(url, window.location.origin);
        if (previewUrl.origin === window.location.origin) {
            previewUrl.searchParams.set('arms_tab_id', tabId);
        }
        return previewUrl.toString();
    } catch {
        return url;
    }
}

function PortalDocumentThumbnail({ document }: { document: DocumentItem }) {
    const isImage = isDocumentImage(document.type, document.name);

    if (!document.viewer_url) {
        return <ArmsIcon name="document" className="h-10 w-10 text-arms-green" />;
    }

    if (isImage) {
        return (
            <img
                src={withArmsTabId(document.viewer_url) ?? undefined}
                alt={document.name}
                loading="lazy"
                className="h-full w-full object-contain"
            />
        );
    }

    return (
        <iframe
            src={withArmsTabId(document.viewer_url) ?? undefined}
            title={`Preview of ${document.name}`}
            tabIndex={-1}
            className="pointer-events-none h-full w-full border-0 bg-white"
        />
    );
}

export default function Documents({ summary, currentFolder, breadcrumbs, folders, documents, folderPagination, documentPagination, filters }: Props) {
    const folderItems = folders;
    const documentItems = documents;
    const [view, setView] = useState<'grid' | 'list'>(() => (window.localStorage.getItem('portal-documents-view') === 'list' ? 'list' : 'grid'));
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewingDocument, setViewingDocument] = useState<DocumentItem | null>(null);
    const [infoTarget, setInfoTarget] = useState<InfoTarget | null>(null);
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<number>>(new Set());
    const [batchDownloadProcessing, setBatchDownloadProcessing] = useState(false);
    const [batchDownloadError, setBatchDownloadError] = useState('');
    const [tableToolsOpen, setTableToolsOpen] = useState(false);
    const [tableToolsMessage, setTableToolsMessage] = useState('');

    const downloadableDocumentIds = useMemo(
        () => new Set(documentItems.filter((document) => Boolean(document.download_url)).map((document) => document.id)),
        [documentItems],
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
            if (next.size >= 100) {
                setBatchDownloadError('You can select a maximum of 100 documents at a time.');
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

    const itemCount = folderPagination.total + documentPagination.total;
    const currentRows = [
        ...folderItems.map((folder) => ({ Kind: 'Folder', Name: folder.name, Type: 'Folder', Modified: formatDate(folder.modified_at), OwnerOrDetails: `${folder.children_count} folders; ${folder.documents_count} files`, Size: '', Status: '', Pinned: folder.is_pinned ? 'Yes' : 'No' })),
        ...documentItems.map((document) => ({ Kind: 'Document', Name: document.name, Type: document.type, Modified: formatDate(document.modified_at), OwnerOrDetails: document.owner, Size: formatSize(document.size), Status: document.status, Pinned: document.is_pinned ? 'Yes' : 'No' })),
    ];

    const exportCurrentPage = () => {
        const columns = ['Kind', 'Name', 'Type', 'Modified', 'OwnerOrDetails', 'Size', 'Status', 'Pinned'] as const;
        const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const csv = [columns.join(','), ...currentRows.map((row) => columns.map((column) => escapeCsv(String(row[column] ?? ''))).join(','))].join('\\r\\n');
        const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `ARMS-portal-documents-page-${documentPagination.current_page}.csv`;
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setTableToolsMessage(`Exported ${currentRows.length} current-page rows to CSV.`);
        setTableToolsOpen(false);
    };

    const copyCurrentPage = async () => {
        const text = [
            ['Kind', 'Name', 'Type', 'Modified', 'Owner / Details', 'Size', 'Status', 'Pinned'].join('\\t'),
            ...currentRows.map((row) => [row.Kind, row.Name, row.Type, row.Modified, row.OwnerOrDetails, row.Size, row.Status, row.Pinned].join('\\t')),
        ].join('\\n');
        try {
            await navigator.clipboard.writeText(text);
            setTableToolsMessage(`Copied ${currentRows.length} current-page rows.`);
        } catch {
            setTableToolsMessage('Clipboard access was blocked by your browser. Use Export CSV instead.');
        }
        setTableToolsOpen(false);
    };

    const changePageSize = (kind: 'folder' | 'document', value: string) => {
        const params: Record<string, string | number> = {
            folder_per_page: kind === 'folder' ? Number(value) : filters.folder_per_page,
            document_per_page: kind === 'document' ? Number(value) : filters.document_per_page,
        };
        if (filters.search) params.search = filters.search;
        router.get(route('portal.documents', currentFolder?.route_key), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const resetTableTools = () => {
        setSearch('');
        setTableToolsMessage('Table preferences reset. Showing 10 folders and 10 documents per page.');
        setTableToolsOpen(false);
        router.get(route('portal.documents', currentFolder?.route_key), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

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
                                <h2 className="mt-1 truncate text-2xl font-semibold text-[#073d2f]">{filters.search ? 'Search Results' : currentFolder?.name ?? 'My Documents'}</h2>
                                <p className="mt-1 text-sm text-stone-500">{itemCount} {itemCount === 1 ? 'item' : 'items'} {filters.search ? 'matching your search' : 'in this location'} · {summary.visible_documents} documents assigned to you</p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <form onSubmit={submitSearch} className="relative min-w-0 sm:w-80">
                                    <ArmsIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search all folders and files"
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

                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                                <span className="font-semibold text-[#073d2f]">Table controls</span>
                                <label className="flex items-center gap-2">Folders
                                    <select aria-label="Folders per page" value={String(filters.folder_per_page)} onChange={(event) => changePageSize('folder', event.target.value)} className="rounded-lg border-stone-300 bg-white py-1.5 pl-2 pr-7 text-xs focus:border-arms-green focus:ring-arms-green">
                                        {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2">Documents
                                    <select aria-label="Documents per page" value={String(filters.document_per_page)} onChange={(event) => changePageSize('document', event.target.value)} className="rounded-lg border-stone-300 bg-white py-1.5 pl-2 pr-7 text-xs focus:border-arms-green focus:ring-arms-green">
                                        {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                                <span>{currentRows.length} rows on this page · {itemCount} total</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-3">
                                {(folderPagination.last_page > 1 || documentPagination.last_page > 1) && (
                                    <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
                                        {folderPagination.last_page > 1 && <CompactPagination title="Folders" pagination={folderPagination} />}
                                        {documentPagination.last_page > 1 && <CompactPagination title="Documents" pagination={documentPagination} />}
                                    </div>
                                )}
                                <div className="relative shrink-0">
                                    <button type="button" aria-expanded={tableToolsOpen} onClick={() => setTableToolsOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50">
                                        Table tools <ArmsIcon name="chevron" className={`h-3.5 w-3.5 transition-transform ${tableToolsOpen ? '-rotate-90' : 'rotate-90'}`} />
                                    </button>
                                    {tableToolsOpen && <div className="absolute right-0 top-12 z-[100] w-56 rounded-xl border border-[#d9e5df] bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(7,61,47,0.18)] ring-1 ring-black/5">
                                        <button type="button" onClick={exportCurrentPage} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Export current page to CSV</button>
                                        <button type="button" onClick={copyCurrentPage} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Copy current page</button>
                                        <button type="button" onClick={() => { setTableToolsOpen(false); setTableToolsMessage('Refreshing document list…'); router.reload(); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Refresh table</button>
                                        <button type="button" onClick={resetTableTools} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Reset search and page size</button>
                                    </div>}
                                </div>
                            </div>
                        </div>
                        {tableToolsMessage && <p role="status" className="mt-2 text-xs font-medium text-stone-500">{tableToolsMessage}</p>}

                        {summary.can_download && (
                            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#073d2f]">{selectedDocumentIds.size} selected</p>
                                    <p className="text-xs text-stone-500">Select up to 100 downloadable documents at a time.</p>
                                </div>
                                <details className="relative">
                                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                                        Bulk Actions
                                        <ArmsIcon name="chevron" className="h-3.5 w-3.5 rotate-90" />
                                    </summary>
                                    <div className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
                                        <button
                                            type="button"
                                            onClick={downloadSelected}
                                            disabled={selectedDocumentIds.size === 0 || batchDownloadProcessing}
                                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {batchDownloadProcessing ? 'Creating ZIP…' : 'Download Selected'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            disabled={selectedDocumentIds.size === 0 || batchDownloadProcessing}
                                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                </details>
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
                        <>
                        {folderItems.length > 0 && (
                            <>
                            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                                {folderItems.map((folder) => (
                                <div key={`folder-${folder.id}`} className="group relative overflow-hidden rounded-xl border border-stone-200 bg-[#fffdf5] p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b7d9cb] hover:shadow-md">
                                    <div className="flex h-9 items-center justify-between px-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Folder</span>
                                        <button type="button" onClick={() => togglePin(folder.pin_url)} title={folder.is_pinned ? 'Unpin' : 'Pin'} className={`rounded-lg p-1.5 ${folder.is_pinned ? 'bg-amber-50 text-amber-600' : 'text-stone-400 hover:bg-stone-100'}`}><ArmsIcon name="pin" className="h-4 w-4" /></button>
                                    </div>
                                    <Link href={folder.open_url} className="grid h-[120px] place-items-center overflow-hidden rounded-lg border border-stone-200 bg-white shadow-inner">
                                        <span className="grid h-20 w-24 place-items-center rounded-2xl bg-amber-50 text-amber-500 shadow-sm ring-1 ring-amber-100 transition-transform duration-200 group-hover:scale-105"><ArmsIcon name="folder" className="h-16 w-16" /></span>
                                    </Link>
                                    <Link href={folder.open_url} className="mt-3 block truncate text-sm font-semibold text-[#073d2f] hover:text-arms-green">{folder.name}</Link>
                                    <p className="mt-1 text-[11px] text-stone-500">{folder.children_count} {folder.children_count === 1 ? 'subfolder' : 'subfolders'} · {formatDate(folder.modified_at)}</p><p className="mt-1 text-[11px] text-stone-500">{folder.documents_count} files</p>
                                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                                        <span>{formatDate(folder.modified_at)}</span>
                                        <button type="button" onClick={() => setInfoTarget({ kind: 'folder', item: folder })} className="font-semibold text-arms-green hover:underline">Details</button>
                                    </div>
                                </div>
                            ))}
                            </div>

                            </>
                        )}
                        {documentItems.length > 0 && (
                            <>
                            <div className="grid w-full gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 xl:grid-cols-5">
                                {documentItems.map((document) => (
                                <div key={`document-${document.id}`} className={`group relative overflow-hidden rounded-xl border bg-[#fffdf5] p-3 text-left shadow-sm transition-all ${selectedDocumentIds.has(document.id) ? 'border-arms-green bg-emerald-50/60 ring-2 ring-emerald-100' : 'border-stone-200 hover:-translate-y-0.5 hover:border-[#b7d9cb] hover:shadow-md'}`}>
                                    <div className="flex h-9 items-center justify-between px-0.5">
                                        {summary.can_download && document.download_url ? (
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${document.name}`}
                                                checked={selectedDocumentIds.has(document.id)}
                                                onChange={() => toggleDocumentSelection(document.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                disabled={batchDownloadProcessing}
                                                className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                                            />
                                        ) : <span />}
                                        <button type="button" onClick={() => togglePin(document.pin_url)} title={document.is_pinned ? 'Unpin' : 'Pin'} className={`rounded-lg p-1.5 ${document.is_pinned ? 'bg-amber-50 text-amber-600' : 'text-stone-400 hover:bg-stone-100'}`}><ArmsIcon name="pin" className="h-4 w-4" /></button>
                                    </div>
                                    <div className="relative mb-0 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-inner">
                                        <button
                                            type="button"
                                            disabled={!document.viewer_url}
                                            onClick={() => document.viewer_url && setViewingDocument(document)}
                                            className="grid h-48 w-full place-items-center overflow-hidden disabled:cursor-default"
                                            aria-label={`Preview ${document.name}`}
                                        >
                                            <PortalDocumentThumbnail document={document} />
                                        </button>
                                    </div>
                                    <button type="button" disabled={!document.viewer_url} onClick={() => document.viewer_url && setViewingDocument(document)} className="block w-full truncate px-0.5 pt-2.5 text-left text-sm font-semibold text-[#073d2f] hover:text-arms-green disabled:cursor-default">{document.name}</button>
                                    <p className="mt-1 truncate text-[11px] text-stone-500">{document.type} · {formatSize(document.size)} · {formatDate(document.modified_at)}</p>
                                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                                        <button type="button" onClick={() => setInfoTarget({ kind: 'document', item: document })} className="text-xs font-semibold text-arms-green hover:underline">Details</button>
                                        {document.download_url && <a href={document.download_url} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-arms-green hover:bg-emerald-100">Download</a>}
                                    </div>
                                </div>
                            ))}
                            </div>

                            </>
                        )}
                        </>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-stone-100 text-left text-sm">
                                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                                    <tr>{summary.can_download && <th className="w-12 px-4 py-4"><span className="sr-only">Select</span></th>}<th className="px-6 py-4">Name</th><th className="px-4 py-4">Type</th><th className="px-4 py-4">Modified</th><th className="hidden px-4 py-4 md:table-cell">Owner / Details</th><th className="px-4 py-4 text-right">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {folderItems.map((folder) => (
                                        <tr key={`folder-${folder.id}`} className="hover:bg-stone-50">
                                            {summary.can_download && <td className="px-4 py-4" />}
                                            <td className="px-6 py-4"><Link href={folder.open_url} className="flex items-center gap-3 font-semibold text-[#173d33] hover:text-arms-green"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-arms-green"><ArmsIcon name="folder" className="h-5 w-5" /></span>{folder.name}</Link></td>
                                            <td className="px-4 py-4 text-stone-600">Folder</td><td className="px-4 py-4 text-stone-600">{formatDate(folder.modified_at)}</td><td className="hidden px-4 py-4 text-stone-500 md:table-cell">{folder.children_count} folders · {folder.documents_count} files</td>
                                            <td className="px-4 py-4"><ActionDropdown><Link href={folder.open_url} className="block rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Open</Link><button type="button" onClick={() => togglePin(folder.pin_url)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50">{folder.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => setInfoTarget({ kind: 'folder', item: folder })} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50">Information</button></ActionDropdown></td>
                                        </tr>
                                    ))}
                                    {documentItems.map((document) => (
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
                                            <td className="px-4 py-4"><ActionDropdown>{document.viewer_url && <button type="button" onClick={() => setViewingDocument(document)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50">View</button>}{document.download_url && <a href={document.download_url} className="block rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Download</a>}<button type="button" onClick={() => togglePin(document.pin_url)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50">{document.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => setInfoTarget({ kind: 'document', item: document })} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50">Information</button></ActionDropdown></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mx-5 mb-5 mt-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 sm:mx-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                            <span className="font-semibold text-[#073d2f]">Table controls</span>
                            <label className="flex items-center gap-2">Folders
                                <select aria-label="Folders per page (bottom)" value={String(filters.folder_per_page)} onChange={(event) => changePageSize('folder', event.target.value)} className="rounded-lg border-stone-300 bg-white py-1.5 pl-2 pr-7 text-xs focus:border-arms-green focus:ring-arms-green">
                                    {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </label>
                            <label className="flex items-center gap-2">Documents
                                <select aria-label="Documents per page (bottom)" value={String(filters.document_per_page)} onChange={(event) => changePageSize('document', event.target.value)} className="rounded-lg border-stone-300 bg-white py-1.5 pl-2 pr-7 text-xs focus:border-arms-green focus:ring-arms-green">
                                    {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </label>
                            <span>{currentRows.length} rows on this page · {itemCount} total</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            {(folderPagination.last_page > 1 || documentPagination.last_page > 1) && (
                                <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
                                    {folderPagination.last_page > 1 && <CompactPagination title="Folders" pagination={folderPagination} />}
                                    {documentPagination.last_page > 1 && <CompactPagination title="Documents" pagination={documentPagination} />}
                                </div>
                            )}
                            <div className="relative shrink-0">
                                <button type="button" aria-expanded={tableToolsOpen} onClick={() => setTableToolsOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50">
                                    Table tools <ArmsIcon name="chevron" className={`h-3.5 w-3.5 transition-transform ${tableToolsOpen ? '-rotate-90' : 'rotate-90'}`} />
                                </button>
                                {tableToolsOpen && <div className="absolute bottom-12 right-0 z-[100] w-56 rounded-xl border border-[#d9e5df] bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(7,61,47,0.18)] ring-1 ring-black/5">
                                    <button type="button" onClick={exportCurrentPage} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Export current page to CSV</button>
                                    <button type="button" onClick={copyCurrentPage} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Copy current page</button>
                                    <button type="button" onClick={() => { setTableToolsOpen(false); setTableToolsMessage('Refreshing document list…'); router.reload(); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Refresh table</button>
                                    <button type="button" onClick={resetTableTools} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50">Reset search and page size</button>
                                </div>}
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {viewingDocument && (
                <PortalProtectedViewer
                    initialDocument={viewingDocument}
                    documents={documentItems}
                    folderPath={['My Documents', ...breadcrumbs.map((item) => item.name)].join(' › ')}
                    onClose={() => setViewingDocument(null)}
                />
            )}

            {infoTarget && (
                <div className="fixed inset-0 z-[110] grid place-items-center bg-[#012a21]/55 p-4 backdrop-blur-sm">
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

function CompactPagination({ title, pagination }: { title: string; pagination: Pagination }) {
    const previous = pagination.links[0];
    const next = pagination.links[pagination.links.length - 1];

    return (
        <nav aria-label={`${title} pagination`} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span className="mr-1 text-xs font-semibold text-stone-500">{title}</span>
            {previous?.url ? (
                <Link href={previous.url} preserveScroll preserveState aria-label={`Previous ${title.toLowerCase()} page`} className="grid h-8 w-8 place-items-center rounded-lg border border-stone-300 bg-white text-lg font-semibold text-arms-green transition hover:border-arms-green hover:bg-emerald-50">‹</Link>
            ) : (
                <span aria-disabled="true" className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-lg text-stone-300">‹</span>
            )}
            <span aria-current="page" aria-label={`Page ${pagination.current_page} of ${pagination.last_page}`} className="grid h-8 min-w-8 place-items-center rounded-lg border border-arms-green bg-arms-green px-2 text-sm font-bold text-white shadow-sm">{pagination.current_page}</span>
            {next?.url ? (
                <Link href={next.url} preserveScroll preserveState aria-label={`Next ${title.toLowerCase()} page`} className="grid h-8 w-8 place-items-center rounded-lg border border-stone-300 bg-white text-lg font-semibold text-arms-green transition hover:border-arms-green hover:bg-emerald-50">›</Link>
            ) : (
                <span aria-disabled="true" className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-lg text-stone-300">›</span>
            )}
        </nav>
    );
}

function ActionDropdown({ children }: { children: ReactNode }) {
    return (
        <details className="relative flex justify-end">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 shadow-sm hover:bg-stone-50 [&::-webkit-details-marker]:hidden" aria-label="Actions">
                <span className="text-xl font-bold leading-none" aria-hidden="true">⋮</span>
            </summary>
            <div className="absolute bottom-full right-0 z-30 mb-1 flex min-w-28 flex-col items-stretch rounded-lg border border-stone-200 bg-white p-1 shadow-lg [&>a]:block [&>a]:w-full [&>a]:rounded-md [&>a]:px-2 [&>a]:py-1.5 [&>a]:text-xs [&>button]:block [&>button]:w-full [&>button]:rounded-md [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs">
                {children}
            </div>
        </details>
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
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pdfViewMode, setPdfViewMode] = useState<'single' | 'vertical'>('single');
    const [showDocumentSidebar, setShowDocumentSidebar] = useState(true);
    const [showFileDetails, setShowFileDetails] = useState(true);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragOrigin = useRef({ x: 0, y: 0 });
    const positionOrigin = useRef({ x: 0, y: 0 });
    const index = documents.findIndex((document) => document.id === current.id);
    // Normalize legacy extensions ('.pdf'), MIME types ('application/pdf'), and filenames.
    const isImage = isDocumentImage(current.type, current.name);
    const isPdf = isDocumentPdf(current.type, current.name);

    const resetForDocument = (document: DocumentItem) => {
        setCurrent(document);
        setZoom(1);
        setFit(true);
        setPage(1);
        setPdfPageCount(0);
        setPdfViewMode('single');
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

    useEffect(() => {
        const handleDropdownOpen = (event: Event) => {
            const openId = (event as CustomEvent<string>).detail;
            if (openId !== 'portal-viewer-actions') setActionsOpen(false);
            if (openId !== 'portal-viewer-zoom') setZoomOpen(false);
        };
        window.addEventListener('arms:dropdown-open', handleDropdownOpen);
        return () => window.removeEventListener('arms:dropdown-open', handleDropdownOpen);
    }, []);

    const notifyDropdownOpen = (id: string) => {
        window.dispatchEvent(new CustomEvent('arms:dropdown-open', { detail: id }));
    };

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
        // Keep the image within a bounded pan range so it cannot be dragged completely out of view.
        const maxX = Math.max(80, event.currentTarget.clientWidth * 0.35);
        const maxY = Math.max(80, event.currentTarget.clientHeight * 0.35);
        const nextX = positionOrigin.current.x + event.clientX - dragOrigin.current.x;
        const nextY = positionOrigin.current.y + event.clientY - dragOrigin.current.y;
        setPosition({
            x: Math.min(maxX, Math.max(-maxX, nextX)),
            y: Math.min(maxY, Math.max(-maxY, nextY)),
        });
    };
    const stopDrag = () => { dragging.current = false; };

    const protectedViewerUrl = withArmsTabId(current.viewer_url);
    const viewerSource = protectedViewerUrl && isPdf
        ? `${protectedViewerUrl}#page=${page}&zoom=${fit ? 'page-fit' : Math.round(zoom * 100)}`
        : protectedViewerUrl;
    const details = [
        ['File type', current.type],
        ['File size', formatSize(current.size)],
        ['Uploaded by', current.owner],
        ['Last modified', formatDate(current.modified_at)],
        ['Status', current.status],
        ['Access', current.download_url ? 'View and download' : 'View only'],
    ] as const;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#012a21]/70 p-2 backdrop-blur-sm sm:p-4">
            <div role="dialog" aria-modal="true" aria-label={`Protected viewer for ${current.name}`} className="flex h-[95vh] w-[97vw] max-w-[1440px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[91vh] sm:w-[93vw]">
                <header className="relative flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-[#0F8A5A] px-4 py-2.5 text-white">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-sm">A</span> ARMS <span className="text-white/50">/</span> Document viewer</div>
                        <h2 className="mt-1 truncate text-base font-semibold">{current.name}</h2>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs">
                            <p className="min-w-0 flex-1 truncate">{folderPath}</p>
                            <span className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-bold">{isPdf ? `Page ${Math.min(page, pdfPageCount || 1)} of ${pdfPageCount || '…'}` : `File ${index + 1} of ${documents.length}`}</span>
                            <button type="button" role="switch" aria-checked={pdfViewMode === 'vertical'} aria-label={`Document view: ${pdfViewMode}. Switch to ${pdfViewMode === 'single' ? 'vertical' : 'single'} view`} onClick={() => { if (pdfViewMode === 'single') { setPdfViewMode('vertical'); setPage(1); } else { setPdfViewMode('single'); setPage(1); setZoom(1); setFit(true); setPosition({ x: 0, y: 0 }); } }} className="relative flex h-9 w-[142px] items-center rounded-full border border-white/60 bg-white/10 p-1"><span className={`absolute left-1 top-1 h-[27px] w-[68px] rounded-full bg-white shadow-sm transition-transform duration-200 ${pdfViewMode === 'vertical' ? 'translate-x-[68px]' : 'translate-x-0'}`} /><span className={`relative z-10 flex-1 text-center text-xs font-bold ${pdfViewMode === 'single' ? 'text-arms-green' : 'text-white'}`}>Single</span><span className={`relative z-10 flex-1 text-center text-xs font-bold ${pdfViewMode === 'vertical' ? 'text-arms-green' : 'text-white'}`}>Vertical</span></button>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="relative">
                            <button type="button" onClick={() => { const next = !actionsOpen; if (next) notifyDropdownOpen('portal-viewer-actions'); setActionsOpen(next); }} className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Actions⌄</button>
                            {actionsOpen && <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm text-stone-700 shadow-2xl">
                                {current.download_url && <a href={current.download_url} onClick={() => setActionsOpen(false)} className="block rounded-lg px-3 py-2.5 hover:bg-stone-50">⇩ Download viewer</a>}
                                <button type="button" onClick={() => { setShowDocumentSidebar((value) => !value); setActionsOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">{showDocumentSidebar ? 'Hide file thumbnails' : 'Show file thumbnails'}</button>
                                <button type="button" onClick={() => { setShowFileDetails((value) => !value); setActionsOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">{showFileDetails ? 'Hide details' : 'Show details'}</button>
                            </div>}
                        </div>
                        <div className="relative">
                            <button type="button" onClick={() => { const next = !zoomOpen; if (next) notifyDropdownOpen('portal-viewer-zoom'); setZoomOpen(next); }} className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Zoom ▾</button>
                            {zoomOpen && <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-stone-200 bg-white p-2 text-sm text-stone-700 shadow-2xl">
                                <div className="flex items-center justify-between px-2 py-1.5"><span className="text-xs font-semibold text-stone-500">Zoom level</span><strong className="text-arms-green">{Math.round(zoom * 100)}%</strong></div>
                                <div className="grid grid-cols-2 gap-1"><button type="button" disabled={!isImage && !isPdf} onClick={() => adjustZoom(-0.1)} className="rounded-lg px-2 py-2 text-left hover:bg-stone-50 disabled:opacity-35">− Zoom out</button><button type="button" disabled={!isImage && !isPdf} onClick={() => adjustZoom(0.1)} className="rounded-lg px-2 py-2 text-left hover:bg-stone-50 disabled:opacity-35">+ Zoom in</button></div>
                                <div className="my-1 border-t border-stone-100"/><button type="button" disabled={!isImage && !isPdf} onClick={() => { setFit(true); setZoom(1); setPosition({ x: 0, y: 0 }); setZoomOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-35">Fit to screen</button>
                                <button type="button" disabled={!isImage && !isPdf} onClick={() => { setFit(false); setZoom(1); setPosition({ x: 0, y: 0 }); setZoomOpen(false); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-35">Actual size (100%)</button>
                            </div>}
                        </div>
                        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-white/40 text-xl hover:bg-white/10" aria-label="Close protected viewer">×</button>
                    </div>
                </header>
                <nav aria-label="Document breadcrumb" className="flex h-10 shrink-0 items-center gap-2 overflow-hidden border-b border-[#E5E7EB] bg-white px-5 text-xs text-[#6B7280]"><span>Documents</span><span>›</span><span className="truncate">{folderPath || 'Current folder'}</span><span>›</span><span className="truncate font-semibold text-[#1F2937]">{current.name}</span><div className="ml-auto flex shrink-0 items-center gap-2"><button type="button" disabled={index <= 0} onClick={() => changeDocument(index - 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 font-semibold disabled:opacity-35">‹ Previous</button><button type="button" disabled={index >= documents.length - 1} onClick={() => changeDocument(index + 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 font-semibold disabled:opacity-35">Next ›</button></div></nav>

                <div className="flex min-h-0 flex-1 overflow-hidden bg-[#24313a]">
                    {showDocumentSidebar && <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-white/10 bg-[#f8faf9] p-3 sm:block">
                        <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Files in this folder</p>
                        <div className="space-y-2">{documents.map((item) => <button key={item.id} type="button" onClick={() => resetForDocument(item)} className={`w-full rounded-xl border p-2 text-left ${item.id === current.id ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-100' : 'border-stone-200 bg-white hover:border-emerald-300'}`}><div className="grid h-20 place-items-center overflow-hidden rounded-lg bg-stone-100">{isDocumentImage(item.type, item.name) && item.viewer_url ? <img src={withArmsTabId(item.viewer_url) ?? undefined} alt="" loading="lazy" className="h-full w-full object-contain" /> : <ArmsIcon name="document" className="h-8 w-8 text-arms-green" />}</div><p className="mt-2 truncate text-[11px] font-semibold text-stone-700">{item.name}</p><p className="mt-0.5 text-[10px] uppercase text-stone-400">{item.type}</p></button>)}</div>
                    </aside>}
                    <div onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag} onWheel={(event) => { if (event.ctrlKey && (isImage || isPdf)) { event.preventDefault(); adjustZoom(event.deltaY < 0 ? 0.1 : -0.1); } }} onScroll={(event) => { if (pdfViewMode !== 'vertical') return; const container = event.currentTarget; const sections = Array.from(container.querySelectorAll<HTMLElement>('[data-vertical-file]')); if (!sections.length) return; const top = container.getBoundingClientRect().top; let closest = Number.POSITIVE_INFINITY; let visible: DocumentItem | undefined; sections.forEach((section) => { const distance = Math.abs(section.getBoundingClientRect().top - top - 24); if (distance < closest) { closest = distance; visible = documents.find((item) => item.id === Number(section.dataset.verticalFile)); } }); if (visible && visible.id !== current.id) setCurrent(visible); }} className={`relative min-h-0 min-w-0 flex-1 overflow-auto p-4 sm:p-5 ${isImage ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        {pdfViewMode === 'vertical' ? <div className="flex min-h-full flex-col items-center gap-6">{documents.map((item) => { const itemUrl = withArmsTabId(item.viewer_url); const itemIsImage = isDocumentImage(item.type, item.name); const itemIsPdf = isDocumentPdf(item.type, item.name); return <section key={item.id} data-vertical-file={item.id} className="w-full max-w-[calc(100vw-80px)] shrink-0">{!itemUrl ? <div className="grid min-h-[420px] place-items-center rounded-xl bg-white text-stone-500">Protected preview is not available.</div> : itemIsImage ? <div className="flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-lg bg-white"><img draggable={false} src={itemUrl} alt={item.name} loading="lazy" className={fit ? 'max-h-[calc(100vh-170px)] max-w-full select-none object-contain' : 'max-h-none max-w-none select-none'} style={{ zoom: fit ? 1 : zoom }} /></div> : itemIsPdf ? <ProtectedPdfCanvas src={itemUrl} page={item.id === current.id ? page : 1} onPageChange={(nextPage) => { if (item.id === current.id) setPage(nextPage); }} zoom={zoom} fit={fit} mode="vertical" onPageCount={(count) => { if (item.id === current.id) setPdfPageCount(count); }} onVisiblePageChange={(visiblePage) => { if (item.id === current.id) setPage(visiblePage); }} className="mx-auto w-full" lazy /> : <ProtectedDocumentPreview viewerUrl={itemUrl} filename={item.name} />}</section>; })}</div> : !viewerSource ? <div className="grid h-full min-h-[420px] place-items-center rounded-xl bg-white text-stone-500">Protected preview is not available.</div> : isImage ? <div className="grid min-h-full min-w-full place-items-center overflow-visible"><img draggable={false} src={viewerSource} alt={current.name} className={`select-none ${fit ? 'max-h-[calc(100vh-170px)] max-w-full object-contain' : 'max-h-none max-w-none'}`} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${fit ? 1 : zoom})`, transformOrigin: 'center center' }} /></div> : isPdf ? <ProtectedPdfCanvas src={protectedViewerUrl!} page={page} onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), pdfPageCount || nextPage))} zoom={zoom} fit={fit} mode="single" onPageCount={(count) => { setPdfPageCount(count); if (count > 0) setPage((value) => Math.min(value, count)); }} onVisiblePageChange={setPage} className="mx-auto w-full" /> : <ProtectedDocumentPreview viewerUrl={protectedViewerUrl!} filename={current.name} />}
                    </div>
                    {showFileDetails && <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-white/10 bg-white p-4 lg:block"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-arms-green">File details</p><h3 className="mt-2 break-words text-sm font-semibold text-[#073d2f]">{current.name}</h3><dl className="mt-4 space-y-3">{details.map(([label, value]) => <div key={label} className="border-b border-stone-100 pb-2"><dt className="text-[11px] text-stone-500">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-stone-800">{value}</dd></div>)}</dl><p className="mt-4 rounded-lg bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-900">This preview is served through your authorized document link. Access permissions still apply.</p></aside>}
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-4 py-2.5 text-[11px] text-stone-500"><span className="truncate">{folderPath}</span><span>{isPdf ? `PDF · Page ${Math.min(page, pdfPageCount || page)} of ${pdfPageCount || '…'}` : isImage ? 'Image preview · Ctrl + wheel to zoom' : 'Protected preview'}</span></footer>
            </div>
        </div>
    );
}
