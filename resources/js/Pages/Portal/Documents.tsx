import ArmsIcon from '@/Components/ArmsIcon';
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

function PortalDocumentThumbnail({ document }: { document: DocumentItem }) {
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(document.type.toUpperCase());

    if (!document.viewer_url) {
        return <ArmsIcon name="document" className="h-10 w-10 text-arms-green" />;
    }

    if (isImage) {
        return (
            <img
                src={document.viewer_url}
                alt={document.name}
                loading="lazy"
                className="h-full w-full object-contain"
            />
        );
    }

    return (
        <iframe
            src={document.viewer_url}
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
                            <div className="grid grid-cols-4 gap-4 p-5 sm:p-6">
                                {folderItems.map((folder) => (
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
                            </div>
                            {folderPagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-700 shadow-sm sm:px-6">
                                    <span className="font-semibold text-stone-700">Folders {folderPagination.from ?? 0}–{folderPagination.to ?? 0} of {folderPagination.total}</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {folderPagination.links.map((link, i) => link.url ? (
                                            <Link key={`grid-f-${i}`} href={link.url} preserveScroll preserveState className={`min-w-9 rounded-lg border px-3 py-2 text-center font-semibold shadow-sm transition ${link.active ? 'border-arms-green bg-arms-green text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-arms-green hover:bg-emerald-50 hover:text-arms-green'}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : null)}
                                    </div>
                                </div>
                            )}
                            </>
                        )}
                        {documentItems.length > 0 && (
                            <>
                            <div className="grid w-full grid-cols-4 gap-4 p-5 sm:p-6">
                                {documentItems.map((document) => (
                                <div key={`document-${document.id}`} className={`group rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md ${selectedDocumentIds.has(document.id) ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-stone-200 hover:border-emerald-200'}`}>
                                    <div className="relative mb-4 h-40 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                                        <button
                                            type="button"
                                            disabled={!document.viewer_url}
                                            onClick={() => document.viewer_url && setViewingDocument(document)}
                                            className="absolute inset-0 grid place-items-center disabled:cursor-default"
                                            aria-label={`Preview ${document.name}`}
                                        >
                                            <PortalDocumentThumbnail document={document} />
                                        </button>
                                        <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
                                            {summary.can_download && document.download_url && (
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${document.name}`}
                                                    checked={selectedDocumentIds.has(document.id)}
                                                    onChange={() => toggleDocumentSelection(document.id)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    disabled={batchDownloadProcessing}
                                                    className="h-4 w-4 rounded border-stone-300 bg-white text-arms-green shadow-sm focus:ring-arms-green"
                                                />
                                            )}
                                        </div>
                                        <button type="button" onClick={() => togglePin(document.pin_url)} title={document.is_pinned ? 'Unpin' : 'Pin'} className={`absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-2 shadow-sm backdrop-blur ${document.is_pinned ? 'text-amber-600' : 'text-stone-400 hover:bg-white'}`}><ArmsIcon name="pin" className="h-4 w-4" /></button>
                                    </div>
                                    <button type="button" disabled={!document.viewer_url} onClick={() => document.viewer_url && setViewingDocument(document)} className="block w-full truncate text-left font-semibold text-[#173d33] hover:text-arms-green disabled:cursor-default">{document.name}</button>
                                    <p className="mt-1 text-xs text-stone-500">{document.type} · {formatSize(document.size)}</p>
                                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                                        <button type="button" onClick={() => setInfoTarget({ kind: 'document', item: document })} className="text-xs font-semibold text-arms-green hover:underline">Details</button>
                                        {document.download_url && <a href={document.download_url} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-arms-green hover:bg-emerald-100">Download</a>}
                                    </div>
                                </div>
                            ))}
                            </div>
                            {documentPagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-700 shadow-sm sm:px-6">
                                    <span className="font-semibold text-stone-700">Documents {documentPagination.from ?? 0}–{documentPagination.to ?? 0} of {documentPagination.total}</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {documentPagination.links.map((link, i) => link.url ? (
                                            <Link key={`grid-d-${i}`} href={link.url} preserveScroll preserveState className={`min-w-9 rounded-lg border px-3 py-2 text-center font-semibold shadow-sm transition ${link.active ? 'border-arms-green bg-arms-green text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-arms-green hover:bg-emerald-50 hover:text-arms-green'}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : null)}
                                    </div>
                                </div>
                            )}
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

                    {view === 'list' && (folderPagination.total > 0 || documentPagination.total > 0) && (
                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 text-sm text-stone-500 sm:px-6">
                            <span>Folders {folderPagination.from ?? 0}–{folderPagination.to ?? 0} of {folderPagination.total} · Documents {documentPagination.from ?? 0}–{documentPagination.to ?? 0} of {documentPagination.total}</span>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2">Folders <select value={filters.folder_per_page} onChange={(e) => router.get(route('portal.documents', currentFolder?.route_key), { search: filters.search || undefined, folder_per_page: Number(e.target.value), document_per_page: filters.document_per_page, folder_page: 1, document_page: documentPagination.current_page }, { preserveState: true, preserveScroll: true, replace: true })} className="rounded-lg border-stone-300 py-1.5 text-sm">{[10,25,50,100].map(v => <option key={v}>{v}</option>)}</select></label>
                                <label className="flex items-center gap-2">Documents <select value={filters.document_per_page} onChange={(e) => router.get(route('portal.documents', currentFolder?.route_key), { search: filters.search || undefined, folder_per_page: filters.folder_per_page, document_per_page: Number(e.target.value), folder_page: folderPagination.current_page, document_page: 1 }, { preserveState: true, preserveScroll: true, replace: true })} className="rounded-lg border-stone-300 py-1.5 text-sm">{[10,25,50,100].map(v => <option key={v}>{v}</option>)}</select></label>
                                {folderPagination.last_page > 1 && <div className="flex gap-1">{folderPagination.links.map((link, i) => link.url ? <Link key={`f-${i}`} href={link.url} preserveScroll preserveState className={`rounded-lg px-2.5 py-1.5 ${link.active ? 'bg-arms-green text-white' : 'hover:bg-stone-100'}`} dangerouslySetInnerHTML={{ __html: link.label }} /> : null)}</div>}
                                {documentPagination.last_page > 1 && <div className="flex gap-1">{documentPagination.links.map((link, i) => link.url ? <Link key={`d-${i}`} href={link.url} preserveScroll preserveState className={`rounded-lg px-2.5 py-1.5 ${link.active ? 'bg-arms-green text-white' : 'hover:bg-stone-100'}`} dangerouslySetInnerHTML={{ __html: link.label }} /> : null)}</div>}
                            </div>
                        </footer>
                    )}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#012a21]/75 p-3 sm:p-4 backdrop-blur-sm">
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
