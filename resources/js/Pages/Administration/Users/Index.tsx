import ArmsIcon from '@/Components/ArmsIcon';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type UserRow = {
    id: number;
    route_key: string;
    username: string;
    name: string;
    position?: string | null;
    subsidiary_id?: number | null;
    subsidiary?: string | null;
    department_id?: number | null;
    department?: string | null;
    role_id?: number | null;
    role?: string | null;
    role_slug?: string | null;
    status: string;
    account_status: string;
    allowed_upload: boolean;
    registered_at?: string | null;
    last_visit_at?: string | null;
    manageable: boolean;
};

type Role = { id:number; name:string; slug:string; level:number };
type Subsidiary = { id:number; name:string; departments:{id:number;name:string}[] };
type Paginator = { data:UserRow[]; current_page:number; last_page:number; total:number; prev_page_url:string|null; next_page_url:string|null; from:number|null; to:number|null };
type FolderAccess = { id:number; parent_id:number|null; name:string; depth:number; path:string };
type DocumentAccessItem = { id:number; folder_id:number; name:string; folder:string|null };

type Props = {
    users: Paginator;
    filters: { search:string; sort:string; direction:'asc'|'desc'; per_page:number };
    roles: Role[];
    subsidiaries: Subsidiary[];
    summary: { matching:number };
};

const dateTime = (value?: string | null) => value
    ? new Intl.DateTimeFormat('en-PH', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value))
    : '—';

function StatusPill({ status }: { status:string }) {
    const style = status === 'Online' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : status === 'Blocked' ? 'border-red-100 bg-red-50 text-red-700' : status === 'Forced logout' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-stone-200 bg-stone-100 text-stone-600';
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm ${style}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function ConfirmDialog({ title, message, confirmText, danger=false, onCancel, onConfirm }: { title:string; message:string; confirmText:string; danger?:boolean; onCancel:()=>void; onConfirm:()=>void }) {
    return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#012a21]/55 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-[22px] border border-white/60 bg-white p-7 text-center shadow-[0_24px_70px_rgba(1,42,33,0.28)]">
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full border text-2xl font-bold ${danger ? 'border-red-100 bg-red-50 text-red-600' : 'border-emerald-100 bg-emerald-50 text-arms-green'}`}>{danger ? '!' : '✓'}</div>
            <h3 className="mt-4 text-xl font-semibold text-[#073d2f]">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">{message}</p>
            <div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50">Cancel</button><button type="button" onClick={onConfirm} className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-arms-green hover:bg-arms-dark'}`}>{confirmText}</button></div>
        </div>
    </div>;
}

export default function Index({ users, filters, roles, subsidiaries, summary }: Props) {
    const [selected, setSelected] = useState<number[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [uploaderOpen, setUploaderOpen] = useState(false);
    const [accessOpen, setAccessOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'logout'|'block'|'delete'|null>(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const [accessFolders, setAccessFolders] = useState<FolderAccess[]>([]);
    const [accessSelected, setAccessSelected] = useState<number[]>([]);
    const [accessDocuments, setAccessDocuments] = useState<DocumentAccessItem[]>([]);
    const [accessDocumentSelected, setAccessDocumentSelected] = useState<number[]>([]);
    const [accessLoading, setAccessLoading] = useState(false);

    const selectedUser = useMemo(() => users.data.find((item) => item.id === selected[0]) ?? null, [selected, users.data]);
    const allSelected = users.data.length > 0 && users.data.every((item) => selected.includes(item.id));

    const createForm = useForm({ name:'', username:'', password:'', subsidiary_id:'', department_id:'', role_id:'', allowed_upload:false });
    const editForm = useForm({ name:'', username:'', password:'', subsidiary_id:'', department_id:'', role_id:'' });
    const viewerForm = useForm({ viewer_level: 1 });
    const uploaderForm = useForm({ allowed_upload: false });

    const createDepartments = subsidiaries.find((item) => String(item.id) === createForm.data.subsidiary_id)?.departments ?? [];
    const editDepartments = subsidiaries.find((item) => String(item.id) === editForm.data.subsidiary_id)?.departments ?? [];

    const table = (changes: Record<string,string|number>) => router.get(route('users.index'), { ...filters, ...changes }, { preserveState:true, preserveScroll:true, replace:true });
    const sortBy = (sort:string) => table({ sort, direction: filters.sort === sort && filters.direction === 'asc' ? 'desc' : 'asc' });

    const openEditFor = (user: UserRow | null) => {
        if (!user?.manageable) return;
        setSelected([user.id]);
        editForm.clearErrors();
        editForm.setData({
            name:user.name,
            username:user.username,
            password:'',
            subsidiary_id:String(user.subsidiary_id ?? ''),
            department_id:String(user.department_id ?? ''),
            role_id:String(user.role_id ?? ''),
        });
        setEditOpen(true);
    };
    const openEdit = () => openEditFor(selectedUser);

    const submitCreate = (event:FormEvent) => {
        event.preventDefault();
        createForm.post(route('users.store'), { preserveScroll:true, onSuccess:() => { setCreateOpen(false); createForm.reset(); } });
    };
    const submitEdit = (event:FormEvent) => {
        event.preventDefault(); if (!selectedUser) return;
        editForm.patch(route('users.update', selectedUser.route_key), { preserveScroll:true, onSuccess:() => setEditOpen(false) });
    };
    const runConfirm = () => {
        if (!selectedUser || !confirmAction) return;
        const options = { preserveScroll:true, onSuccess:() => { setConfirmAction(null); setSelected([]); } };
        if (confirmAction === 'logout') router.post(route('users.force-logout', selectedUser.route_key), {}, options);
        if (confirmAction === 'block') router.patch(route('users.block', selectedUser.route_key), {}, options);
        if (confirmAction === 'delete') router.delete(route('users.destroy', selectedUser.route_key), options);
    };
    const submitViewer = (event:FormEvent) => { event.preventDefault(); if (!selectedUser) return; viewerForm.patch(route('users.viewer', selectedUser.route_key), { preserveScroll:true, onSuccess:() => setViewerOpen(false) }); };
    const submitUploader = (event:FormEvent) => { event.preventDefault(); if (!selectedUser) return; uploaderForm.patch(route('users.uploader', selectedUser.route_key), { preserveScroll:true, onSuccess:() => setUploaderOpen(false) }); };

    const openAccessFor = async (user: UserRow | null) => {
        if (!user?.manageable) return;
        setSelected([user.id]);
        setAccessOpen(true); setAccessLoading(true);
        try {
            const response = await fetch(route('users.access.data', user.route_key), { headers:{ Accept:'application/json' } });
            if (!response.ok) throw new Error('Unable to load access.');
            const payload = await response.json();
            setAccessFolders(payload.folders ?? []); setAccessSelected(payload.selected ?? []); setAccessDocuments(payload.documents ?? []); setAccessDocumentSelected(payload.selected_documents ?? []);
        } finally { setAccessLoading(false); }
    };
    const openAccess = () => openAccessFor(selectedUser);
    const saveAccess = () => {
        if (!selectedUser) return;
        router.patch(route('users.access.update', selectedUser.route_key), { folder_ids:accessSelected, document_ids:accessDocumentSelected }, { preserveScroll:true, onSuccess:() => setAccessOpen(false) });
    };

    const manageableSelected = selected.length === 1 && !!selectedUser?.manageable;
    const selectionMessage = selected.length === 0
        ? 'No records selected'
        : selected.length > 1
            ? `${selected.length} users selected — select only one user to use account actions`
            : selectedUser?.manageable
                ? `${selectedUser.name} selected`
                : `${selectedUser?.name ?? 'User'} selected — this account is protected from management actions`;

    return <AuthenticatedLayout breadcrumb="A.R.M.S" title="Users">
        <Head title="Users" />
        <section className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
            <div className="overflow-hidden rounded-[22px] border border-stone-200/90 bg-white shadow-[0_18px_50px_rgba(3,59,45,0.07)]">
                <div className="flex flex-wrap items-center justify-between gap-5 border-b border-stone-100 bg-gradient-to-r from-white via-white to-emerald-50/40 px-5 py-5 sm:px-7">
                    <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-arms-green-light">Users directory</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#073d2f]">Manage users</h2><p className="mt-1 text-sm text-stone-500">Create accounts, assign access, and manage user permissions.</p></div>
                    <form onSubmit={(e) => { e.preventDefault(); table({ search, page:1 }); }} className="flex w-full max-w-lg gap-2"><div className="relative flex-1"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username, name, department..." className="h-11 w-full rounded-xl border-stone-300 bg-white pl-10 pr-3 text-sm shadow-sm transition focus:border-[#0b8a64] focus:ring-[#0b8a64]" /></div><button className="rounded-xl bg-arms-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-arms-dark">Search</button></form>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-[#fcfdfc] px-5 py-3.5 sm:px-7">
                    <button onClick={() => { createForm.clearErrors(); createForm.reset(); setCreateOpen(true); }} className="rounded-xl bg-arms-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-arms-dark">+ New user</button>
                    <div className="relative">
                        <button disabled={!manageableSelected} onClick={() => setEditMenuOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">✎ Edit <span className="text-xs">▾</span></button>
                        {editMenuOpen && manageableSelected && <div className="absolute left-0 top-12 z-40 w-48 rounded-xl border border-stone-200 bg-white p-1.5 shadow-2xl">
                            <button type="button" onClick={() => { setEditMenuOpen(false); openEdit(); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"><span className="block text-sm font-semibold text-[#073d2f]">Edit Info</span><span className="block text-xs text-stone-500">Account and profile details</span></button>
                            <button type="button" onClick={() => { setEditMenuOpen(false); openAccess(); }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50"><span className="block text-sm font-semibold text-[#073d2f]">Edit Access</span><span className="block text-xs text-stone-500">Files and related folders</span></button>
                        </div>}
                    </div>
                    <button disabled={!manageableSelected || selectedUser?.status !== 'Online'} onClick={() => setConfirmAction('logout')} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">⇥ Logout</button>
                    <button disabled={!manageableSelected} onClick={() => setConfirmAction('delete')} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40">♜ Delete</button>
                    <button disabled={!manageableSelected} onClick={() => setConfirmAction('block')} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">▣ {selectedUser?.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                    <button disabled={!manageableSelected} onClick={() => { viewerForm.setData('viewer_level', selectedUser?.role_slug === 'viewer' ? 1 : 2); setViewerOpen(true); }} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">◉ Viewer</button>
                    <button disabled={!manageableSelected} onClick={() => { uploaderForm.setData('allowed_upload', !!selectedUser?.allowed_upload); setUploaderOpen(true); }} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold disabled:opacity-40">⇧ Uploader</button>
                    {manageableSelected && <a href={route('users.export', selectedUser!.route_key)} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold">⇩ Export</a>}
                    <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-medium ${selected.length === 1 && !selectedUser?.manageable ? 'bg-amber-50 text-amber-700' : selected.length ? 'bg-emerald-50 text-arms-green' : 'bg-stone-100 text-stone-500'}`}>{selectionMessage}</span>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 text-sm sm:px-7"><span className="font-medium text-stone-500"><span className="font-semibold text-[#073d2f]">{summary.matching}</span> matching users</span><label className="flex items-center gap-2 text-stone-500">Show <select value={filters.per_page} onChange={(e) => table({ per_page:Number(e.target.value), page:1 })} className="rounded-lg border-stone-300 bg-white py-1.5 text-sm shadow-sm focus:border-[#0b8a64] focus:ring-[#0b8a64]">{[10,25,50,100].map(v => <option key={v}>{v}</option>)}</select> entries</label></div>

                <div className="max-h-[64vh] overflow-auto"><table className="min-w-[1280px] w-full text-left text-sm"><thead className="sticky top-0 z-20 bg-stone-50/95 text-[11px] uppercase tracking-[0.08em] text-stone-500 backdrop-blur"><tr>
                    <th className="w-12 px-5 py-4"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? users.data.map(u => u.id) : [])} /></th>
                    <th className="px-4 py-4"><button onClick={() => sortBy('employee_id')}>Username ↕</button></th><th className="px-4 py-4"><button onClick={() => sortBy('name')}>Name ↕</button></th><th className="px-4 py-4">Subsidiary</th><th className="px-4 py-4">Department</th><th className="px-4 py-4">User level</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Uploader</th><th className="px-4 py-4">Registered date</th><th className="px-4 py-4">Last visit date</th><th className="w-16 px-4 py-4 text-center">Actions</th>
                </tr></thead><tbody className="divide-y divide-stone-100">{users.data.map(user => <tr key={user.id} onClick={() => setSelected(prev => prev.length === 1 && prev[0] === user.id ? [] : [user.id])} className={`cursor-pointer transition-colors ${selected.includes(user.id) ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200' : 'bg-white hover:bg-emerald-50/35'}`}>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(user.id)} onChange={(e) => setSelected(e.target.checked ? [user.id] : [])} /></td>
                    <td className="px-4 py-4 font-semibold text-arms-green">{user.username}</td><td className="px-4 py-4 font-semibold text-[#073d2f]">{user.name}</td><td className="px-4 py-4 text-stone-600">{user.subsidiary ?? '—'}</td><td className="px-4 py-4 text-stone-600">{user.department ?? '—'}</td><td className="px-4 py-4 text-stone-600">{user.role ?? '—'}</td><td className="px-4 py-4"><StatusPill status={user.status} /></td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.allowed_upload ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{user.allowed_upload ? 'Yes' : 'No'}</span></td><td className="px-4 py-4 text-stone-600">{dateTime(user.registered_at)}</td><td className="px-4 py-4 text-stone-600">{dateTime(user.last_visit_at)}</td><td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}><UserActions user={user} onEdit={openEditFor} onAccess={openAccessFor} onViewer={(target) => { setSelected([target.id]); viewerForm.setData('viewer_level', target.role_slug === 'viewer' ? 1 : 2); setViewerOpen(true); }} onUploader={(target) => { setSelected([target.id]); uploaderForm.setData('allowed_upload', !!target.allowed_upload); setUploaderOpen(true); }} onConfirm={(target, action) => { setSelected([target.id]); setConfirmAction(action); }} /></td>
                </tr>)}</tbody></table></div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 text-sm sm:px-7"><span className="text-stone-500">Showing {users.from ?? 0} to {users.to ?? 0} of {users.total}</span><div className="flex gap-2"><button disabled={!users.prev_page_url} onClick={() => users.prev_page_url && router.visit(users.prev_page_url, { preserveScroll:true })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-arms-green">{users.current_page} / {users.last_page}</span><button disabled={!users.next_page_url} onClick={() => users.next_page_url && router.visit(users.next_page_url, { preserveScroll:true })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></div>
            </div>
        </section>

        {createOpen && <UserFormModal title="New user" submitLabel="Create user" form={createForm} departments={createDepartments} subsidiaries={subsidiaries} roles={roles} onClose={() => setCreateOpen(false)} onSubmit={submitCreate} create />}
        {editOpen && <UserFormModal title="Edit user" submitLabel="Save changes" form={editForm} departments={editDepartments} subsidiaries={subsidiaries} roles={roles} onClose={() => setEditOpen(false)} onSubmit={submitEdit} />}

        {viewerOpen && selectedUser && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#012a21]/50 p-4"><form onSubmit={submitViewer} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-[#073d2f]">Viewer level</h3><p className="mt-1 text-sm text-stone-500">Assign the legacy viewer level for {selectedUser.name}.</p><select value={viewerForm.data.viewer_level} onChange={(e) => viewerForm.setData('viewer_level', Number(e.target.value))} className="mt-5 w-full rounded-xl border-stone-300"><option value={1}>Level 1 — View only</option><option value={2}>Level 2 — View and download</option></select><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setViewerOpen(false)} className="rounded-xl border px-4 py-2">Cancel</button><button className="rounded-xl bg-arms-green px-5 py-2 font-semibold text-white">Save</button></div></form></div>}
        {uploaderOpen && selectedUser && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#012a21]/50 p-4"><form onSubmit={submitUploader} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-[#073d2f]">Uploader permission</h3><p className="mt-1 text-sm text-stone-500">Enable or disable upload permission for {selectedUser.name}.</p><select value={uploaderForm.data.allowed_upload ? '1':'0'} onChange={(e) => uploaderForm.setData('allowed_upload', e.target.value === '1')} className="mt-5 w-full rounded-xl border-stone-300"><option value="0">No</option><option value="1">Yes</option></select><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setUploaderOpen(false)} className="rounded-xl border px-4 py-2">Cancel</button><button className="rounded-xl bg-arms-green px-5 py-2 font-semibold text-white hover:bg-arms-dark">Save</button></div></form></div>}

        {accessOpen && selectedUser && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#012a21]/55 p-4"><div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-arms-green">User permissions</p><h3 className="text-xl font-semibold text-[#073d2f]">Edit Access — {selectedUser.name}</h3></div><button onClick={() => setAccessOpen(false)} className="text-2xl">×</button></header><div className="min-h-0 flex-1 overflow-y-auto p-6">{accessLoading ? <p className="py-16 text-center text-stone-500">Preparing file access…</p> : <div className="grid gap-6 lg:grid-cols-2"><section><div className="mb-3"><h4 className="font-semibold text-[#073d2f]">Folder access</h4><p className="text-xs text-stone-500">Grant access to a folder path.</p></div><div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-xl border border-stone-200 p-2">{accessFolders.map(folder => <label key={folder.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-emerald-50" style={{ paddingLeft: `${12 + folder.depth*18}px` }}><input type="checkbox" checked={accessSelected.includes(folder.id)} onChange={(e) => setAccessSelected(prev => e.target.checked ? [...prev,folder.id] : prev.filter(id => id !== folder.id))} /><ArmsIcon name="folder" className="h-4 w-4 text-arms-green" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{folder.name}</span><span className="block truncate text-[11px] text-stone-400">{folder.path}</span></span></label>)}</div></section><section><div className="mb-3"><h4 className="font-semibold text-[#073d2f]">Individual file access</h4><p className="text-xs text-stone-500">Pick specific files this user may open.</p></div><div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-xl border border-stone-200 p-2">{accessDocuments.map(document => <label key={document.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-emerald-50"><input type="checkbox" checked={accessDocumentSelected.includes(document.id)} onChange={(e) => setAccessDocumentSelected(prev => e.target.checked ? [...prev,document.id] : prev.filter(id => id !== document.id))} /><ArmsIcon name="document" className="h-4 w-4 text-arms-green" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{document.name}</span><span className="block truncate text-[11px] text-stone-400">{document.folder ?? 'Root'}</span></span></label>)}</div></section></div>}</div><footer className="flex items-center justify-between border-t px-6 py-4"><span className="text-sm text-stone-500">{accessSelected.length} folders · {accessDocumentSelected.length} files selected</span><div className="flex gap-3"><button onClick={() => setAccessOpen(false)} className="rounded-xl border px-4 py-2">Cancel</button><button onClick={saveAccess} className="rounded-xl bg-arms-green px-5 py-2 font-semibold text-white hover:bg-arms-dark">Save access</button></div></footer></div></div>}

        {confirmAction && selectedUser && <ConfirmDialog danger={confirmAction === 'delete' || confirmAction === 'block'} title={confirmAction === 'delete' ? 'Delete user?' : confirmAction === 'logout' ? 'Force logout?' : selectedUser.status === 'Blocked' ? 'Unblock user?' : 'Block user?'} message={confirmAction === 'delete' ? `Delete ${selectedUser.name}? This follows the protected-account rule.` : confirmAction === 'logout' ? `End all active sessions for ${selectedUser.name}?` : selectedUser.status === 'Blocked' ? `Restore login access for ${selectedUser.name}?` : `Block ${selectedUser.name} and end active sessions?`} confirmText={confirmAction === 'delete' ? 'Delete user' : confirmAction === 'logout' ? 'Logout user' : selectedUser.status === 'Blocked' ? 'Unblock' : 'Block'} onCancel={() => setConfirmAction(null)} onConfirm={runConfirm} />}
    </AuthenticatedLayout>;
}

function UserActions({ user, onEdit, onAccess, onViewer, onUploader, onConfirm }: { user:UserRow; onEdit:(user:UserRow)=>void; onAccess:(user:UserRow)=>void; onViewer:(user:UserRow)=>void; onUploader:(user:UserRow)=>void; onConfirm:(user:UserRow, action:'logout'|'block'|'delete')=>void }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top:0, left:0 });
    const toggle = (event:React.MouseEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top:rect.bottom + 6, left:Math.max(12, rect.right - 224) });
        setOpen((value) => !value);
    };
    const run = (callback:()=>void) => { setOpen(false); callback(); };
    return <div className="inline-block text-left">
        <button type="button" onClick={toggle} aria-label={`Actions for ${user.name}`} className={`grid h-9 w-9 place-items-center rounded-full border text-lg leading-none transition ${open ? 'border-emerald-200 bg-emerald-100 text-[#073d2f]' : 'border-transparent text-stone-500 hover:border-stone-200 hover:bg-white hover:text-[#073d2f]'}`}>⋮</button>
        {open && <div className="fixed z-[120] w-60 rounded-2xl border border-stone-200 bg-white p-2 text-sm text-stone-700 shadow-[0_18px_50px_rgba(1,42,33,0.18)]" style={{ top:position.top, left:position.left }}>
            {user.manageable ? <>
                <button type="button" onClick={() => run(() => onEdit(user))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">✎ Edit user</button>
                <button type="button" onClick={() => run(() => onAccess(user))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">🔒 Edit access</button>
                <button type="button" onClick={() => run(() => onViewer(user))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">◉ Viewer level</button>
                <button type="button" onClick={() => run(() => onUploader(user))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">⇧ Uploader permission</button>
                {user.status === 'Online' && <button type="button" onClick={() => run(() => onConfirm(user,'logout'))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">⇥ Force logout</button>}
                <button type="button" onClick={() => run(() => onConfirm(user,'block'))} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50">▣ {user.status === 'Blocked' ? 'Unblock user' : 'Block user'}</button>
                <a href={route('users.export', user.route_key)} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 hover:bg-stone-50">⇩ Export access</a>
                <button type="button" onClick={() => run(() => onConfirm(user,'delete'))} className="mt-1 block w-full border-t border-stone-100 px-3 py-2.5 text-left text-red-700 hover:bg-red-50">♜ Delete user</button>
            </> : <div className="px-3 py-3 text-xs leading-5 text-stone-500">This account is protected and cannot be managed by the current user.</div>}
        </div>}
    </div>;
}

function UserFormModal({ title, submitLabel, form, subsidiaries, departments, roles, onClose, onSubmit, create=false }: any) {
    const generate = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
        let value = ''; for (let i=0;i<10;i++) value += chars[Math.floor(Math.random()*chars.length)];
        form.setData('password', value);
    };
    const control = 'w-full rounded-xl border-stone-300 bg-white shadow-sm transition focus:border-[#0b8a64] focus:ring-[#0b8a64]';
    return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#012a21]/55 p-4 backdrop-blur-[2px]"><form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-white/60 bg-white shadow-[0_24px_70px_rgba(1,42,33,0.25)]"><div className="flex items-start justify-between border-b border-stone-100 bg-gradient-to-r from-white to-emerald-50/50 px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-arms-green">Users module</p><h3 className="mt-1 text-xl font-semibold text-[#073d2f]">{title}</h3><p className="mt-1 text-sm text-stone-500">{create ? 'Create a new authorized RMS account.' : 'Update account information and assignment.'}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-800">×</button></div><div className="grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Complete name" error={form.errors.name}><input value={form.data.name} onChange={(e) => form.setData('name',e.target.value)} className={control} /></Field>
        <Field label="Username" error={form.errors.username}><input value={form.data.username} onChange={(e) => form.setData('username',e.target.value)} className={control} /></Field>
        <Field label={create ? 'Password' : 'New password (optional)'} error={form.errors.password}><div className="flex gap-2"><input type="text" value={form.data.password} onChange={(e) => form.setData('password',e.target.value)} className={`min-w-0 flex-1 ${control}`} /><button type="button" onClick={generate} className="rounded-xl border border-stone-300 bg-stone-50 px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-100">Generate</button></div></Field>
        <Field label="User level" error={form.errors.role_id}><select value={form.data.role_id} onChange={(e) => form.setData('role_id',e.target.value)} className={control}><option value="">Select user level</option>{roles.map((role:Role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
        <Field label="Subsidiary" error={form.errors.subsidiary_id}><select value={form.data.subsidiary_id} onChange={(e) => { form.setData('subsidiary_id',e.target.value); form.setData('department_id',''); }} className={control}><option value="">Select subsidiary</option>{subsidiaries.map((item:Subsidiary) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Department" error={form.errors.department_id}><select disabled={!form.data.subsidiary_id} value={form.data.department_id} onChange={(e) => form.setData('department_id',e.target.value)} className={`${control} disabled:bg-stone-100 disabled:text-stone-400`}><option value="">Select department</option>{departments.map((item:any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {create && <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700"><input type="checkbox" checked={form.data.allowed_upload} onChange={(e) => form.setData('allowed_upload',e.target.checked)} className="rounded border-stone-300 text-arms-green focus:ring-arms-green" /> Allow uploader permission</label>}
    </div><div className="flex justify-end gap-3 border-t border-stone-100 bg-stone-50/70 px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50">Cancel</button><button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-arms-dark disabled:cursor-not-allowed disabled:opacity-50">{form.processing ? 'Saving…' : submitLabel}</button></div></form></div>;
}

function Field({ label, error, children }: { label:string; error?:string; children:any }) { return <label className="block text-sm font-medium text-stone-700"><span className="flex items-center gap-1">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1.5 block text-xs font-medium text-red-700">{error}</span>}</label>; }
