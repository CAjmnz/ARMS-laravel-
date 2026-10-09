import ArmsIcon from '@/Components/ArmsIcon';
import PinnedItemsDropdown from '@/Components/PinnedItemsDropdown';
import InformationDrawer from '@/Components/InformationDrawer';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    DragEvent,
    FormEvent,
    useEffect,
    useRef,
    useState,
    useMemo,
} from 'react';

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
    publish_url?: string | null;
    unpublish_url?: string | null;
    rename_url?: string | null;
    delete_url?: string | null;
    hierarchy_preview_url?: string | null;
    hierarchy_delete_url?: string | null;
    updated_at?: string | null;
    owner?: string | null;
    information_url?: string;
}

interface DocumentItem {
    id: number;
    route_key: string;
    name: string;
    type: string;
    modified_at?: string | null;
    owner: string;
    show_url: string;
    viewer_url?: string | null;
    download_url?: string | null;
    edit_url?: string | null;
    update_url?: string | null;
    move_url?: string | null;
    delete_url?: string | null;
    information_url?: string;
    is_pinned?: boolean;
    pin_url?: string;
}
interface HierarchyNode {
    id: number;
    name: string;
    folders: HierarchyNode[];
    documents: { id: number; name: string }[];
}
interface HierarchyPreview {
    folder: { id: number; name: string; depth: number };
    tree: HierarchyNode;
    counts: { folders: number; documents: number };
}
interface PinnedSearchItem {
    pin_id: number;
    kind: 'folder' | 'document';
    type: string;
    file_type?: string;
    id: number;
    route_key: string;
    name: string;
    path: string;
    updated_at?: string | null;
    href: string;
    opens_viewer?: boolean;
    information_url?: string;
    is_pinned: boolean;
}
interface PinnedSearchPage {
    data: PinnedSearchItem[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    total: number;
}

interface OrganizationLocation {
    id: number;
    name: string;
    department_id?: number | null;
}
interface OrganizationDepartment {
    id: number;
    name: string;
    subsidiary_id: number;
    subdivision_id?: number | null;
    locations: OrganizationLocation[];
}
interface OrganizationSubdivision {
    id: number;
    name: string;
    departments: OrganizationDepartment[];
}
interface OrganizationDivision {
    id: number;
    name: string;
    subdivisions: OrganizationSubdivision[];
}
interface Organization {
    id: number;
    name: string;
    organization_divisions: OrganizationDivision[];
}

interface Props {
    currentFolder: Folder | null;
    documentStats: {
        documents: number;
        folders: number;
        pins: number;
        users: number;
        departments: number;
    };
    breadcrumbs: { id: number; route_key: string; name: string }[];
    folders: {
        data: Folder[];
        current_page: number;
        last_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    documents: {
        data: DocumentItem[];
        current_page: number;
        last_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
        total: number;
    };
    filters: {
        search: string;
        sort?: string;
        order?: 'asc' | 'desc';
        per_page?: number;
        document_page?: number;
    };
    pinnedSearch: PinnedSearchPage | null;
    pinnedSearchMode: boolean;
    pinnedSearchKeyword: string | null;
    canCreateRoot: boolean;
    organizations: Organization[];
    uploadFolders: {
        id: number;
        route_key: string;
        name: string;
        path: string;
        depth: number;
        group_label: string;
    }[];
}

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          }).format(new Date(value))
        : '—';

function PinMarker({ pinned }: { pinned?: boolean }) {
    if (!pinned) return null;
    return (
        <span
            title="Pinned"
            className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm"
        >
            <ArmsIcon
                name="pin"
                className="h-3 w-3 fill-current text-red-500"
            />
        </span>
    );
}

const DROPDOWN_OPEN_EVENT = 'arms:dropdown-open';

const notifyDropdownOpen = (id: string) => {
    window.dispatchEvent(new CustomEvent(DROPDOWN_OPEN_EVENT, { detail: id }));
};

function useExclusiveDropdown(id: string, setOpen: (open: boolean) => void) {
    useEffect(() => {
        const handleDropdownOpen = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== id) {
                setOpen(false);
            }
        };

        window.addEventListener(DROPDOWN_OPEN_EVENT, handleDropdownOpen);
        return () =>
            window.removeEventListener(DROPDOWN_OPEN_EVENT, handleDropdownOpen);
    }, [id, setOpen]);
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
    const [bulkFolderMode, setBulkFolderMode] = useState(false);
    const [bulkFolderNames, setBulkFolderNames] = useState('');
    const [newOpen, setNewOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [folderUploadOpen, setFolderUploadOpen] = useState(false);
    const [inlineUploadOpen, setInlineUploadOpen] = useState(false);
    const [inlineDragActive, setInlineDragActive] = useState(false);
    const [uploadFolderId, setUploadFolderId] = useState('');
    const [uploadBatchProgress, setUploadBatchProgress] = useState(0);
    const [view, setView] = useState<'list' | 'grid'>('grid');
    const [viewingDocument, setViewingDocument] = useState<DocumentItem | null>(
        null,
    );
    const [viewingSelectedDocuments, setViewingSelectedDocuments] =
        useState<DocumentItem[] | null>(null);
    const autoOpenedDocument = useRef<string | null>(null);
    const [informationTarget, setInformationTarget] = useState<{
        name: string;
        url: string;
        kind: 'folder' | 'document';
    } | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [bulkOpen, setBulkOpen] = useState(false);
    const [currentFolderActionsOpen, setCurrentFolderActionsOpen] =
        useState(false);
    const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkDeletedCount, setBulkDeletedCount] = useState(0);
    const [bulkDestinationId, setBulkDestinationId] = useState('');
    const [bulkDownloadProcessing, setBulkDownloadProcessing] = useState(false);
    const [bulkDownloadError, setBulkDownloadError] = useState('');

    useExclusiveDropdown('manage-new', setNewOpen);
    useExclusiveDropdown('manage-bulk', setBulkOpen);
    useExclusiveDropdown(
        'manage-current-folder-actions',
        setCurrentFolderActionsOpen,
    );
    const form = useForm({
        name: '',
        subsidiary_id: '',
        division_id: '',
        subdivision_id: '',
        department_id: '',
        location_id: '',
    });
    const uploadForm = useForm({
        original_files: [] as File[],
        viewer_files: [] as File[],
    });
    const inlineUploadForm = useForm({
        original_files: [] as File[],
        viewer_files: [] as File[],
    });
    const itemCount = folders.data.length + documents.data.length;
    const bulkFolderPreview = useMemo(
        () =>
            bulkFolderNames
                .split(/\r?\n/)
                .map((name) => name.trim())
                .filter(Boolean),
        [bulkFolderNames],
    );
    const visibleKeys = useMemo(
        () => [
            ...folders.data.map((item) => `folder:${item.id}`),
            ...documents.data.map((item) => `document:${item.id}`),
        ],
        [folders.data, documents.data],
    );
    const selectedFolderIds = useMemo(
        () =>
            Array.from(selectedItems)
                .filter((key) => key.startsWith('folder:'))
                .map((key) => Number(key.split(':')[1])),
        [selectedItems],
    );
    const selectedDocumentIds = useMemo(
        () =>
            Array.from(selectedItems)
                .filter((key) => key.startsWith('document:'))
                .map((key) => Number(key.split(':')[1])),
        [selectedItems],
    );
    const allVisibleSelected =
        visibleKeys.length > 0 &&
        visibleKeys.every((key) => selectedItems.has(key));
    const isRoot = !currentFolder;
    const canChooseUploadDestination = isRoot;
    const uploadFolderGroups = useMemo(() => {
        return uploadFolders.reduce<Record<string, Props['uploadFolders']>>(
            (groups, folder) => {
                (groups[folder.group_label] ??= []).push(folder);
                return groups;
            },
            {},
        );
    }, [uploadFolders]);
    const selectedOrganization = useMemo(
        () =>
            organizations.find(
                (item) => String(item.id) === form.data.subsidiary_id,
            ),
        [form.data.subsidiary_id, organizations],
    );
    const divisions = selectedOrganization?.organization_divisions ?? [];
    const selectedDivision = divisions.find(
        (item) => String(item.id) === form.data.division_id,
    );
    const subdivisions = selectedDivision?.subdivisions ?? [];
    const selectedSubdivision = subdivisions.find(
        (item) => String(item.id) === form.data.subdivision_id,
    );
    const departments = selectedSubdivision?.departments ?? [];
    const selectedDepartment = departments.find(
        (item) => String(item.id) === form.data.department_id,
    );
    const locations = selectedDepartment?.locations ?? [];

    useEffect(() => {
        setSelectedItems(new Set());
    }, [
        currentFolder?.id,
        filters.search,
        filters.sort,
        filters.order,
        filters.per_page,
        folders.current_page,
        documents.current_page,
    ]);

    useEffect(() => {
        const routeKey = new URLSearchParams(window.location.search).get(
            'open_document',
        );
        if (!routeKey || autoOpenedDocument.current === routeKey) return;
        const document = documents.data.find(
            (item) => item.route_key === routeKey,
        );
        if (!document) return;
        autoOpenedDocument.current = routeKey;
        setViewingDocument(document);
    }, [documents.data]);

    const closeDocumentViewer = () => {
        setViewingDocument(null);
        setViewingSelectedDocuments(null);
        const url = new URL(window.location.href);
        if (url.searchParams.has('open_document')) {
            url.searchParams.delete('open_document');
            window.history.replaceState(
                window.history.state,
                '',
                url.pathname + url.search + url.hash,
            );
        }
    };

    const openCreate = () => {
        form.clearErrors();
        form.reset();
        setBulkFolderMode(false);
        setBulkFolderNames('');
        setCreating(true);
    };

    const addUploadFiles = (
        kind: 'original_files' | 'viewer_files',
        files: File[],
    ) => {
        const current = uploadForm.data[kind];
        const combined = [...current, ...files].slice(0, 100);
        uploadForm.setData(kind, combined);
    };

    const handleUploadDrop = (
        event: DragEvent<HTMLLabelElement>,
        kind: 'original_files' | 'viewer_files',
    ) => {
        event.preventDefault();
        addUploadFiles(kind, Array.from(event.dataTransfer.files));
    };

    const normalizedUploadName = (name: string) => {
        const lastDot = name.lastIndexOf('.');
        const base = lastDot > 0 ? name.slice(0, lastDot) : name;
        const extension = lastDot > 0 ? name.slice(lastDot) : '';
        return base.trim().replace(/\s+/g, '_') + extension.toLowerCase();
    };

    const submitUpload = async (event: FormEvent) => {
        event.preventDefault();
        const destinationKey = canChooseUploadDestination
            ? uploadFolders.find(
                  (folder) => String(folder.id) === uploadFolderId,
              )?.route_key
            : currentFolder?.route_key;
        if (!destinationKey || !uploadForm.data.original_files.length) return;

        uploadForm.clearErrors();

        // PHP is currently configured with max_file_uploads=20. Because an
        // upload can contain both an original and its optional viewer file,
        // keep each request at or below that server limit instead of silently
        // losing files when 55+ documents are selected at once.
        const originalFiles = uploadForm.data.original_files;
        const viewerFiles = uploadForm.data.viewer_files;
        const hasViewerFiles = viewerFiles.length > 0;
        const filesPerBatch = hasViewerFiles ? 10 : 20;
        const totalBatches = Math.ceil(originalFiles.length / filesPerBatch);

        setUploadBatchProgress(0);

        try {
            for (
                let batchIndex = 0;
                batchIndex < totalBatches;
                batchIndex += 1
            ) {
                setUploadBatchProgress(batchIndex + 1);
                const start = batchIndex * filesPerBatch;
                const originals = originalFiles.slice(
                    start,
                    start + filesPerBatch,
                );
                const viewers = hasViewerFiles
                    ? viewerFiles.slice(start, start + filesPerBatch)
                    : [];

                await new Promise<void>((resolve, reject) => {
                    uploadForm.transform(() => ({
                        original_files: originals,
                        viewer_files: viewers,
                    }));

                    uploadForm.post(route('documents.upload', destinationKey), {
                        preserveScroll: true,
                        forceFormData: true,
                        onSuccess: () => resolve(),
                        onError: (errors) => reject(errors),
                    });
                });
            }

            uploadForm.reset();
            setUploadFolderId('');
            setUploadBatchProgress(0);
            setUploadOpen(false);
        } catch {
            setUploadBatchProgress(0);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!isRoot && bulkFolderMode) {
            const names = bulkFolderNames
                .split(/\r?\n/)
                .map((name) => name.trim())
                .filter(Boolean);

            if (!names.length) {
                form.setError('name', 'Enter at least one folder name.');
                return;
            }

            if (names.length > 100) {
                form.setError(
                    'name',
                    'You can add a maximum of 100 folders at a time.',
                );
                return;
            }

            form.clearErrors();
            form.transform(() => ({ names }));
            form.post(
                route('documents.folders.bulk-store', currentFolder.route_key),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        form.reset();
                        setBulkFolderNames('');
                        setBulkFolderMode(false);
                        setCreating(false);
                    },
                },
            );
            return;
        }

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
            visibleKeys.forEach((key) =>
                checked ? next.add(key) : next.delete(key),
            );
            return next;
        });
    };

    const bulkDownload = async () => {
        if (bulkDownloadProcessing || !selectedDocumentIds.length) return;

        setBulkOpen(false);
        setBulkDownloadProcessing(true);
        setBulkDownloadError('');

        try {
            const response = await axios.post(
                route('documents.bulk-download'),
                { document_ids: selectedDocumentIds },
                { responseType: 'blob' },
            );
            const disposition = String(
                response.headers['content-disposition'] ?? '',
            );
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] ?? 'RMS-selected-documents.zip';
            const url = window.URL.createObjectURL(response.data);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = filename;
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setSelectedItems(new Set());
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.data instanceof Blob
            ) {
                try {
                    const payload = JSON.parse(
                        await error.response.data.text(),
                    );
                    const firstValidationError = payload.errors
                        ? Object.values(payload.errors).flat()[0]
                        : null;
                    setBulkDownloadError(
                        String(
                            firstValidationError ??
                                payload.message ??
                                'The selected documents could not be downloaded.',
                        ),
                    );
                } catch {
                    setBulkDownloadError(
                        'The selected documents could not be downloaded. Please try again.',
                    );
                }
            } else {
                setBulkDownloadError(
                    'The selected documents could not be downloaded. Please try again.',
                );
            }
        } finally {
            setBulkDownloadProcessing(false);
        }
    };

    const submitBulkTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!selectedDocumentIds.length || !bulkDestinationId) return;
        router.patch(
            route('documents.bulk-move'),
            { document_ids: selectedDocumentIds, folder_id: bulkDestinationId },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedItems(new Set());
                    setBulkDestinationId('');
                    setBulkTransferOpen(false);
                },
            },
        );
    };

    const bulkPublish = () => {
        if (!selectedFolderIds.length || selectedDocumentIds.length) return;
        setBulkOpen(false);
        router.patch(
            route('documents.bulk-publish'),
            { folder_ids: selectedFolderIds },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedItems(new Set()),
            },
        );
    };

    const bulkUnpublish = () => {
        if (!selectedFolderIds.length || selectedDocumentIds.length) return;
        setBulkOpen(false);
        router.patch(
            route('documents.bulk-unpublish'),
            { folder_ids: selectedFolderIds },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedItems(new Set()),
            },
        );
    };

    const bulkDelete = () => {
        if (!selectedItems.size) return;
        setBulkOpen(false);
        setBulkDeleteOpen(true);
    };

    const confirmBulkDelete = async () => {
        if (bulkDeleting || !selectedItems.size) return;

        const batchSize = 100;
        const batches = [
            ...Array.from(
                { length: Math.ceil(selectedDocumentIds.length / batchSize) },
                (_, index) => ({
                    folder_ids: [],
                    document_ids: selectedDocumentIds.slice(
                        index * batchSize,
                        (index + 1) * batchSize,
                    ),
                }),
            ),
            ...Array.from(
                { length: Math.ceil(selectedFolderIds.length / batchSize) },
                (_, index) => ({
                    folder_ids: selectedFolderIds.slice(
                        index * batchSize,
                        (index + 1) * batchSize,
                    ),
                    document_ids: [],
                }),
            ),
        ].filter(
            (batch) => batch.folder_ids.length || batch.document_ids.length,
        );

        setBulkDeleting(true);
        setBulkDeletedCount(0);
        try {
            for (const batch of batches) {
                await new Promise<void>((resolve, reject) => {
                    router.delete(route('documents.bulk-delete'), {
                        data: batch,
                        preserveScroll: true,
                        onSuccess: () => resolve(),
                        onError: () =>
                            reject(new Error('Bulk deletion failed.')),
                    });
                });
                setBulkDeletedCount(
                    (count) =>
                        count +
                        batch.folder_ids.length +
                        batch.document_ids.length,
                );
            }
            setSelectedItems(new Set());
            setBulkDeleteOpen(false);
        } finally {
            setBulkDeleting(false);
        }
    };

    const updateTable = (changes: Record<string, string | number>) => {
        router.get(
            route('documents.manage', currentFolder?.route_key),
            { ...filters, page: 1, document_page: 1, ...changes },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            kicker="DOCUMENTS DIRECTORY"
            title="Documents"
            description="Open a filename to browse its subfolders one level at a time."
            showClock={false}
            header={
                <div className="flex min-w-0 items-center justify-end gap-3">
                    <DocumentSummaryCard
                        icon="document"
                        value={documentStats.documents}
                        label="Total documents"
                    />
                    <PinnedItemsDropdown
                        count={documentStats.pins}
                        onInformation={setInformationTarget}
                    />
                </div>
            }
        >
            <Head title="Documents" />

            <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
                <nav
                    aria-label="Document path"
                    className="mt-6 flex flex-wrap items-center gap-1 text-sm"
                >
                    <Link
                        href={route('documents.manage')}
                        className="rounded-lg px-2 py-1 font-semibold text-arms-green transition hover:bg-emerald-50"
                    >
                        Documents
                    </Link>
                    {breadcrumbs.map((item) => (
                        <span key={item.id} className="flex items-center gap-1">
                            <span aria-hidden="true" className="text-stone-400">
                                ›
                            </span>
                            <Link
                                href={route('documents.manage', item.route_key)}
                                className="rounded-lg px-2 py-1 font-medium text-stone-700 transition hover:bg-stone-100"
                            >
                                {item.name}
                            </Link>
                        </span>
                    ))}
                </nav>

                <main className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-6">
                        <div>
                            <h2 className="text-xl font-semibold text-[#073d2f] sm:text-2xl">
                                {pinnedSearchMode
                                    ? 'Pinned Search Results'
                                    : (currentFolder?.name ?? 'Documents')}
                            </h2>
                            <p className="mt-1 text-sm text-stone-500">
                                {pinnedSearchMode
                                    ? 'Pinned items from all accessible locations'
                                    : 'Folders and documents in this location'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {!pinnedSearchMode && currentFolder && (
                                <FolderActions
                                    folder={currentFolder}
                                    onInformation={setInformationTarget}
                                    open={currentFolderActionsOpen}
                                    onOpenChange={(open) => {
                                        if (open) {
                                            notifyDropdownOpen(
                                                'manage-current-folder-actions',
                                            );
                                        }
                                        setCurrentFolderActionsOpen(open);
                                    }}
                                    variant="header"
                                />
                            )}
                            <span className="text-sm text-stone-500">
                                {pinnedSearchMode
                                    ? (pinnedSearch?.total ?? 0)
                                    : itemCount}{' '}
                                {(pinnedSearchMode
                                    ? (pinnedSearch?.total ?? 0)
                                    : itemCount) === 1
                                    ? 'item'
                                    : 'items'}
                            </span>
                            {!pinnedSearchMode && (
                                <div
                                    className="flex overflow-hidden rounded-lg border border-stone-200 p-0.5"
                                    aria-label="Choose view"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setView('list')}
                                        aria-label="List view"
                                        aria-pressed={view === 'list'}
                                        className={
                                            'grid h-8 w-9 place-items-center rounded-md text-sm font-bold transition ' +
                                            (view === 'list'
                                                ? 'bg-arms-green text-white'
                                                : 'text-stone-500 hover:bg-stone-100')
                                        }
                                    >
                                        ☰
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setView('grid')}
                                        aria-label="Grid view"
                                        aria-pressed={view === 'grid'}
                                        className={
                                            'grid h-8 w-9 place-items-center rounded-md text-lg transition ' +
                                            (view === 'grid'
                                                ? 'bg-arms-green text-white'
                                                : 'text-stone-500 hover:bg-stone-100')
                                        }
                                    >
                                        ⊞
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
                        {pinnedSearchMode ? (
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-arms-green">
                                    <ArmsIcon name="pin" className="h-4 w-4" />{' '}
                                    Pinned items from all locations
                                </span>
                                {pinnedSearchKeyword && (
                                    <span className="text-stone-500">
                                        matching “{pinnedSearchKeyword}”
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.get(
                                            route(
                                                'documents.manage',
                                                currentFolder?.route_key,
                                            ),
                                            {
                                                sort: filters.sort,
                                                order: filters.order,
                                                per_page: filters.per_page,
                                            },
                                            {
                                                preserveScroll: true,
                                                replace: true,
                                            },
                                        )
                                    }
                                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-600 hover:bg-stone-50"
                                >
                                    Clear search
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                {(isRoot
                                    ? canCreateRoot
                                    : currentFolder?.can_manage ||
                                      currentFolder?.can_upload) && (
                                    <div className="relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextOpen = !newOpen;
                                                if (nextOpen) {
                                                    notifyDropdownOpen(
                                                        'manage-new',
                                                    );
                                                }
                                                setNewOpen(nextOpen);
                                            }}
                                            aria-expanded={newOpen}
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-arms-green px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#033b2d]"
                                        >
                                            <span className="text-lg leading-none">
                                                +
                                            </span>{' '}
                                            New{' '}
                                            <span className="text-xs">▾</span>
                                        </button>
                                        {newOpen && (
                                            <div className="absolute left-0 top-12 z-30 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
                                                {isRoot && canCreateRoot && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewOpen(false);
                                                            openCreate();
                                                        }}
                                                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50"
                                                    >
                                                        ▣ Add new filename
                                                    </button>
                                                )}
                                                {!isRoot &&
                                                    currentFolder?.can_manage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNewOpen(
                                                                    false,
                                                                );
                                                                openCreate();
                                                            }}
                                                            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50"
                                                        >
                                                            ▣ New folder
                                                        </button>
                                                    )}
                                                {(currentFolder?.can_upload ||
                                                    (isRoot &&
                                                        canCreateRoot)) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewOpen(false);
                                                            setUploadOpen(true);
                                                        }}
                                                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50"
                                                    >
                                                        ⇧ Add new documents
                                                    </button>
                                                )}
                                                {(isRoot
                                                    ? canCreateRoot
                                                    : !!currentFolder?.can_upload &&
                                                      currentFolder.depth ===
                                                          0) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewOpen(false);
                                                            setFolderUploadOpen(
                                                                true,
                                                            );
                                                        }}
                                                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-emerald-50"
                                                    >
                                                        ▣ Upload folder
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextOpen = !bulkOpen;
                                            if (nextOpen) {
                                                notifyDropdownOpen(
                                                    'manage-bulk',
                                                );
                                            }
                                            setBulkOpen(nextOpen);
                                        }}
                                        disabled={!selectedItems.size}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        Bulk actions{' '}
                                        <span className="text-xs">⌄</span>
                                    </button>
                                    {bulkOpen && (
                                        <div className="absolute left-0 top-12 z-40 w-60 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl">
                                            <button
                                                type="button"
                                                disabled={!selectedDocumentIds.length}
                                                onClick={() => {
                                                    const selectedDocuments = selectedDocumentIds
                                                        .map((id) => documents.data.find((item) => item.id === id))
                                                        .filter((item): item is DocumentItem => Boolean(item));
                                                    if (!selectedDocuments.length) return;
                                                    setViewingSelectedDocuments(selectedDocuments);
                                                    setViewingDocument(selectedDocuments[0]);
                                                    setBulkOpen(false);
                                                }}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-stone-300"
                                            >
                                                ▣ View selected documents
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    !selectedDocumentIds.length ||
                                                    bulkDownloadProcessing
                                                }
                                                onClick={bulkDownload}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                                            >
                                                {bulkDownloadProcessing
                                                    ? 'Creating ZIP…'
                                                    : '⇩ Download selected files'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    !selectedDocumentIds.length
                                                }
                                                onClick={() => {
                                                    setBulkOpen(false);
                                                    setBulkTransferOpen(true);
                                                }}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                                            >
                                                ⇄ Transfer selected files
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    !selectedFolderIds.length ||
                                                    selectedDocumentIds.length >
                                                        0
                                                }
                                                onClick={bulkPublish}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-stone-300"
                                            >
                                                ✓ Publish selected folders
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    !selectedFolderIds.length ||
                                                    selectedDocumentIds.length >
                                                        0
                                                }
                                                onClick={bulkUnpublish}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-stone-300"
                                            >
                                                ↺ Unpublish selected folders
                                            </button>
                                            <button
                                                type="button"
                                                onClick={bulkDelete}
                                                className="mt-1 block w-full rounded-lg border-t border-stone-100 px-3 py-2.5 text-left text-red-700 hover:bg-red-50"
                                            >
                                                ♜ Delete selected items
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <span className="text-sm text-stone-500">
                                    {selectedItems.size
                                        ? `${selectedItems.size} item(s) selected`
                                        : 'No records selected'}
                                </span>
                                {bulkDownloadProcessing && (
                                    <span className="text-sm font-semibold text-arms-green">
                                        Creating ZIP…
                                    </span>
                                )}
                            </div>
                        )}

                        {bulkDownloadError && (
                            <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {bulkDownloadError}
                            </div>
                        )}

                        <label className="relative block w-full min-w-0 sm:ml-auto sm:w-80 lg:w-96">
                            <ArmsIcon
                                name="folder"
                                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
                            />
                            <input
                                defaultValue={filters.search}
                                onChange={(event) =>
                                    updateTable({
                                        search: event.target.value,
                                    })
                                }
                                placeholder="Search in Document Management"
                                aria-label="Search in Document Management"
                                className="h-11 w-full rounded-xl border-stone-200 bg-stone-50 py-2 pl-12 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-arms-green focus:bg-white focus:ring-arms-green"
                            />
                        </label>

                        <label className="flex items-center gap-2 text-sm text-stone-600">
                            Show
                            <select
                                value={filters.per_page ?? 10}
                                onChange={(event) =>
                                    updateTable({
                                        per_page: Number(event.target.value),
                                    })
                                }
                                className="h-10 rounded-xl border-stone-300 bg-white py-1 pl-3 pr-8 text-sm"
                            >
                                {[10, 25, 50, 100, 200].map((value) => (
                                    <option key={value} value={value}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                            entries
                        </label>
                    </div>

                    {pinnedSearchMode ? (
                        <PinnedSearchResults
                            page={pinnedSearch}
                            onInformation={setInformationTarget}
                        />
                    ) : itemCount === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-arms-green">
                                <ArmsIcon name="folder" className="h-8 w-8" />
                            </span>
                            <h3 className="mt-5 text-xl font-semibold text-[#073d2f]">
                                No folders found
                            </h3>
                            <p className="mt-2 text-sm text-stone-500">
                                Create a folder here, or adjust your search.
                            </p>
                        </div>
                    ) : view === 'list' ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-stone-100 text-left">
                                <thead className="bg-stone-50/80">
                                    <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                                        <th className="w-12 px-5 py-3.5 sm:px-6">
                                            <input
                                                id="documents-all"
                                                type="checkbox"
                                                checked={allVisibleSelected}
                                                onChange={(event) =>
                                                    toggleAllVisible(
                                                        event.target.checked,
                                                    )
                                                }
                                                aria-label="Select all visible items"
                                                className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                                            />
                                        </th>
                                        <th className="px-5 py-3.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateTable({
                                                        sort: 'name',
                                                        order:
                                                            filters.sort ===
                                                                'name' &&
                                                            filters.order ===
                                                                'asc'
                                                                ? 'desc'
                                                                : 'asc',
                                                    })
                                                }
                                                className="font-semibold uppercase tracking-wide hover:text-arms-green"
                                            >
                                                Name ↕
                                            </button>
                                        </th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="hidden px-5 py-3.5 md:table-cell">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateTable({
                                                        sort: 'created_at',
                                                        order:
                                                            filters.sort ===
                                                                'created_at' &&
                                                            filters.order ===
                                                                'asc'
                                                                ? 'desc'
                                                                : 'asc',
                                                    })
                                                }
                                                className="font-semibold uppercase tracking-wide hover:text-arms-green"
                                            >
                                                Modified date ↕
                                            </button>
                                        </th>
                                        <th className="hidden px-5 py-3.5 lg:table-cell">
                                            Owner / Uploaded by
                                        </th>
                                        <th className="w-14 px-4 py-3.5">
                                            <span className="sr-only">
                                                More actions
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {folders.data.map((folder) => (
                                        <FolderRow
                                            key={'folder-' + folder.id}
                                            folder={folder}
                                            onInformation={setInformationTarget}
                                            selected={selectedItems.has(
                                                `folder:${folder.id}`,
                                            )}
                                            onSelected={(checked) =>
                                                toggleSelection(
                                                    `folder:${folder.id}`,
                                                    checked,
                                                )
                                            }
                                        />
                                    ))}
                                    {documents.data.map((document) => (
                                        <DocumentRow
                                            key={'document-' + document.id}
                                            document={document}
                                            destinations={uploadFolders}
                                            onOpen={setViewingDocument}
                                            onInformation={setInformationTarget}
                                            selected={selectedItems.has(
                                                `document:${document.id}`,
                                            )}
                                            onSelected={(checked) =>
                                                toggleSelection(
                                                    `document:${document.id}`,
                                                    checked,
                                                )
                                            }
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-7 p-5 sm:p-6">
                            {folders.data.length > 0 && (
                                <section>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-stone-700">
                                            Folders
                                        </h3>
                                        <span className="text-xs text-stone-400">
                                            {folders.data.length}
                                        </span>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        {folders.data.map((folder) => (
                                            <FolderCard
                                                key={'folder-' + folder.id}
                                                folder={folder}
                                                onInformation={
                                                    setInformationTarget
                                                }
                                                selected={selectedItems.has(
                                                    `folder:${folder.id}`,
                                                )}
                                                onSelected={(checked) =>
                                                    toggleSelection(
                                                        `folder:${folder.id}`,
                                                        checked,
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {documents.data.length > 0 && (
                                <section>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-stone-700">
                                            Files
                                        </h3>
                                        <span className="text-xs text-stone-400">
                                            {documents.total}
                                        </span>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                                        {documents.data.map((document) => (
                                            <DocumentCard
                                                key={'document-' + document.id}
                                                document={document}
                                                destinations={uploadFolders}
                                                onOpen={setViewingDocument}
                                                onInformation={
                                                    setInformationTarget
                                                }
                                                selected={selectedItems.has(
                                                    `document:${document.id}`,
                                                )}
                                                onSelected={(checked) =>
                                                    toggleSelection(
                                                        `document:${document.id}`,
                                                        checked,
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {!pinnedSearchMode &&
                        (folders.last_page > 1 || documents.last_page > 1) && (
                            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 text-sm sm:px-6">
                                <div className="flex flex-wrap gap-3 text-stone-500">
                                    {folders.last_page > 1 && (
                                        <span>
                                            Folders: page {folders.current_page}{' '}
                                            of {folders.last_page}
                                        </span>
                                    )}
                                    {documents.last_page > 1 && (
                                        <span>
                                            Files: page {documents.current_page}{' '}
                                            of {documents.last_page}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {folders.last_page > 1 && (
                                        <PageButton
                                            url={folders.prev_page_url}
                                            label="Previous folders"
                                        />
                                    )}
                                    {folders.last_page > 1 && (
                                        <PageButton
                                            url={folders.next_page_url}
                                            label="Next folders"
                                        />
                                    )}
                                    {documents.last_page > 1 && (
                                        <PageButton
                                            url={documents.prev_page_url}
                                            label="Previous files"
                                        />
                                    )}
                                    {documents.last_page > 1 && (
                                        <PageButton
                                            url={documents.next_page_url}
                                            label="Next files"
                                        />
                                    )}
                                </div>
                            </footer>
                        )}
                </main>
            </section>

            {bulkDeleteOpen && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-[#012a21]/45 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">
                            !
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-[#073d2f]">
                            Delete selected items?
                        </h2>
                        <p className="mt-2 text-sm text-stone-500">
                            You are about to delete {selectedItems.size}{' '}
                            selected item(s). This action cannot be undone.
                        </p>
                        {bulkDeleting && (
                            <p className="mt-3 text-sm font-medium text-red-700">
                                Deleting {bulkDeletedCount} of{' '}
                                {selectedItems.size} items…
                            </p>
                        )}
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                disabled={bulkDeleting}
                                onClick={() => setBulkDeleteOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={bulkDeleting}
                                onClick={confirmBulkDelete}
                                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {bulkDeleting ? 'Deleting…' : 'Yes, delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {bulkTransferOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={submitBulkTransfer}
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h2 className="text-lg font-semibold text-[#073d2f]">
                            Transfer selected files
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                            Move {selectedDocumentIds.length} selected
                            document(s) to another authorized destination.
                        </p>
                        <select
                            value={bulkDestinationId}
                            onChange={(event) =>
                                setBulkDestinationId(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        >
                            <option value="">Select destination path</option>
                            {uploadFolders.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.path}
                                </option>
                            ))}
                        </select>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setBulkTransferOpen(false);
                                    setBulkDestinationId('');
                                }}
                                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={
                                    !bulkDestinationId ||
                                    !selectedDocumentIds.length
                                }
                                className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Transfer files
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {folderUploadOpen && (
                <FolderUploadModal
                    currentFolder={currentFolder}
                    breadcrumbs={breadcrumbs}
                    onClose={() => setFolderUploadOpen(false)}
                />
            )}

            {uploadOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={submitUpload}
                        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h2 className="text-lg font-semibold text-[#073d2f]">
                            Upload New Documents
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                            Upload original files and optional watermarked
                            viewer files to the selected folder.
                        </p>
                        {canChooseUploadDestination ? (
                            <label className="mt-5 block text-sm font-medium text-stone-700">
                                Destination Path
                                <select
                                    value={uploadFolderId}
                                    onChange={(event) =>
                                        setUploadFolderId(event.target.value)
                                    }
                                    className="mt-2 h-11 w-full rounded-xl border-stone-300 bg-white px-3 text-sm text-stone-800 shadow-sm focus:border-[#0b8a64] focus:ring-[#0b8a64]"
                                >
                                    <option value="">
                                        Select a destination path
                                    </option>
                                    {Object.entries(uploadFolderGroups).map(
                                        ([group, items]) => (
                                            <optgroup key={group} label={group}>
                                                {items.map((folder) => (
                                                    <option
                                                        key={folder.id}
                                                        value={folder.id}
                                                    >
                                                        {folder.path}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ),
                                    )}
                                </select>
                                <span className="mt-1 block text-xs font-normal text-stone-500">
                                    Choose a Filename or any available Subfolder
                                    path.
                                </span>
                            </label>
                        ) : (
                            <div className="mt-5">
                                <span className="mb-2 block text-sm font-medium text-stone-700">
                                    Destination Path
                                </span>
                                <div className="flex min-h-11 items-center rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#073d2f] shadow-sm ring-1 ring-emerald-100">
                                    /
                                    {breadcrumbs
                                        .map((item) => item.name)
                                        .join('/')}
                                </div>
                                <span className="mt-1 block text-xs text-stone-500">
                                    Current location selected automatically. No
                                    destination selection is required.
                                </span>
                            </div>
                        )}
                        <div className="mt-5 grid grid-cols-2 gap-4">
                            <label
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) =>
                                    handleUploadDrop(event, 'original_files')
                                }
                                className="cursor-pointer rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-sm font-medium text-arms-green transition hover:border-arms-green hover:bg-emerald-50"
                            >
                                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-sm">
                                    ⇧
                                </span>
                                <span className="mt-3 block font-semibold">
                                    Drag and drop original files here
                                </span>
                                <span className="mt-1 block text-xs font-normal text-stone-500">
                                    or click to browse · up to 100 files
                                </span>
                                <input
                                    type="file"
                                    multiple
                                    className="sr-only"
                                    onChange={(event) => {
                                        addUploadFiles(
                                            'original_files',
                                            Array.from(
                                                event.target.files ?? [],
                                            ),
                                        );
                                        event.currentTarget.value = '';
                                    }}
                                />
                                {uploadForm.data.original_files.length > 0 && (
                                    <span className="mt-3 block text-xs font-semibold">
                                        {uploadForm.data.original_files.length}{' '}
                                        file(s) selected
                                    </span>
                                )}
                            </label>
                            <label
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) =>
                                    handleUploadDrop(event, 'viewer_files')
                                }
                                className="cursor-pointer rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-5 text-center text-sm font-medium text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                            >
                                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-sm">
                                    ⇧
                                </span>
                                <span className="mt-3 block font-semibold">
                                    Drag and drop watermark files here
                                </span>
                                <span className="mt-1 block text-xs font-normal text-stone-500">
                                    Optional · same order as originals · up to
                                    100 files
                                </span>
                                <input
                                    type="file"
                                    multiple
                                    className="sr-only"
                                    onChange={(event) => {
                                        addUploadFiles(
                                            'viewer_files',
                                            Array.from(
                                                event.target.files ?? [],
                                            ),
                                        );
                                        event.currentTarget.value = '';
                                    }}
                                />
                                {uploadForm.data.viewer_files.length > 0 && (
                                    <span className="mt-3 block text-xs font-semibold">
                                        {uploadForm.data.viewer_files.length}{' '}
                                        file(s) selected
                                    </span>
                                )}
                            </label>
                        </div>
                        {uploadForm.data.original_files.length > 0 && (
                            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                                    Files to upload
                                </p>
                                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-stone-700">
                                    {uploadForm.data.original_files.map(
                                        (file, index) => (
                                            <div
                                                key={index + '-' + file.name}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <span className="truncate">
                                                    {file.name}
                                                </span>
                                                <span className="shrink-0 font-medium text-arms-green">
                                                    {normalizedUploadName(
                                                        file.name,
                                                    )}
                                                </span>
                                            </div>
                                        ),
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-stone-500">
                                    Spaces will be converted to underscores.
                                    Windows-invalid filename characters (&lt;
                                    &gt; : &quot; / \\ | ? *) are rejected.
                                </p>
                            </div>
                        )}
                        {uploadForm.errors.original_files && (
                            <p className="mt-3 text-sm text-red-700">
                                {uploadForm.errors.original_files}
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setUploadOpen(false)}
                                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={
                                    uploadForm.processing ||
                                    uploadBatchProgress > 0 ||
                                    !uploadForm.data.original_files.length ||
                                    (canChooseUploadDestination &&
                                        !uploadFolderId)
                                }
                                className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {uploadBatchProgress > 0
                                    ? 'Uploading batch ' +
                                      uploadBatchProgress +
                                      ' of ' +
                                      Math.ceil(
                                          uploadForm.data.original_files
                                              .length /
                                              (uploadForm.data.viewer_files
                                                  .length > 0
                                                  ? 10
                                                  : 20),
                                      ) +
                                      '…'
                                    : 'Upload documents'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {uploadBatchProgress > 0 && (
                <div className="fixed bottom-6 right-6 z-[120] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl ring-1 ring-emerald-100">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-arms-green">
                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-arms-green" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-stone-800">
                                Uploading documents…
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                                Batch {uploadBatchProgress} of{' '}
                                {Math.ceil(
                                    uploadForm.data.original_files.length /
                                        (uploadForm.data.viewer_files.length > 0
                                            ? 10
                                            : 20),
                                )}{' '}
                                is being uploaded. Please wait.
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                                <div
                                    className="h-full rounded-full bg-arms-green transition-all duration-300"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            (uploadBatchProgress /
                                                Math.ceil(
                                                    uploadForm.data
                                                        .original_files.length /
                                                        (uploadForm.data
                                                            .viewer_files
                                                            .length > 0
                                                            ? 10
                                                            : 20),
                                                )) *
                                                100,
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewingDocument && (
                <LegacyDocumentViewer
                    document={viewingDocument}
                    documents={viewingSelectedDocuments ?? documents.data}
                    destinations={uploadFolders}
                    folderPath={[
                        'Documents',
                        ...breadcrumbs.map((item) => item.name),
                    ].join(' › ')}
                    close={closeDocumentViewer}
                />
            )}
            <InformationDrawer
                target={informationTarget}
                onClose={() => setInformationTarget(null)}
            />

            {creating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#012a21]/55 p-4 backdrop-blur-md">
                    <form
                        onSubmit={submit}
                        className="w-full max-w-xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
                    >
                        <div className="bg-gradient-to-r from-[#064b38] to-[#0b7654] px-6 py-5 text-white">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                                Document Management
                            </p>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="mt-1 text-xl font-bold">
                                        {isRoot
                                            ? 'Add New Filename'
                                            : bulkFolderMode
                                              ? 'Bulk Add Subfolders'
                                              : 'Add New Subfolder'}
                                    </h2>
                                    <p className="mt-1 text-xs text-emerald-50">
                                        {isRoot
                                            ? 'Assign this filename to the corporate organization structure.'
                                            : bulkFolderMode
                                              ? 'Add multiple subfolders to ' +
                                                currentFolder?.name +
                                                ' at once.'
                                              : 'Create a subfolder inside the selected destination.'}
                                    </p>
                                </div>
                                {!isRoot && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            form.clearErrors();
                                            setBulkFolderMode((mode) => !mode);
                                            setBulkFolderNames('');
                                        }}
                                        className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                                    >
                                        {bulkFolderMode
                                            ? 'Single Add'
                                            : 'Bulk Add'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                            {isRoot && (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                                    <div className="mb-4">
                                        <p className="text-sm font-bold text-[#073d2f]">
                                            Corporate Location
                                        </p>
                                        <p className="mt-1 text-xs text-stone-500">
                                            Select: Subsidiary → Division →
                                            Sub-Division → Department → Location
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="block text-sm font-semibold text-stone-700">
                                            Subsidiary
                                            <select
                                                value={form.data.subsidiary_id}
                                                onChange={(event) => {
                                                    form.setData(
                                                        'subsidiary_id',
                                                        event.target.value,
                                                    );
                                                    form.setData(
                                                        'division_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'subdivision_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'department_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'location_id',
                                                        '',
                                                    );
                                                }}
                                                className="mt-1.5 w-full rounded-lg border-stone-300 bg-white text-sm"
                                            >
                                                <option value="">
                                                    Select subsidiary
                                                </option>
                                                {organizations.map((item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.subsidiary_id && (
                                                <span className="mt-1 block text-xs text-red-700">
                                                    {form.errors.subsidiary_id}
                                                </span>
                                            )}
                                        </label>

                                        <label className="block text-sm font-semibold text-stone-700">
                                            Division
                                            <select
                                                value={form.data.division_id}
                                                onChange={(event) => {
                                                    form.setData(
                                                        'division_id',
                                                        event.target.value,
                                                    );
                                                    form.setData(
                                                        'subdivision_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'department_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'location_id',
                                                        '',
                                                    );
                                                }}
                                                disabled={
                                                    !form.data.subsidiary_id
                                                }
                                                className="mt-2 w-full rounded-xl border-stone-300 bg-white disabled:bg-stone-100"
                                            >
                                                <option value="">
                                                    Select division
                                                </option>
                                                {divisions.map((item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.division_id && (
                                                <span className="mt-1 block text-xs text-red-700">
                                                    {form.errors.division_id}
                                                </span>
                                            )}
                                        </label>

                                        <label className="block text-sm font-semibold text-stone-700">
                                            Sub-Division
                                            <select
                                                value={form.data.subdivision_id}
                                                onChange={(event) => {
                                                    form.setData(
                                                        'subdivision_id',
                                                        event.target.value,
                                                    );
                                                    form.setData(
                                                        'department_id',
                                                        '',
                                                    );
                                                    form.setData(
                                                        'location_id',
                                                        '',
                                                    );
                                                }}
                                                disabled={
                                                    !form.data.division_id
                                                }
                                                className="mt-2 w-full rounded-xl border-stone-300 bg-white disabled:bg-stone-100"
                                            >
                                                <option value="">
                                                    Select sub-division
                                                </option>
                                                {subdivisions.map((item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.subdivision_id && (
                                                <span className="mt-1 block text-xs text-red-700">
                                                    {form.errors.subdivision_id}
                                                </span>
                                            )}
                                        </label>

                                        <label className="block text-sm font-semibold text-stone-700">
                                            Department
                                            <select
                                                value={form.data.department_id}
                                                onChange={(event) => {
                                                    form.setData(
                                                        'department_id',
                                                        event.target.value,
                                                    );
                                                    form.setData(
                                                        'location_id',
                                                        '',
                                                    );
                                                }}
                                                disabled={
                                                    !form.data.subdivision_id
                                                }
                                                className="mt-2 w-full rounded-xl border-stone-300 bg-white disabled:bg-stone-100"
                                            >
                                                <option value="">
                                                    Select department
                                                </option>
                                                {departments.map((item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.department_id && (
                                                <span className="mt-1 block text-xs text-red-700">
                                                    {form.errors.department_id}
                                                </span>
                                            )}
                                        </label>

                                        <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                                            Location
                                            <select
                                                value={form.data.location_id}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'location_id',
                                                        event.target.value,
                                                    )
                                                }
                                                disabled={
                                                    !form.data.department_id
                                                }
                                                className="mt-2 w-full rounded-xl border-stone-300 bg-white disabled:bg-stone-100"
                                            >
                                                <option value="">
                                                    Select location
                                                </option>
                                                {locations.map((item) => (
                                                    <option
                                                        key={item.id}
                                                        value={item.id}
                                                    >
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.errors.location_id && (
                                                <span className="mt-1 block text-xs text-red-700">
                                                    {form.errors.location_id}
                                                </span>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {!isRoot && (
                                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#0b7654] shadow-sm">
                                        <ArmsIcon name="folder" className="h-6 w-6" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Parent folder</p>
                                        <p className="mt-0.5 truncate text-sm font-semibold text-[#073d2f]">{currentFolder?.name}</p>
                                        <p className="mt-0.5 text-xs text-stone-500">Your new subfolder will be created here.</p>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                {bulkFolderMode ? (
                                    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-stone-800">
                                                Subfolder names
                                            </p>
                                            <p className="mt-1 text-xs text-stone-500">
                                                Enter one folder name per line. Maximum 100 subfolders per bulk add.
                                            </p>
                                            <textarea
                                                value={bulkFolderNames}
                                                onChange={(event) =>
                                                    setBulkFolderNames(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder={
                                                    'Finance\nHuman Resources\nOperations'
                                                }
                                                rows={9}
                                                className="mt-2 w-full rounded-lg border-stone-300 bg-white px-3 py-2 text-sm"
                                                autoFocus
                                            />
                                            {bulkFolderPreview.length > 100 && (
                                                <p className="mt-2 text-xs font-semibold text-red-700">The limit is 100 folders per batch. Remove {bulkFolderPreview.length - 100} name(s) before creating.</p>
                                            )}
                                        </div>
                                        <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Folder preview</p>
                                                    <p className="mt-0.5 text-xs text-stone-500">These folders will be created inside {currentFolder?.name}.</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${bulkFolderPreview.length > 100 ? 'bg-red-100 text-red-700' : 'bg-white text-emerald-800'}`}>
                                                    {bulkFolderPreview.length} / 100
                                                </span>
                                            </div>
                                            {bulkFolderPreview.length > 0 ? (
                                                <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                                                    {bulkFolderPreview.slice(0, 100).map((name, index) => (
                                                        <div key={`${index}-${name}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
                                                            <ArmsIcon name="folder" className="h-4 w-4 shrink-0 text-emerald-700" />
                                                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-700" title={name}>{name}</span>
                                                            <span className="text-[10px] tabular-nums text-stone-400">{index + 1}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-dashed border-emerald-200 bg-white/70 px-3 py-6 text-center">
                                                    <ArmsIcon name="folder" className="mx-auto h-6 w-6 text-emerald-700/60" />
                                                    <p className="mt-2 text-xs text-stone-500">Type folder names above to preview them here.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-stone-800">
                                            {isRoot
                                                ? 'Filename'
                                                : 'Folder name'}
                                        </p>
                                        <input
                                            value={form.data.name}
                                            onChange={(event) =>
                                                form.setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={
                                                isRoot
                                                    ? 'Enter filename'
                                                    : 'Folder name'
                                            }
                                            className="mt-2 w-full rounded-lg border-stone-300 bg-white px-3 py-2 text-sm"
                                            autoFocus
                                        />
                                    </>
                                )}
                                {form.errors.name && (
                                    <p className="mt-2 text-sm text-red-700">
                                        {form.errors.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-stone-100 bg-stone-50/80 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setCreating(false)}
                                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={form.processing}
                                className="rounded-lg bg-arms-green px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#033b2d] disabled:opacity-50"
                            >
                                {form.processing
                                    ? 'Creating…'
                                    : isRoot
                                      ? 'Create Filename'
                                      : bulkFolderMode
                                        ? 'Create Subfolders'
                                        : 'Create Folder'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

function FolderUploadModal({
    currentFolder,
    breadcrumbs,
    onClose,
}: {
    currentFolder: Folder | null;
    breadcrumbs: Props['breadcrumbs'];
    onClose: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const form = useForm({
        folder_files: [] as File[],
        relative_paths: [] as string[],
    });
    const [uploading, setUploading] = useState(false);
    const [uploadedCount, setUploadedCount] = useState(0);
    const lockedDestination = currentFolder?.route_key ?? '';

    useEffect(() => {
        inputRef.current?.setAttribute('webkitdirectory', '');
        inputRef.current?.setAttribute('directory', '');
    }, []);

    const selectFiles = (files: File[]) => {
        const pairs = files
            .map((file) => ({
                file,
                path:
                    (file as File & { webkitRelativePath?: string })
                        .webkitRelativePath || '',
            }))
            .filter((item) => item.path);
        form.setData(
            'folder_files',
            pairs.map((item) => item.file),
        );
        form.setData(
            'relative_paths',
            pairs.map((item) => item.path),
        );
        form.clearErrors();
        if (files.length && !pairs.length)
            form.setError(
                'folder_files',
                'Choose a folder using the Choose folder button, or drag a folder from a supported browser.',
            );
    };

    const dropFolder = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const entries = Array.from(event.dataTransfer.items)
            .map((item: any) => item.webkitGetAsEntry?.())
            .filter(Boolean);
        if (!entries.length)
            return selectFiles(Array.from(event.dataTransfer.files));
        const collected: { file: File; path: string }[] = [];
        const walk = async (entry: any, parent = ''): Promise<void> => {
            const path = parent ? parent + '/' + entry.name : entry.name;
            if (entry.isFile)
                await new Promise<void>((resolve) =>
                    entry.file((file: File) => {
                        collected.push({ file, path });
                        resolve();
                    }, resolve),
                );
            else if (entry.isDirectory) {
                const reader = entry.createReader();
                const readAll = async (): Promise<any[]> =>
                    new Promise((resolve) =>
                        reader.readEntries((items: any[]) => resolve(items)),
                    );
                let children: any[] = [];
                let batch: any[];
                do {
                    batch = await readAll();
                    children = children.concat(batch);
                } while (batch.length);
                await Promise.all(children.map((child) => walk(child, path)));
            }
        };
        await Promise.all(entries.map((entry: any) => walk(entry)));
        form.setData(
            'folder_files',
            collected.map((item) => item.file),
        );
        form.setData(
            'relative_paths',
            collected.map((item) => item.path),
        );
        form.clearErrors();
    };

    const directories = useMemo(
        () =>
            Array.from(
                new Set(
                    form.data.relative_paths.flatMap((path) =>
                        path
                            .split('/')
                            .slice(0, -1)
                            .map((_, index, parts) =>
                                parts.slice(0, index + 1).join('/'),
                            ),
                    ),
                ),
            ),
        [form.data.relative_paths],
    );
    const rootCount = new Set(
        form.data.relative_paths
            .map((path) => path.split('/')[0])
            .filter(Boolean),
    ).size;
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (uploading || !form.data.folder_files.length) return;

        const extensionMismatch = form.data.relative_paths.findIndex((path, index) => {
            const requestedName = path.split('/').pop() ?? '';
            const originalName = form.data.folder_files[index]?.name ?? '';
            const originalExtension = originalName.split('.').pop()?.toLowerCase() ?? '';
            const requestedExtension = requestedName.split('.').pop()?.toLowerCase() ?? '';
            return !originalExtension || !requestedExtension || originalExtension !== requestedExtension;
        });
        if (extensionMismatch !== -1) {
            form.setError('folder_files', 'File extensions cannot be changed. Restore the original extension before uploading.');
            return;
        }

        const url = currentFolder
            ? route('documents.upload-folder', lockedDestination)
            : route('documents.upload-folder-root');
        const total = form.data.folder_files.length;
        const batchSize = 20;
        setUploading(true);
        setUploadedCount(0);
        form.clearErrors();

        try {
            for (let start = 0; start < total; start += batchSize) {
                const folderFiles = form.data.folder_files.slice(
                    start,
                    start + batchSize,
                );
                const relativePaths = form.data.relative_paths.slice(
                    start,
                    start + batchSize,
                );

                await new Promise<void>((resolve, reject) => {
                    router.post(
                        url,
                        {
                            folder_files: folderFiles,
                            relative_paths: relativePaths,
                        },
                        {
                            forceFormData: true,
                            preserveScroll: true,
                            onSuccess: () => resolve(),
                            onError: (errors) => {
                                form.setError(errors);
                                reject(new Error('Folder upload failed.'));
                            },
                        },
                    );
                });

                setUploadedCount(Math.min(start + folderFiles.length, total));
            }

            form.reset();
            onClose();
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] grid place-items-center bg-[#012a21]/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) =>
                event.target === event.currentTarget && !uploading && onClose()
            }
        >
            <form
                onSubmit={submit}
                className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <header className="flex shrink-0 items-center justify-between border-b border-stone-100 px-6 py-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#b8860b]">
                            Documents module · upload
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold text-[#073d2f]">
                            Upload Folder
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        aria-label="Close upload folder"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-xl text-stone-600 hover:bg-stone-50"
                    >
                        ×
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {currentFolder ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-arms-green">
                                Destination Path · Locked
                            </span>
                            <strong className="mt-1 block text-[#073d2f]">
                                Documents ›{' '}
                                {breadcrumbs
                                    .map((item) => item.name)
                                    .join(' › ')}
                            </strong>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[#073d2f]">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-arms-green">
                                Root folder upload
                            </span>
                            <strong className="mt-1 block">
                                The selected top-level folder will become the
                                Filename.
                            </strong>
                            <span className="mt-1 block text-xs text-stone-600">
                                Its detected structure will be created inside
                                that Filename automatically.
                            </span>
                        </div>
                    )}
                    <div
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={dropFolder}
                        className="mt-5 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-9 text-center"
                    >
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl text-arms-green shadow-sm">
                            ⇧
                        </span>
                        <h3 className="mt-4 font-semibold text-[#073d2f]">
                            Drag a folder here to preserve its folder structure.
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                            or choose a folder from your computer
                        </p>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="mt-4 rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#033b2d]"
                        >
                            Choose folder
                        </button>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            className="sr-only"
                            onChange={(event) => {
                                selectFiles(
                                    Array.from(event.target.files ?? []),
                                );
                                event.currentTarget.value = '';
                            }}
                        />
                    </div>
                    {form.errors.folder_files && (
                        <p className="mt-3 text-sm text-red-700">
                            {form.errors.folder_files}
                        </p>
                    )}
                    {form.data.relative_paths.length > 0 && (
                        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_190px]">
                            <section className="rounded-xl border border-stone-200 p-4">
                                <h3 className="font-semibold text-[#073d2f]">
                                    Detected structure
                                </h3>
                                <div className="mt-3 max-h-64 overflow-auto font-mono text-xs text-stone-700">
                                    {directories.map((directory) => (
                                        <div
                                            key={directory}
                                            className="py-0.5"
                                            style={{
                                                paddingLeft: `${Math.max(0, directory.split('/').length - 1) * 18}px`,
                                            }}
                                        >
                                            ▾ 📁 {directory.split('/').at(-1)}
                                        </div>
                                    ))}
                                    {form.data.relative_paths.map((path, index) => {
                                        const parts = path.split('/');
                                        const fileName = parts.pop() ?? path;
                                        const originalName = form.data.folder_files[index]?.name ?? fileName;
                                        const originalExtension = originalName.includes('.') && !originalName.startsWith('.')
                                            ? originalName.split('.').pop()?.toLowerCase()
                                            : '';
                                        const extension = fileName.includes('.') && !fileName.startsWith('.')
                                            ? `.${fileName.split('.').pop()}`
                                            : 'No extension';
                                        const extensionChanged = !originalExtension || (fileName.split('.').pop()?.toLowerCase() ?? '') !== originalExtension;
                                        return (
                                            <div
                                                key={`${index}-${path}`}
                                                className="flex items-center gap-2 py-1"
                                                style={{
                                                    paddingLeft: `${Math.max(0, path.split('/').length - 1) * 18}px`,
                                                }}
                                            >
                                                <span className="shrink-0">📄</span>
                                                <input
                                                    aria-label={`Rename uploaded file ${fileName}`}
                                                    value={fileName}
                                                    disabled={uploading}
                                                    onChange={(event) => {
                                                        const nextName = event.target.value;
                                                        const nextPaths = [...form.data.relative_paths];
                                                        nextPaths[index] = [...parts, nextName].join('/');
                                                        form.setData('relative_paths', nextPaths);
                                                    }}
                                                    className={`min-w-0 flex-1 rounded-md border ${extensionChanged ? 'border-red-400 bg-red-50' : 'border-stone-200 bg-white'} px-2 py-1 font-sans text-xs text-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100`}
                                                />
                                                <span className={`shrink-0 rounded px-1.5 py-1 font-sans text-[10px] font-semibold ${extensionChanged ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-500'}`}>
                                                    {extension}
                                                </span>
                                                {extensionChanged && (
                                                    <span className="shrink-0 text-[10px] font-semibold text-red-600">Extension cannot change</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-xs text-stone-500">
                                    File names and extensions are shown above. Edit a name before uploading; the folder structure is preserved.
                                </p>
                            </section>
                            <aside className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                                <p className="font-semibold text-[#073d2f]">
                                    Upload summary
                                </p>
                                <p className="mt-4">
                                    📁 {rootCount}{' '}
                                    {rootCount === 1 ? 'folder' : 'folders'}
                                </p>
                                <p className="mt-3">
                                    📂{' '}
                                    {Math.max(
                                        0,
                                        directories.length - rootCount,
                                    )}{' '}
                                    subfolders
                                </p>
                                <p className="mt-3">
                                    📄 {form.data.folder_files.length} files
                                </p>
                            </aside>
                        </div>
                    )}
                </div>
                <footer className="flex shrink-0 justify-end gap-3 border-t border-stone-100 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={uploading || !form.data.folder_files.length}
                        className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {uploading
                            ? `Uploading ${uploadedCount} of ${form.data.folder_files.length} files…`
                            : 'Upload folder'}
                    </button>
                </footer>
            </form>
        </div>
    );
}

function DocumentSummaryCard({
    icon,
    value,
    label,
}: {
    icon: 'document' | 'folder' | 'users' | 'building';
    value: number;
    label: string;
}) {
    return (
        <div className="flex min-h-[68px] min-w-[170px] items-center gap-3 rounded-xl border border-[#d7e7df] bg-white px-3.5 py-2 shadow-[0_4px_14px_rgba(6,59,45,0.05)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d7eee3] bg-[#effaf4] text-[#087b57]">
                <ArmsIcon name={icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
                <strong className="block text-[21px] font-bold leading-none text-[#073d2f]">
                    {value.toLocaleString()}
                </strong>
                <span className="mt-1.5 block truncate text-[11px] font-medium text-[#71837d]">
                    {label}
                </span>
            </span>
        </div>
    );
}

function FolderRow({
    folder,
    selected,
    onSelected,
    onInformation,
}: {
    folder: Folder;
    selected: boolean;
    onSelected: (checked: boolean) => void;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    useExclusiveDropdown('folder-' + folder.id, setMenuOpen);
    return (
        <tr
            className={
                'group transition ' +
                (menuOpen || selected
                    ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                    : 'hover:bg-emerald-50/40')
            }
        >
            <td className="px-5 py-4 sm:px-6">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onSelected(event.target.checked)}
                    aria-label={'Select ' + folder.name}
                    className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                />
            </td>
            <td className="px-5 py-4">
                <Link
                    href={route('documents.manage', folder.route_key)}
                    className="flex min-w-[220px] items-center gap-3 font-medium text-[#073d2f] hover:text-arms-green"
                >
                    <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-arms-green">
                        <ArmsIcon name="folder" className="h-5 w-5" />
                        <PinMarker pinned={folder.is_pinned} />
                    </span>
                    <span className="min-w-0 truncate">{folder.name}</span>
                </Link>
            </td>
            <td className="px-5 py-4 text-sm text-stone-600">Folder</td>
            <td className="hidden px-5 py-4 text-sm text-stone-500 md:table-cell">
                {formatDate(folder.updated_at)}
            </td>
            <td className="hidden px-5 py-4 text-sm text-stone-500 lg:table-cell">
                {folder.owner ?? '—'}
            </td>
            <td className="px-4 py-4 text-center">
                <FolderActions
                    folder={folder}
                    onInformation={onInformation}
                    open={menuOpen}
                    onOpenChange={(open) => {
                        if (open) notifyDropdownOpen('folder-' + folder.id);
                        setMenuOpen(open);
                    }}
                />
            </td>
        </tr>
    );
}
function FolderCard({
    folder,
    selected,
    onSelected,
    onInformation,
}: {
    folder: Folder;
    selected: boolean;
    onSelected: (checked: boolean) => void;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    useExclusiveDropdown('folder-' + folder.id, setMenuOpen);

    return (
        <article
            className={
                'group relative overflow-hidden rounded-xl border bg-[#fffdf5] text-left shadow-sm transition-all ' +
                (menuOpen || selected
                    ? 'border-arms-green bg-emerald-50/60 ring-2 ring-emerald-100'
                    : 'border-stone-200 hover:border-[#b7d9cb] hover:shadow-md')
            }
        >
            <div className="flex h-9 items-center justify-between px-2.5">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => onSelected(e.target.checked)}
                    aria-label={'Select ' + folder.name}
                    className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                />
                <div className="flex items-center gap-0.5">
                    {folder.is_pinned && (
                        <span title="Pinned" className="text-red-500">
                            <ArmsIcon
                                name="pin"
                                className="h-4 w-4 fill-current"
                            />
                        </span>
                    )}
                    <FolderActions
                        folder={folder}
                        onInformation={onInformation}
                        open={menuOpen}
                        onOpenChange={(open) => {
                            if (open) notifyDropdownOpen('folder-' + folder.id);
                            setMenuOpen(open);
                        }}
                    />
                </div>
            </div>

            <Link
                href={route('documents.manage', folder.route_key)}
                className="block px-2.5 pb-3"
            >
                <div className="relative grid h-30 w-full place-items-center overflow-hidden rounded-lg border border-stone-200 bg-white shadow-inner">
                    <div className="grid h-20 w-24 place-items-center rounded-2xl bg-amber-50 text-amber-500 shadow-sm ring-1 ring-amber-100 transition-transform duration-200 group-hover:scale-105">
                        <ArmsIcon name="folder" className="h-16 w-16" />
                    </div>
                    {folder.is_pinned && (
                        <span
                            className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white text-red-500 shadow-sm ring-1 ring-stone-200"
                            title="Pinned"
                        >
                            <ArmsIcon
                                name="pin"
                                className="h-3.5 w-3.5 fill-current"
                            />
                        </span>
                    )}
                </div>

                <div className="px-0.5 pt-2.5">
                    <p
                        className="truncate text-sm font-semibold text-[#073d2f]"
                        title={folder.name}
                    >
                        {folder.name}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-stone-500">
                        {folder.children_count}{' '}
                        {folder.children_count === 1
                            ? 'subfolder'
                            : 'subfolders'}{' '}
                        · {formatDate(folder.updated_at)}
                    </p>
                    <span
                        className="mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{
                            backgroundColor:
                                folder.is_published === true
                                    ? '#059669'
                                    : '#fef3c7',
                            color:
                                folder.is_published === true
                                    ? '#ffffff'
                                    : '#92400e',
                        }}
                    >
                        {folder.is_published === true
                            ? 'Published'
                            : 'Unpublished'}
                    </span>
                </div>
            </Link>
        </article>
    );
}
function DocumentThumbnail({ document }: { document: DocumentItem }) {
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(
        document.type.toUpperCase(),
    );
    if (!document.viewer_url)
        return <ArmsIcon name="document" className="h-9 w-9 text-arms-green" />;
    if (isImage)
        return (
            <img
                src={document.viewer_url}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
            />
        );
    return (
        <iframe
            src={document.viewer_url}
            title={'Preview of ' + document.name}
            tabIndex={-1}
            className="pointer-events-none h-full w-full border-0 bg-white"
        />
    );
}
function DocumentRow({
    document,
    destinations,
    onOpen,
    onInformation,
    selected,
    onSelected,
}: {
    document: DocumentItem;
    destinations: Props['uploadFolders'];
    onOpen: (document: DocumentItem) => void;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
    selected: boolean;
    onSelected: (checked: boolean) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    useExclusiveDropdown('document-' + document.id, setMenuOpen);
    return (
        <tr
            className={
                'transition ' +
                (menuOpen || selected
                    ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                    : 'hover:bg-emerald-50/40')
            }
        >
            <td className="px-5 py-4 sm:px-6">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onSelected(event.target.checked)}
                    aria-label={'Select ' + document.name}
                    className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                />
            </td>
            <td className="px-5 py-4">
                <button
                    onClick={() => onOpen(document)}
                    className="flex items-center gap-3 font-medium text-[#073d2f]"
                >
                    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-arms-green">
                        <ArmsIcon name="document" className="h-5 w-5" />
                        <PinMarker pinned={document.is_pinned} />
                    </span>
                    <span>{document.name.toLowerCase().endsWith('.' + document.type.toLowerCase()) ? document.name : document.name + '.' + document.type.toLowerCase()}</span>
                </button>
            </td>
            <td className="px-5 py-4 text-sm">{document.type}</td>
            <td className="hidden px-5 py-4 text-sm md:table-cell">
                {formatDate(document.modified_at)}
            </td>
            <td className="hidden px-5 py-4 text-sm lg:table-cell">
                {document.owner}
            </td>
            <td className="px-4 py-4 text-center">
                <DocumentActions
                    document={document}
                    destinations={destinations}
                    onOpen={onOpen}
                    onInformation={onInformation}
                    open={menuOpen}
                    onOpenChange={(open) => {
                        if (open) notifyDropdownOpen('document-' + document.id);
                        setMenuOpen(open);
                    }}
                />
            </td>
        </tr>
    );
}
function DocumentCard({
    document,
    destinations,
    onOpen,
    onInformation,
    selected,
    onSelected,
}: {
    document: DocumentItem;
    destinations: Props['uploadFolders'];
    onOpen: (document: DocumentItem) => void;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
    selected: boolean;
    onSelected: (checked: boolean) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    useExclusiveDropdown('document-' + document.id, setMenuOpen);
    return (
        <article
            className={
                'group relative overflow-hidden rounded-xl border bg-[#fffdf5] text-left shadow-sm transition-all ' +
                (menuOpen || selected
                    ? 'border-arms-green bg-emerald-50/60 ring-2 ring-emerald-100'
                    : 'border-stone-200 hover:border-[#b7d9cb] hover:shadow-md')
            }
        >
            <div className="flex h-9 items-center justify-between px-2.5">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => onSelected(event.target.checked)}
                    aria-label={'Select ' + document.name}
                    className="rounded border-stone-300 text-arms-green focus:ring-arms-green"
                />
                <DocumentActions
                    document={document}
                    destinations={destinations}
                    onOpen={onOpen}
                    onInformation={onInformation}
                    open={menuOpen}
                    onOpenChange={(open) => {
                        if (open) notifyDropdownOpen('document-' + document.id);
                        setMenuOpen(open);
                    }}
                />
            </div>
            <button
                type="button"
                onClick={() => onOpen(document)}
                className="block w-full text-left"
            >
                <div className="relative mx-2.5 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-inner">
                    <div className="grid h-48 w-full place-items-center overflow-hidden">
                        <DocumentThumbnail document={document} />
                    </div>
                    <PinMarker pinned={document.is_pinned} />
                </div>
                <div className="px-3 pb-3 pt-2.5">
                    <p
                        className="truncate text-sm font-semibold text-[#073d2f]"
                        title={document.name.toLowerCase().endsWith('.' + document.type.toLowerCase()) ? document.name : document.name + '.' + document.type.toLowerCase()}
                    >
                        {document.name.toLowerCase().endsWith('.' + document.type.toLowerCase()) ? document.name : document.name + '.' + document.type.toLowerCase()}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-stone-500">
                        {document.type} · {formatDate(document.modified_at)}
                    </p>
                </div>
            </button>
        </article>
    );
}
function LegacyDocumentViewer({
    document,
    documents,
    destinations,
    folderPath,
    close,
}: {
    document: DocumentItem;
    documents: DocumentItem[];
    destinations: Props['uploadFolders'];
    folderPath: string;
    close: () => void;
}) {
    const [current, setCurrent] = useState(document);
    const [showDocumentSidebar, setShowDocumentSidebar] = useState(true);
    const [showFileDetails, setShowFileDetails] = useState(true);
    const [actionsOpen, setActionsOpen] = useState(false);
    useExclusiveDropdown('viewer-actions', setActionsOpen);
    const [renameOpen, setRenameOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(document.name);
    const [destinationId, setDestinationId] = useState('');
    const [zoom, setZoom] = useState(1);
    const [fit, setFit] = useState(true);
    const [zoomOpen, setZoomOpen] = useState(false);
    useExclusiveDropdown('viewer-zoom', setZoomOpen);
    const [page, setPage] = useState(1);
    const [pdfViewMode, setPdfViewMode] = useState<'single' | 'vertical'>(
        'vertical',
    );
    const [verticalPage, setVerticalPage] = useState(1);
    const verticalViewerRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragOrigin = useRef({ x: 0, y: 0 });
    const positionOrigin = useRef({ x: 0, y: 0 });
    const index = documents.findIndex((item) => item.id === current.id);
    // In Vertical View, show details for the document section currently in view.
    // Single View continues to show details for the selected document.
    const detailsDocument =
        pdfViewMode === 'vertical'
            ? documents[verticalPage - 1] ?? current
            : current;
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP'].includes(
        current.type.toUpperCase(),
    );
    const isPdf = current.type.toUpperCase() === 'PDF';
    const viewerSource =
        current.viewer_url && isPdf
            ? `${current.viewer_url}#page=${pdfViewMode === 'vertical' ? 1 : page}&zoom=${pdfViewMode === 'vertical' ? 'page-width' : fit ? 'page-fit' : Math.round(zoom * 100)}`
            : current.viewer_url;

    useEffect(() => {
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';
        const stopBrowserZoom = (event: WheelEvent) => {
            if (!event.ctrlKey || (!isImage && !isPdf)) return;
            event.preventDefault();
            setFit(false);
            setZoom((value) =>
                Math.min(
                    4,
                    Math.max(0.25, value + (event.deltaY < 0 ? 0.1 : -0.1)),
                ),
            );
        };
        window.addEventListener('wheel', stopBrowserZoom, {
            passive: false,
            capture: true,
        });
        return () => {
            window.document.body.style.overflow = previousOverflow;
            window.removeEventListener('wheel', stopBrowserZoom, true);
        };
    }, [isImage, isPdf]);

    useEffect(() => {
        if (pdfViewMode !== 'vertical') {
            setVerticalPage(1);
            return;
        }

        const viewer = verticalViewerRef.current;
        if (!viewer) return;

        // When Vertical View opens, position the scroll container at the
        // document that is currently selected in Single View, not at the top.
        const selectedSection = viewer.querySelector<HTMLElement>(
            `[data-vertical-page="${index + 1}"]`,
        );
        if (selectedSection) {
            const viewerTop = viewer.getBoundingClientRect().top;
            const sectionTop = selectedSection.getBoundingClientRect().top;
            viewer.scrollTop += sectionTop - viewerTop - 20;
        }

        const updateVerticalPage = () => {
            const sections = Array.from(
                viewer.querySelectorAll<HTMLElement>('[data-vertical-page]'),
            );

            if (!sections.length) {
                setVerticalPage(1);
                return;
            }

            const viewerTop = viewer.getBoundingClientRect().top;
            let activePage = 1;
            let closestDistance = Number.POSITIVE_INFINITY;

            sections.forEach((section, sectionIndex) => {
                const distance = Math.abs(
                    section.getBoundingClientRect().top - viewerTop - 24,
                );

                if (distance < closestDistance) {
                    closestDistance = distance;
                    activePage = sectionIndex + 1;
                }
            });

            setVerticalPage(activePage);
        };

        updateVerticalPage();
        viewer.addEventListener('scroll', updateVerticalPage, { passive: true });

        return () => {
            viewer.removeEventListener('scroll', updateVerticalPage);
        };
    }, [pdfViewMode, documents.length, index]);

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
        return () =>
            window.removeEventListener('keydown', navigateWithKeyboard);
    }, [index, documents.length, renameOpen, transferOpen]);

    const resetView = () => {
        setZoom(1);
        setFit(true);
        setPage(1);
        setPosition({ x: 0, y: 0 });
    };
    const actualSize = () => {
        setZoom(1);
        setFit(false);
        setPosition({ x: 0, y: 0 });
    };
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
        setPosition({
            x: positionOrigin.current.x + event.clientX - dragOrigin.current.x,
            y: positionOrigin.current.y + event.clientY - dragOrigin.current.y,
        });
    };
    const stopDrag = () => {
        dragging.current = false;
    };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!current.update_url || !renameValue.trim()) return;
        const normalizedName = renameValue.trim().replace(/\s+/g, '_');
        router.patch(
            current.update_url,
            { title: renameValue.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCurrent((item) => ({ ...item, name: normalizedName }));
                    setRenameValue(normalizedName);
                    setRenameOpen(false);
                },
            },
        );
    };
    const submitTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!current.move_url || !destinationId) return;
        router.patch(
            current.move_url,
            { folder_id: destinationId },
            { preserveScroll: true, onSuccess: close },
        );
    };
    const remove = () => {
        if (current.delete_url)
            router.delete(current.delete_url, {
                preserveScroll: true,
                onSuccess: close,
            });
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#012a21]/65 p-2 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                className="flex h-[96vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-emerald-900/20 bg-white shadow-2xl"
            >
                <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/20 bg-[#075b43] px-5 py-3 text-white">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-sm">A</span>
                            ARMS <span className="text-white/50">/</span> Document viewer
                        </div>

                        <h2 className="mt-1 truncate text-base font-semibold">
                            {current.name}
                        </h2>

                        <div className="mt-1 flex min-w-0 items-center gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm">
                                {folderPath}
                            </p>

                            <span className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold whitespace-nowrap">
                                Page {pdfViewMode === 'single' ? index + 1 : verticalPage} of {documents.length}
                            </span>

                            <div className="flex shrink-0 items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-white/75">
                                    View:
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={pdfViewMode === 'vertical'}
                                    aria-label={`Document view: ${pdfViewMode === 'single' ? 'Single' : 'Vertical'}. Switch to ${pdfViewMode === 'single' ? 'Vertical' : 'Single'} view`}
                                    onClick={() => {
                                        if (pdfViewMode === 'single') {
                                            setPdfViewMode('vertical');
                                            setPage(1);
                                        } else {
                                            // Reset zoom and position when returning to Single View.
                                            setPdfViewMode('single');
                                            setPage(1);
                                            setZoom(1);
                                            setFit(true);
                                            setPosition({ x: 0, y: 0 });
                                            if (verticalViewerRef.current) {
                                                verticalViewerRef.current.scrollTop = 0;
                                                verticalViewerRef.current.scrollLeft = 0;
                                            }
                                        }
                                    }}
                                    className={`relative flex h-9 w-[156px] items-center rounded-full border p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-[#075b43] ${
                                        pdfViewMode === 'vertical'
                                            ? 'border-white/70 bg-white/20'
                                            : 'border-white/70 bg-white/20'
                                    }`}
                                >
                                    <span className={`absolute left-1 top-1 h-[27px] w-[75px] rounded-full bg-white shadow-sm transition-transform duration-200 ${pdfViewMode === 'vertical' ? 'translate-x-[75px]' : 'translate-x-0'}`} />
                                    <span className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors ${pdfViewMode === 'single' ? 'text-arms-green' : 'text-white/90'}`}>
                                        Single
                                    </span>
                                    <span className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors ${pdfViewMode === 'vertical' ? 'text-arms-green' : 'text-white/90'}`}>
                                        Vertical
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                        {/* Actions + Zoom + Close */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDocumentSidebar((visible) => !visible)}
                                aria-pressed={showDocumentSidebar}
                                title={showDocumentSidebar ? 'Hide document thumbnails' : 'Show document thumbnails'}
                                className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                            >
                                {showDocumentSidebar ? 'Hide files' : 'Show files'}⌄
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowFileDetails((visible) => !visible)}
                                aria-pressed={showFileDetails}
                                title={showFileDetails ? 'Hide file details' : 'Show file details'}
                                className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                            >
                                {showFileDetails ? 'Hide details' : 'Show details'}⌄
                            </button>
                            {/* Actions */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextOpen = !actionsOpen;

                                        if (nextOpen) {
                                            notifyDropdownOpen(
                                                'viewer-actions',
                                            );
                                        }

                                        setActionsOpen(nextOpen);
                                    }}
                                    className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                                >
                                    Actions⌄
                                </button>

                                {actionsOpen && (
                                    <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm text-stone-700 shadow-2xl">
                                        {current.move_url && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActionsOpen(false);
                                                    setTransferOpen(true);
                                                }}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50"
                                            >
                                                ⇄ Transfer
                                            </button>
                                        )}
                                        {current.download_url && (
                                            <a
                                                href={current.download_url}
                                                onClick={() => setActionsOpen(false)}
                                                className="block rounded-lg px-3 py-2.5 hover:bg-stone-50"
                                            >
                                                ⇩ Download
                                            </a>
                                        )}
                                        {current.update_url && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRenameValue(current.name);
                                                    setActionsOpen(false);
                                                    setRenameOpen(true);
                                                }}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50"
                                            >
                                                ✎ Rename
                                            </button>
                                        )}
                                        {current.delete_url && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActionsOpen(false);
                                                    setDeleteOpen(true);
                                                }}
                                                className="block w-full rounded-lg px-3 py-2.5 text-left text-red-700 hover:bg-red-50"
                                            >
                                                ♜ Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Zoom */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextOpen = !zoomOpen;

                                        if (nextOpen) {
                                            notifyDropdownOpen('viewer-zoom');
                                        }

                                        setZoomOpen(nextOpen);
                                    }}
                                    className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                                >
                                    Zoom ▾
                                </button>

                                {zoomOpen && (
                                    <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-stone-200 bg-white p-2 text-sm text-stone-700 shadow-2xl">
                                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                            <span className="text-xs font-semibold text-stone-500">Zoom level</span>
                                            <strong className="text-arms-green">{Math.round(zoom * 100)}%</strong>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                            <button
                                                type="button"
                                                disabled={!isImage && !isPdf}
                                                onClick={() => {
                                                    setFit(false);
                                                    setZoom((value) => Math.max(0.25, value - 0.1));
                                                }}
                                                className="rounded-lg px-2 py-2 text-left hover:bg-stone-50 disabled:opacity-35"
                                            >
                                                − Zoom Out
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!isImage && !isPdf}
                                                onClick={() => {
                                                    setFit(false);
                                                    setZoom((value) => Math.min(4, value + 0.1));
                                                }}
                                                className="rounded-lg px-2 py-2 text-left hover:bg-stone-50 disabled:opacity-35"
                                            >
                                                + Zoom In
                                            </button>
                                        </div>
                                        <div className="my-1 border-t border-stone-100" />
                                        <button
                                            type="button"
                                            disabled={!isImage && !isPdf}
                                            onClick={() => {
                                                resetView();
                                                setZoomOpen(false);
                                            }}
                                            className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-35"
                                        >
                                            Fit to Screen
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!isImage && !isPdf}
                                            onClick={() => {
                                                actualSize();
                                                setZoomOpen(false);
                                            }}
                                            className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-35"
                                        >
                                            Actual Size (100%)
                                        </button>
                                        {isPdf && pdfViewMode === 'single' && (
                                            <>
                                                <div className="my-1 border-t border-stone-100" />
                                                <div className="flex items-center gap-2 px-2 py-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={page <= 1}
                                                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                                                        className="rounded-lg border border-stone-200 px-2 py-1.5 hover:bg-stone-50 disabled:opacity-35"
                                                    >
                                                        Prev
                                                    </button>
                                                    <label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-stone-600">
                                                        Page
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={page}
                                                            onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
                                                            className="w-14 rounded border-stone-300 py-1 text-center text-xs"
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPage((value) => value + 1)}
                                                        className="rounded-lg border border-stone-200 px-2 py-1.5 hover:bg-stone-50"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Close */}
                            <button
                                onClick={close}
                                aria-label="Close document viewer"
                                className="grid h-8 w-8 place-items-center rounded-lg border border-white/40 text-xl hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </header>
                
                <div className="flex min-h-0 flex-1 overflow-hidden bg-[#eaf2ee]">
                    {showDocumentSidebar && (
                    <aside className="hidden w-40 shrink-0 flex-col border-r border-emerald-900/10 bg-white md:flex">
                        <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-3 py-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Documents</p>
                                <p className="mt-1 text-xs font-semibold text-[#075b43]">{documents.length} in this folder</p>
                            </div>
                            <button type="button" onClick={() => setShowDocumentSidebar(false)} aria-label="Collapse documents sidebar" title="Hide files" className="shrink-0 rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100">‹</button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                            {documents.map((item, itemIndex) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => changeDocument(itemIndex)}
                                    aria-current={item.id === current.id ? 'page' : undefined}
                                    title={item.name}
                                    className={`w-full rounded-xl border p-2 text-left transition ${
                                        item.id === current.id
                                            ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-100'
                                            : 'border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                                    }`}
                                >
                                    <div className="grid h-24 place-items-center overflow-hidden rounded-lg border border-stone-100 bg-white">
                                        <DocumentThumbnail document={item} />
                                    </div>
                                    <p className="mt-2 truncate text-[11px] font-semibold text-stone-700">{item.name}</p>
                                    <p className="mt-0.5 text-[10px] uppercase text-stone-400">{item.type}</p>
                                </button>
                            ))}
                        </div>
                    </aside>
                    )}

                    <div
                    onMouseDown={startDrag}
                    onMouseMove={moveDrag}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                    ref={verticalViewerRef}
                    className={
                        'relative min-h-0 min-w-0 flex-1 bg-[#24313a] p-5 ' +
                        (pdfViewMode === 'vertical'
                            ? 'overflow-y-auto'
                            : isPdf
                              ? 'overflow-y-auto'
                              : 'overflow-hidden') +
                        (isImage ? ' cursor-grab active:cursor-grabbing' : '')
                    }
                >
                    {pdfViewMode === 'vertical' ? (
                        <div className="flex min-h-full flex-col items-center gap-6">
                            {documents.map((item, itemIndex) => {
                                const itemIsImage = [
                                    'PNG',
                                    'JPG',
                                    'JPEG',
                                    'GIF',
                                    'WEBP',
                                    'BMP',
                                ].includes(item.type.toUpperCase());
                                const itemIsPdf =
                                    item.type.toUpperCase() === 'PDF';
                                const itemSource = item.viewer_url
                                    ? itemIsPdf
                                        ? `${item.viewer_url}#page=1&zoom=${fit ? 'page-width' : Math.round(zoom * 100)}`
                                        : item.viewer_url
                                    : null;

                                return (
                                    <section
                                        key={item.id}
                                        data-vertical-page={itemIndex + 1}
                                        className="w-full max-w-[calc(100vw-80px)] shrink-0"
                                    >
                                        {itemSource ? (
                                            itemIsImage ? (
                                                <div className="flex min-h-[520px] w-full items-center justify-center overflow-hidden">
                                                    <img
                                                        draggable={false}
                                                        src={itemSource}
                                                        alt={item.name}
                                                        className={
                                                            fit
                                                                ? 'max-h-[calc(96vh-190px)] max-w-full h-auto w-auto select-none object-contain'
                                                                : 'max-h-none max-w-none select-none'
                                                        }
                                                        // CSS zoom participates in document layout, so each vertically
                                                        // stacked page reserves its scaled height and the gap between
                                                        // pages stays consistent when zooming in or out.
                                                        style={{
                                                            zoom: fit ? 1 : zoom,
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <iframe
                                                    title={`Uploaded document viewer - ${item.name}`}
                                                    src={itemSource}
                                                    className="h-[80vh] min-h-[520px] w-full rounded bg-white"
                                                />
                                            )
                                        ) : (
                                            <div className="grid min-h-[520px] place-items-center text-stone-500">
                                                The protected viewer is not ready.
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    ) : viewerSource ? (
                        isImage ? (
                            <div className="grid min-h-full min-w-full place-items-center overflow-visible">
                                <img
                                    draggable={false}
                                    src={viewerSource}
                                    alt={current.name}
                                    className={
                                        fit
                                            ? 'max-h-[calc(96vh-190px)] max-w-[calc(100vw-80px)] h-auto w-auto select-none object-contain'
                                            : 'max-h-none max-w-none select-none'
                                    }
                                    style={{
                                        transform: `translate(${position.x}px, ${position.y}px) scale(${fit ? 1 : zoom})`,
                                        transformOrigin: 'center center',
                                    }}
                                />
                            </div>
                        ) : (
                            <iframe
                                title="Uploaded document viewer"
                                src={viewerSource}
                                className="h-full min-h-[520px] w-full rounded bg-white"
                            />
                        )
                    ) : (
                        <div className="grid h-full place-items-center bg-white text-stone-500">
                            The protected viewer is not ready.
                        </div>
                    )}
                    {documents.length > 1 && pdfViewMode === 'single' && (
                        <>
                            <button
                                type="button"
                                disabled={index <= 0}
                                onClick={() => changeDocument(index - 1)}
                                className="absolute left-5 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/20 text-4xl text-white backdrop-blur hover:bg-black/35 disabled:opacity-30"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                disabled={index >= documents.length - 1}
                                onClick={() => changeDocument(index + 1)}
                                className="absolute right-5 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/20 text-4xl text-white backdrop-blur hover:bg-black/35 disabled:opacity-30"
                            >
                                ›
                            </button>
                        </>
                    )}
                    </div>

                    {showFileDetails && (
                    <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-emerald-900/10 bg-white xl:block">
                        <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-4">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">File details</p>
                                <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-[#073d2f]">{detailsDocument.name}</h3>
                                <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">{detailsDocument.type}</span>
                            </div>
                            <button type="button" onClick={() => setShowFileDetails(false)} aria-label="Collapse file details panel" title="Hide details" className="shrink-0 rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100">›</button>
                        </div>
                        <div className="space-y-4 px-4 py-4 text-xs">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Location</p>
                                <p className="mt-1 break-words leading-5 text-stone-700">{folderPath || 'Current folder'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Owner</p>
                                <p className="mt-1 break-words text-stone-700">{detailsDocument.owner || 'Not available'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Last modified</p>
                                <p className="mt-1 text-stone-700">{formatDate(detailsDocument.modified_at)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Document ID</p>
                                <p className="mt-1 break-all font-mono text-stone-700">{detailsDocument.id}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Pinned</p>
                                <p className="mt-1 text-stone-700">{detailsDocument.is_pinned ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 leading-5 text-emerald-900">
                                <p className="font-semibold">Secure document preview</p>
                                <p className="mt-1 text-emerald-800/80">Use Actions to manage this file. Use Zoom to adjust the preview.</p>
                            </div>
                        </div>
                    </aside>
                    )}
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/10 bg-white px-5 py-2.5 text-xs">
                    <span className="truncate font-semibold text-[#073d2f]">
                        {current.name}
                    </span>
                    <span className="truncate text-stone-500">
                        {folderPath}
                    </span>
                </footer>
            </div>
            {renameOpen && (
                <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4">
                    <form
                        onSubmit={submitRename}
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h3 className="text-lg font-semibold text-[#073d2f]">
                            Rename document
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                            Rename this file without leaving the viewer.
                        </p>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={(event) =>
                                setRenameValue(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setRenameOpen(false)}
                                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white">
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {transferOpen && (
                <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4">
                    <form
                        onSubmit={submitTransfer}
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h3 className="text-lg font-semibold text-[#073d2f]">
                            Transfer document
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                            Choose the destination without leaving the document
                            viewer.
                        </p>
                        <select
                            autoFocus
                            value={destinationId}
                            onChange={(event) =>
                                setDestinationId(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        >
                            <option value="">Select destination path</option>
                            {destinations.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.path}
                                </option>
                            ))}
                        </select>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setTransferOpen(false)}
                                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!destinationId}
                                className="rounded-xl bg-arms-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Transfer
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {deleteOpen && (
                <div className="absolute inset-0 z-[60] grid place-items-center bg-black/30 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">
                            !
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-[#073d2f]">
                            Delete document?
                        </h3>
                        <p className="mt-2 text-sm text-stone-500">
                            Delete <strong>{current.name}</strong>? This action
                            cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={remove}
                                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
function DocumentActions({
    document,
    destinations,
    onOpen,
    onInformation,
    open,
    onOpenChange,
}: {
    document: DocumentItem;
    destinations: Props['uploadFolders'];
    onOpen: (document: DocumentItem) => void;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [renameValue, setRenameValue] = useState(document.name);
    const [destinationId, setDestinationId] = useState('');
    const closeAndOpen = () => {
        onOpenChange(false);
        onOpen(document);
    };
    const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 208;
        const menuHeight = 270;
        const viewportPadding = 12;
        const availableBelow = window.innerHeight - rect.bottom;
        const top =
            availableBelow >= menuHeight + viewportPadding
                ? rect.bottom + 6
                : Math.max(viewportPadding, rect.top - menuHeight - 6);
        const left = Math.min(
            window.innerWidth - menuWidth - viewportPadding,
            Math.max(viewportPadding, rect.right - menuWidth),
        );
        setMenuPosition({ top, left });
        if (!open) {
            notifyDropdownOpen('document-' + document.id);
        }
        onOpenChange(!open);
    };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!document.update_url || !renameValue.trim()) return;
        router.patch(
            document.update_url,
            { title: renameValue.trim() },
            { preserveScroll: true, onSuccess: () => setRenameOpen(false) },
        );
    };
    const submitTransfer = (event: FormEvent) => {
        event.preventDefault();
        if (!document.move_url || !destinationId) return;
        router.patch(
            document.move_url,
            { folder_id: destinationId },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTransferOpen(false);
                    setDestinationId('');
                },
            },
        );
    };
    const togglePin = () => {
        if (!document.pin_url) return;
        onOpenChange(false);
        router.patch(document.pin_url, {}, { preserveScroll: true });
    };
    const remove = () => {
        if (!document.delete_url) return;
        router.delete(document.delete_url, {
            preserveScroll: true,
            onSuccess: () => setDeleteOpen(false),
        });
    };
    return (
        <div className="inline-block text-left">
            <button
                type="button"
                onClick={toggle}
                aria-label={'Actions for ' + document.name}
                className={
                    'rounded-lg px-2 py-1 text-lg leading-none transition ' +
                    (open
                        ? 'bg-emerald-100 text-[#073d2f]'
                        : 'text-stone-500 hover:bg-emerald-50')
                }
            >
                ⋮
            </button>
            {open && (
                <div
                    className="fixed z-[80] w-52 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                    <button
                        onClick={closeAndOpen}
                        className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                    >
                        Open viewer
                    </button>
                    {document.pin_url && (
                        <button
                            type="button"
                            onClick={togglePin}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                        >
                            <ArmsIcon
                                name="pin"
                                className={
                                    'h-4 w-4 ' +
                                    (document.is_pinned
                                        ? 'fill-current text-[#a91f1f]'
                                        : 'text-stone-500')
                                }
                            />
                            {document.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}
                    {document.information_url && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                onInformation({
                                    name: document.name,
                                    url: document.information_url!,
                                    kind: 'document',
                                });
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-arms-green hover:bg-emerald-50"
                        >
                            Information
                        </button>
                    )}
                    {document.download_url && (
                        <a
                            href={document.download_url}
                            className="block rounded-lg px-3 py-2 hover:bg-stone-50"
                        >
                            Download viewer
                        </a>
                    )}
                    {document.update_url && (
                        <button
                            type="button"
                            onClick={() => {
                                setRenameValue(document.name);
                                onOpenChange(false);
                                setRenameOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                        >
                            Rename
                        </button>
                    )}
                    {document.move_url && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                setTransferOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                        >
                            Transfer
                        </button>
                    )}
                    {document.delete_url && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                setDeleteOpen(true);
                            }}
                            className="mt-1 block w-full border-t border-stone-100 px-3 py-2 text-left text-red-700 hover:bg-red-50"
                        >
                            Delete
                        </button>
                    )}
                </div>
            )}
            {renameOpen && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4">
                    <form
                        onSubmit={submitRename}
                        className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"
                    >
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">
                            ✎
                        </div>
                        <h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">
                            Rename file
                        </h3>
                        <p className="mt-1 text-center text-sm text-stone-500">
                            Spaces will automatically become underscores.
                            Windows-invalid characters are not allowed.
                        </p>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={(event) =>
                                setRenameValue(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        />
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setRenameOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-arms-dark">
                                Rename
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {transferOpen && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={submitTransfer}
                        className="w-full max-w-lg rounded-2xl bg-white p-6 text-left shadow-2xl"
                    >
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">
                            ⇄
                        </div>
                        <h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">
                            Transfer file
                        </h3>
                        <p className="mt-1 text-center text-sm text-stone-500">
                            Choose a destination. You will remain on this page
                            after the transfer.
                        </p>
                        <select
                            autoFocus
                            value={destinationId}
                            onChange={(event) =>
                                setDestinationId(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        >
                            <option value="">Select destination path</option>
                            {destinations.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.path}
                                </option>
                            ))}
                        </select>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setTransferOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!destinationId}
                                className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Transfer
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {deleteOpen && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">
                            !
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-[#073d2f]">
                            Delete file?
                        </h3>
                        <p className="mt-2 text-sm text-stone-500">
                            Delete <strong>{document.name}</strong>? This action
                            cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={remove}
                                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
function FolderActions({
    folder,
    onInformation,
    open,
    onOpenChange,
    variant = 'default',
}: {
    folder: Folder;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant?: 'default' | 'header';
}) {
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [hierarchyOpen, setHierarchyOpen] = useState(false);
    const [preview, setPreview] = useState<HierarchyPreview | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [deletingHierarchy, setDeletingHierarchy] = useState(false);
    const [renameValue, setRenameValue] = useState(folder.name);
    const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 208;
        const menuHeight = 220;
        const viewportPadding = 12;
        const top =
            window.innerHeight - rect.bottom >= menuHeight + viewportPadding
                ? rect.bottom + 6
                : Math.max(viewportPadding, rect.top - menuHeight - 6);
        setMenuPosition({
            top,
            left: Math.min(
                window.innerWidth - menuWidth - viewportPadding,
                Math.max(viewportPadding, rect.right - menuWidth),
            ),
        });
        if (!open) {
            notifyDropdownOpen('folder-' + folder.id);
        }
        onOpenChange(!open);
    };
    const submitRename = (event: FormEvent) => {
        event.preventDefault();
        if (!folder.rename_url || !renameValue.trim()) return;
        router.patch(
            folder.rename_url,
            { name: renameValue.trim() },
            { preserveScroll: true, onSuccess: () => setRenameOpen(false) },
        );
    };
    const togglePin = () => {
        if (folder.pin_url) {
            onOpenChange(false);
            router.patch(folder.pin_url, {}, { preserveScroll: true });
        }
    };
    const remove = () => {
        if (folder.delete_url)
            router.delete(folder.delete_url, {
                preserveScroll: true,
                onSuccess: () => setDeleteOpen(false),
            });
    };
    const openHierarchyDelete = async () => {
        if (!folder.hierarchy_preview_url) return;
        onOpenChange(false);
        setHierarchyOpen(true);
        setPreview(null);
        setPreviewError('');
        setConfirmation('');
        setLoadingPreview(true);
        try {
            const response = await fetch(folder.hierarchy_preview_url, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            if (!response.ok)
                throw new Error('The hierarchy preview could not be loaded.');
            setPreview((await response.json()) as HierarchyPreview);
        } catch (error) {
            setPreviewError(
                error instanceof Error
                    ? error.message
                    : 'The hierarchy preview could not be loaded.',
            );
        } finally {
            setLoadingPreview(false);
        }
    };
    const destroyHierarchy = () => {
        if (
            !folder.hierarchy_delete_url ||
            confirmation !== folder.name ||
            deletingHierarchy
        )
            return;
        setDeletingHierarchy(true);
        router.delete(folder.hierarchy_delete_url, {
            data: { confirmation },
            preserveScroll: true,
            onSuccess: () => setHierarchyOpen(false),
            onFinish: () => setDeletingHierarchy(false),
        });
    };
    return (
        <div className="inline-block text-left">
            <button
                type="button"
                onClick={toggle}
                aria-label={'Actions for folder ' + folder.name}
                className={
                    variant === 'header'
                        ? 'inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50'
                        : 'rounded-lg px-2 py-1 text-lg leading-none transition ' +
                          (open
                              ? 'bg-emerald-100 text-[#073d2f]'
                              : 'text-stone-500 hover:bg-emerald-50 hover:text-[#073d2f]')
                }
            >
                {variant === 'header' ? (
                    <>
                        Action <span className="text-xs">⌄</span>
                    </>
                ) : (
                    '⋮'
                )}
            </button>
            {open && (
                <div
                    className="fixed z-[80] w-56 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-2xl"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                    <Link
                        href={route('documents.manage', folder.route_key)}
                        className="block rounded-lg px-3 py-2 hover:bg-stone-50"
                    >
                        Open folder
                    </Link>
                    {folder.pin_url && (
                        <button
                            type="button"
                            onClick={togglePin}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                        >
                            <ArmsIcon
                                name="pin"
                                className={
                                    'h-4 w-4 ' +
                                    (folder.is_pinned
                                        ? 'fill-current text-[#a91f1f]'
                                        : 'text-stone-500')
                                }
                            />
                            {folder.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}
                    {folder.information_url && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                onInformation({
                                    name: folder.name,
                                    url: folder.information_url!,
                                    kind: 'folder',
                                });
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-arms-green hover:bg-emerald-50"
                        >
                            Information
                        </button>
                    )}
                    {!folder.is_published &&
                        folder.can_publish &&
                        folder.publish_url && (
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenChange(false);
                                    router.patch(
                                        folder.publish_url!,
                                        {},
                                        {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                router.reload({
                                                    only: ['folders'],
                                                }),
                                        },
                                    );
                                }}
                                className="block w-full rounded-lg px-3 py-2 text-left font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                                Publish
                            </button>
                        )}
                    {folder.is_published &&
                        folder.can_unpublish &&
                        folder.unpublish_url && (
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenChange(false);
                                    router.patch(
                                        folder.unpublish_url!,
                                        {},
                                        {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                router.reload({
                                                    only: ['folders'],
                                                }),
                                        },
                                    );
                                }}
                                className="block w-full rounded-lg px-3 py-2 text-left font-semibold text-amber-700 hover:bg-amber-50"
                            >
                                Unpublish
                            </button>
                        )}
                    {folder.rename_url && (
                        <button
                            type="button"
                            onClick={() => {
                                setRenameValue(folder.name);
                                onOpenChange(false);
                                setRenameOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-stone-50"
                        >
                            Rename
                        </button>
                    )}
                    {folder.hierarchy_delete_url && (
                        <button
                            type="button"
                            onClick={openHierarchyDelete}
                            className="mt-1 block w-full border-t border-stone-100 px-3 py-2 text-left font-semibold text-red-700 hover:bg-red-50"
                        >
                            Delete entire hierarchy
                        </button>
                    )}
                    {folder.delete_url && (
                        <button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                setDeleteOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"
                        >
                            Delete empty folder
                        </button>
                    )}
                </div>
            )}
            {renameOpen && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
                    <form
                        onSubmit={submitRename}
                        className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"
                    >
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-arms-green">
                            ✎
                        </div>
                        <h3 className="mt-4 text-center text-xl font-semibold text-[#073d2f]">
                            Rename folder
                        </h3>
                        <p className="mt-1 text-center text-sm text-stone-500">
                            Spaces will automatically become underscores.
                            Windows-invalid characters are not allowed.
                        </p>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={(event) =>
                                setRenameValue(event.target.value)
                            }
                            className="mt-5 w-full rounded-xl border-stone-300"
                        />
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setRenameOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white">
                                Rename
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {deleteOpen && (
                <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">
                            !
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-[#073d2f]">
                            Delete folder?
                        </h3>
                        <p className="mt-2 text-sm text-stone-500">
                            Delete <strong>{folder.name}</strong>? Only empty
                            folders can be deleted.
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteOpen(false)}
                                className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={remove}
                                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {hierarchyOpen && (
                <HierarchyDeleteModal
                    folder={folder}
                    preview={preview}
                    loading={loadingPreview}
                    error={previewError}
                    confirmation={confirmation}
                    deleting={deletingHierarchy}
                    onConfirmationChange={setConfirmation}
                    onClose={() =>
                        !deletingHierarchy && setHierarchyOpen(false)
                    }
                    onDelete={destroyHierarchy}
                />
            )}
        </div>
    );
}

function HierarchyTree({
    node,
    depth = 0,
}: {
    node: HierarchyNode;
    depth?: number;
}) {
    return (
        <div style={{ paddingLeft: `${depth * 18}px` }}>
            <div className="flex items-center gap-2 py-1 font-medium text-[#073d2f]">
                <span>📁</span>
                <span className="break-all">{node.name}</span>
            </div>
            {node.folders.map((child) => (
                <HierarchyTree key={child.id} node={child} depth={depth + 1} />
            ))}
            {node.documents.map((document) => (
                <div
                    key={document.id}
                    style={{ paddingLeft: `${(depth + 1) * 18}px` }}
                    className="flex items-center gap-2 py-1 text-stone-600"
                >
                    <span>📄</span>
                    <span className="break-all">{document.name}</span>
                </div>
            ))}
        </div>
    );
}

function HierarchyDeleteModal({
    folder,
    preview,
    loading,
    error,
    confirmation,
    deleting,
    onConfirmationChange,
    onClose,
    onDelete,
}: {
    folder: Folder;
    preview: HierarchyPreview | null;
    loading: boolean;
    error: string;
    confirmation: string;
    deleting: boolean;
    onConfirmationChange: (value: string) => void;
    onClose: () => void;
    onDelete: () => void;
}) {
    const label = folder.depth === 0 ? 'Filename' : 'subfolder';
    return (
        <div
            className="fixed inset-0 z-[100] grid place-items-center bg-[#012a21]/65 p-4"
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="hierarchy-delete-title"
                className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                <header className="flex shrink-0 items-center justify-between bg-arms-green px-6 py-5 text-white">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#e8c25c]">
                            Level 4 action · irreversible
                        </p>
                        <h2
                            id="hierarchy-delete-title"
                            className="mt-1 text-xl font-semibold"
                        >
                            Delete entire {label}?
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close delete preview"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/40 text-xl hover:bg-white/10 disabled:opacity-50"
                    >
                        ×
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <p className="text-sm text-stone-700">
                        Review everything inside <strong>{folder.name}</strong>{' '}
                        before deleting. The preview is read-only; files and
                        folders cannot be selected or changed here.
                    </p>
                    {loading && (
                        <div className="mt-6 rounded-xl border border-stone-200 p-8 text-center text-sm text-stone-500">
                            Loading complete hierarchy…
                        </div>
                    )}
                    {error && (
                        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {preview && (
                        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                            <section className="rounded-xl border border-stone-200 p-4">
                                <h3 className="font-semibold text-[#073d2f]">
                                    Complete structure
                                </h3>
                                <div className="mt-3 max-h-[48vh] overflow-auto rounded-lg bg-stone-50 p-3 text-sm">
                                    <HierarchyTree node={preview.tree} />
                                </div>
                                <p className="mt-3 text-xs text-stone-500">
                                    Preview is read-only. No files can be
                                    selected or edited.
                                </p>
                            </section>
                            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                <h3 className="font-semibold text-[#073d2f]">
                                    Deletion impact
                                </h3>
                                <p className="mt-5 text-sm text-stone-700">
                                    📁{' '}
                                    <strong>
                                        {preview.counts.folders.toLocaleString()}
                                    </strong>{' '}
                                    folders
                                </p>
                                <p className="mt-3 text-sm text-stone-700">
                                    📄{' '}
                                    <strong>
                                        {preview.counts.documents.toLocaleString()}
                                    </strong>{' '}
                                    files
                                </p>
                                <p className="mt-6 border-t border-amber-200 pt-4 text-sm font-semibold text-red-700">
                                    This action cannot be undone.
                                </p>
                                <p className="mt-3 text-xs text-stone-600">
                                    All subfolders and documents shown in the
                                    preview will be deleted.
                                </p>
                            </aside>
                        </div>
                    )}
                    {preview && (
                        <label className="mt-6 block text-sm font-semibold text-stone-700">
                            Type{' '}
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[#073d2f]">
                                {folder.name}
                            </span>{' '}
                            to confirm
                            <input
                                autoFocus
                                value={confirmation}
                                onChange={(event) =>
                                    onConfirmationChange(event.target.value)
                                }
                                className="mt-2 w-full rounded-xl border-stone-300"
                                placeholder={
                                    'Type ' + folder.name + ' to confirm'
                                }
                            />
                        </label>
                    )}
                </div>
                <footer className="flex shrink-0 justify-end gap-3 border-t border-stone-100 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={
                            !preview || confirmation !== folder.name || deleting
                        }
                        onClick={onDelete}
                        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {deleting ? 'Deleting hierarchy…' : 'Delete ' + label}
                    </button>
                </footer>
            </div>
        </div>
    );
}
function PinnedSearchResults({
    page,
    onInformation,
}: {
    page: PinnedSearchPage | null;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
}) {
    const items = page?.data ?? [];
    if (!items.length)
        return (
            <div className="px-6 py-16 text-center">
                <ArmsIcon
                    name="pin"
                    className="mx-auto h-8 w-8 text-stone-300"
                />
                <h3 className="mt-4 text-lg font-semibold text-[#073d2f]">
                    No pinned items found
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                    Try another pinned keyword, for example “pin audit”.
                </p>
            </div>
        );
    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-100 text-left">
                    <thead className="bg-stone-50/80">
                        <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <th className="px-5 py-3.5 sm:px-6">Type</th>
                            <th className="px-5 py-3.5">Name</th>
                            <th className="px-5 py-3.5">Path</th>
                            <th className="hidden px-5 py-3.5 md:table-cell">
                                Last updated
                            </th>
                            <th className="w-24 px-5 py-3.5 text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {items.map((item) => (
                            <tr
                                key={item.pin_id}
                                className="hover:bg-emerald-50/40"
                            >
                                <td className="px-5 py-4 sm:px-6">
                                    <span className="inline-flex items-center gap-3 text-sm text-stone-600">
                                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-arms-green">
                                            {item.kind === 'folder' ? (
                                                <ArmsIcon
                                                    name="folder"
                                                    className="h-4 w-4"
                                                />
                                            ) : (
                                                <span className="text-[9px] font-extrabold leading-none tracking-tight text-arms-green">
                                                    {(
                                                        item.file_type || 'FILE'
                                                    ).slice(0, 4)}
                                                </span>
                                            )}
                                            <PinMarker pinned />
                                        </span>
                                        {item.type}
                                    </span>
                                </td>
                                <td className="px-5 py-4">
                                    <a
                                        href={item.href}
                                        className="font-semibold text-[#073d2f] hover:text-arms-green"
                                    >
                                        {item.name}
                                    </a>
                                </td>
                                <td className="max-w-lg px-5 py-4">
                                    <span className="block whitespace-normal break-words text-sm leading-5 text-stone-500 [overflow-wrap:anywhere]">
                                        {item.path}
                                    </span>
                                </td>
                                <td className="hidden px-5 py-4 text-sm text-stone-500 md:table-cell">
                                    {formatDate(item.updated_at)}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <PinnedResultActions
                                        item={item}
                                        onInformation={onInformation}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {page && page.last_page > 1 && (
                <footer className="flex items-center justify-between border-t border-stone-100 px-5 py-4 text-sm sm:px-6">
                    <span className="text-stone-500">
                        Page {page.current_page} of {page.last_page}
                    </span>
                    <div className="flex gap-2">
                        <PageButton url={page.prev_page_url} label="Previous" />
                        <PageButton url={page.next_page_url} label="Next" />
                    </div>
                </footer>
            )}
        </>
    );
}

function PinnedResultActions({
    item,
    onInformation,
}: {
    item: PinnedSearchItem;
    onInformation: (target: {
        name: string;
        url: string;
        kind: 'folder' | 'document';
    }) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative inline-block text-left">
            <button
                type="button"
                onClick={() => {
                    const nextOpen = !open;
                    if (nextOpen) notifyDropdownOpen('pinned-search-' + item.pin_id);
                    setOpen(nextOpen);
                }}
                className="rounded-lg px-2 py-1 text-lg text-stone-500 hover:bg-emerald-50"
            >
                ⋮
            </button>
            {open && (
                <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-stone-200 bg-white p-1 text-left text-xs shadow-xl">
                    <a
                        href={item.href}
                        className="block rounded-md px-2.5 py-2 hover:bg-stone-50"
                    >
                        Open
                    </a>
                    {item.information_url && (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onInformation({
                                    name: item.name,
                                    url: item.information_url!,
                                    kind: item.kind,
                                });
                            }}
                            className="block w-full rounded-md px-2.5 py-2 text-left text-arms-green hover:bg-emerald-50"
                        >
                            Information
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function PageButton({ url, label }: { url: string | null; label: string }) {
    return (
        <button
            type="button"
            disabled={!url}
            onClick={() => url && router.visit(url, { preserveScroll: true })}
            className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {label}
        </button>
    );
}
