import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Subsidiary {
    id: number;
    name: string;
    status: string;
    dependency_counts: { departments: number; users: number; folders: number };
}

interface PageProps {
    subsidiaries: { data: Subsidiary[]; links: { url: string | null; label: string; active: boolean }[]; from: number | null; to: number | null; total: number };
    filters: { search: string; sort: 'id' | 'name'; order: 'asc' | 'desc'; per_page: number };
}

export default function Subsidiaries({ subsidiaries, filters }: PageProps) {
    const [editing, setEditing] = useState<Subsidiary | null>(null);
    const [deleting, setDeleting] = useState<Subsidiary | null>(null);
    const [showForm, setShowForm] = useState(false);
    const form = useForm({ name: '' });

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (editing) {
            form.patch(route('administration.subsidiaries.update', editing.id), { onSuccess: closeForm });
            return;
        }
        form.post(route('administration.subsidiaries.store'), { onSuccess: closeForm });
    };

    const updateFilters = (changes: Record<string, string | number>) => {
        router.get(route('administration.subsidiaries.index'), { ...filters, ...changes, page: 1 }, { preserveState: true, replace: true });
    };

    const toggleSort = (sort: 'id' | 'name') => updateFilters({ sort, order: filters.sort === sort && filters.order === 'asc' ? 'desc' : 'asc' });

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Subsidiaries">
            <Head title="Subsidiaries" />
            <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div><p className="text-sm text-stone-600">Manage the organization subsidiaries used by the records system.</p></div>
                    <button type="button" onClick={() => { form.reset(); setShowForm(true); }} className="rounded-xl bg-[#08613f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#033b2d]">New Subsidiary</button>
                </div>
                <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input aria-label="Search subsidiaries" defaultValue={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Search subsidiaries" className="w-full rounded-xl border-stone-300 text-sm focus:border-[#08613f] focus:ring-[#08613f] sm:max-w-xs" />
                        <select aria-label="Records per page" value={filters.per_page} onChange={(event) => updateFilters({ per_page: Number(event.target.value) })} className="rounded-xl border-stone-300 text-sm focus:border-[#08613f] focus:ring-[#08613f]"><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option><option value="100">100 per page</option></select>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-stone-200 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-3 py-3"><button onClick={() => toggleSort('id')}>ID</button></th><th className="px-3 py-3"><button onClick={() => toggleSort('name')}>Subsidiary</button></th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Departments</th><th className="px-3 py-3">Users</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{subsidiaries.data.map((item) => <tr key={item.id} className="border-b border-stone-100"><td className="px-3 py-4">{item.id}</td><td className="px-3 py-4 font-semibold text-[#073d2f]">{item.name}</td><td className="px-3 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#08613f]">{item.status}</span></td><td className="px-3 py-4">{item.dependency_counts.departments}</td><td className="px-3 py-4">{item.dependency_counts.users}</td><td className="px-3 py-4"><button onClick={() => { setEditing(item); form.setData('name', item.name); setShowForm(true); }} className="mr-4 font-semibold text-[#08613f]">Edit</button><button onClick={() => setDeleting(item)} className="font-semibold text-red-700">Delete</button></td></tr>)}</tbody></table></div>
                    {subsidiaries.data.length === 0 && <p className="py-10 text-center text-stone-500">No subsidiaries found.</p>}
                    <div className="mt-5 flex flex-wrap gap-2">{subsidiaries.links.map((link, index) => <button key={index} disabled={!link.url} onClick={() => link.url && router.visit(link.url)} className={`rounded-lg px-3 py-2 text-sm ${link.active ? 'bg-[#033b2d] text-white' : 'border border-stone-200 text-stone-700'}`} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>
                </div>
            </section>
            <Modal show={showForm} onClose={closeForm} maxWidth="md"><form onSubmit={submit} className="p-6"><h2 className="font-serif text-2xl text-[#073d2f]">{editing ? 'Edit Subsidiary' : 'New Subsidiary'}</h2><label className="mt-5 block text-sm font-semibold">Subsidiary name <span className="text-red-700">*</span><input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="mt-2 block w-full rounded-xl border-stone-300 focus:border-[#08613f] focus:ring-[#08613f]" autoFocus /></label><InputError message={form.errors.name} className="mt-2" /><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={form.processing} className="rounded-xl bg-[#08613f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{form.processing ? 'Saving…' : editing ? 'Update' : 'Save'}</button></div></form></Modal>
            <Modal show={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="md"><div className="p-6"><h2 className="font-serif text-2xl text-[#073d2f]">Delete subsidiary</h2><p className="mt-3 text-stone-600">Delete <strong>{deleting?.name}</strong>? This action is available only when it has no related records.</p><dl className="mt-5 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-lg bg-stone-50 p-3"><dt>Departments</dt><dd className="mt-1 font-semibold">{deleting?.dependency_counts.departments}</dd></div><div className="rounded-lg bg-stone-50 p-3"><dt>Users</dt><dd className="mt-1 font-semibold">{deleting?.dependency_counts.users}</dd></div><div className="rounded-lg bg-stone-50 p-3"><dt>Folders</dt><dd className="mt-1 font-semibold">{deleting?.dependency_counts.folders}</dd></div></dl><div className="mt-7 flex justify-end gap-3"><button onClick={() => setDeleting(null)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={!deleting || Object.values(deleting.dependency_counts).some(Boolean)} onClick={() => deleting && router.delete(route('administration.subsidiaries.destroy', deleting.id), { onSuccess: () => setDeleting(null) })} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Delete</button></div></div></Modal>
        </AuthenticatedLayout>
    );
}
