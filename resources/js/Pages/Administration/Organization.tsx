import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, ReactNode, useState } from 'react';

interface Location { id: number; code?: string | null; name: string; department_id?: number | null; }
interface Department { id: number; code?: string | null; name: string; locations: Location[]; }
interface Group { id: number; code?: string | null; name: string; locations: Location[]; }
interface Subdivision { id: number; code?: string | null; name: string; departments: Department[]; locations: Location[]; groups: Group[]; children: Subdivision[]; }
interface Division { id: number; code?: string | null; name: string; subdivisions: Subdivision[]; }
interface Subsidiary { id: number; route_key: string; name: string; status: string; divisions: Division[]; }
interface PageProps { subsidiaries: Subsidiary[]; }

type FormType = 'subsidiary' | 'division' | 'subdivision' | 'department' | 'location' | 'group';
type FormData = {
    subsidiary_id: number | '';
    division_id: number | '';
    parent_id: number | '';
    subdivision_id: number | '';
    department_id: number | '';
    name: string;
    code: string;
    location_ids: number[];
};

function flatten(items: Subdivision[], depth = 0): Array<Subdivision & { depth: number }> {
    return items.flatMap((item) => [{ ...item, depth }, ...flatten(item.children, depth + 1)]);
}

function findSubdivision(items: Subdivision[], id: number): Subdivision | null {
    for (const item of items) {
        if (item.id === id) return item;
        const child = findSubdivision(item.children, id);
        if (child) return child;
    }
    return null;
}

function ActionMenu({ children }: { children: ReactNode }) {
    return (
        <details className="relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-stone-300 bg-stone-100 px-2 py-1 text-2xl font-bold leading-none text-stone-700 shadow-sm transition hover:bg-emerald-50 hover:text-[#073d2f] hover:border-emerald-300 [&::-webkit-details-marker]:hidden">
                ⋮
            </summary>
            <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                {children}
            </div>
        </details>
    );
}

function ActionItem({ onClick, children, danger = false }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={danger ? "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50" : "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-[#073d2f]"}
        >
            {children}
        </button>
    );
}

function SubdivisionNode({ subdivision, divisionId, openForm, openEdit, removeItem, depth = 0 }: {
    subdivision: Subdivision;
    divisionId: number;
    openForm: (type: FormType, context?: Partial<FormData>) => void;
    openEdit: (type: FormType, item: any) => void;
    removeItem: (type: FormType, id: number | string) => void;
    depth?: number;
}) {
    return (
        <div className={depth ? 'mt-4 ml-5 border-l border-stone-200 pl-5' : 'mt-4'}>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">Sub-Division</p><h3 className="mt-1 text-base font-bold text-stone-800">{subdivision.name}</h3></div>
                    <ActionMenu>
                        <ActionItem onClick={() => openEdit('subdivision', subdivision)}>Edit</ActionItem>
                        <ActionItem onClick={() => removeItem('subdivision', subdivision.id)} danger>Delete</ActionItem>
                        <ActionItem onClick={() => openForm('subdivision', { division_id: divisionId, parent_id: subdivision.id })}>+ Sub-Division</ActionItem>
                        <ActionItem onClick={() => openForm('department', { subdivision_id: subdivision.id })}>+ Department</ActionItem>
                        <ActionItem onClick={() => openForm('location', { subdivision_id: subdivision.id })}>+ Location</ActionItem>
                        <ActionItem onClick={() => openForm('group', { subdivision_id: subdivision.id })}>+ Group Consolidated FS</ActionItem>
                    </ActionMenu>
                </div>

                {subdivision.departments.map((department) => <div key={department.id} className="mt-4 rounded-lg border border-emerald-100 bg-white p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-arms-green">Department</p><p className="mt-1 text-sm font-bold text-stone-800">{department.name}</p></div><ActionMenu><ActionItem onClick={() => openEdit('department', { ...department, subdivision_id: subdivision.id })}>Edit</ActionItem><ActionItem onClick={() => removeItem('department', department.id)} danger>Delete</ActionItem><ActionItem onClick={() => openForm('location', { subdivision_id: subdivision.id, department_id: department.id })}>+ Location</ActionItem></ActionMenu></div>{department.locations.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{department.locations.map((location) => <div key={location.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700"><span>{location.name}</span><ActionMenu><ActionItem onClick={() => openEdit('location', { ...location, subdivision_id: subdivision.id, department_id: department.id })}>Edit</ActionItem><ActionItem onClick={() => removeItem('location', location.id)} danger>Delete</ActionItem></ActionMenu></div>)}</div>}</div>)}

                {subdivision.locations.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Unassigned Location</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{subdivision.locations.map((location) => <div key={location.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700"><span>{location.name}</span><ActionMenu><ActionItem onClick={() => openEdit('location', { ...location, subdivision_id: subdivision.id })}>Edit</ActionItem><ActionItem onClick={() => removeItem('location', location.id)} danger>Delete</ActionItem></ActionMenu></div>)}</div></div>}

                {subdivision.groups.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-arms-green">Group Consolidated FS</p><div className="grid gap-3 md:grid-cols-2">{subdivision.groups.map((group) => <div key={group.id} className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{group.name}</p><ActionMenu><ActionItem onClick={() => openEdit('group', { ...group, subdivision_id: subdivision.id, location_ids: group.locations.map((location) => location.id) })}>Edit</ActionItem><ActionItem onClick={() => removeItem('group', group.id)} danger>Delete</ActionItem></ActionMenu></div><div className="mt-2 flex flex-wrap gap-1.5">{group.locations.map((location) => <span key={location.id} className="rounded-full bg-white px-2.5 py-1 text-xs text-stone-600">{location.name}</span>)}</div></div>)}</div></div>}

                {subdivision.children.map((child) => <SubdivisionNode key={child.id} subdivision={child} divisionId={divisionId} openForm={openForm} openEdit={openEdit} removeItem={removeItem} depth={depth + 1} />)}
            </div>
        </div>
    );
}

export default function Organization({ subsidiaries }: PageProps) {
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState<FormType>('subsidiary');
    const form = useForm<FormData>({ subsidiary_id: '', division_id: '', parent_id: '', subdivision_id: '', department_id: '', name: '', code: '', location_ids: [] });
    const [editing, setEditing] = useState<{ type: FormType; id: number | string } | null>(null);

    const openForm = (type: FormType, context: Partial<FormData> = {}) => {
        form.reset();
        form.clearErrors();
        setEditing(null);
        setFormType(type);
        form.setData({
            subsidiary_id: context.subsidiary_id ?? '',
            division_id: context.division_id ?? '',
            parent_id: context.parent_id ?? '',
            subdivision_id: context.subdivision_id ?? '',
            department_id: context.department_id ?? '',
            name: '',
            code: '',
            location_ids: [],
        });
        setShowForm(true);
    };

    const openEdit = (type: FormType, item: any) => {
        form.clearErrors();
        setFormType(type);
        setEditing({ type, id: item.id });
        form.setData({
            subsidiary_id: item.subsidiary_id ?? '',
            division_id: item.division_id ?? '',
            parent_id: item.parent_id ?? '',
            subdivision_id: item.subdivision_id ?? '',
            department_id: item.department_id ?? '',
            name: item.name ?? '',
            code: item.code ?? '',
            location_ids: item.location_ids ?? item.locations?.map((location: Location) => location.id) ?? [],
        });
        setShowForm(true);
    };

    const removeItem = (type: FormType, id: number | string) => {
        if (!window.confirm(`Delete this ${type === 'group' ? 'Group Consolidated FS' : type}?`)) return;
        const routeName: Record<FormType, string> = {
            subsidiary: 'administration.subsidiaries.destroy',
            department: 'administration.organization.departments.destroy',
            division: 'administration.organization.divisions.destroy',
            subdivision: 'administration.organization.subdivisions.destroy',
            location: 'administration.organization.locations.destroy',
            group: 'administration.organization.groups.destroy',
        };
        router.delete(route(routeName[type], id), { preserveScroll: true });
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const routeName: Record<FormType, string> = {
            subsidiary: 'administration.subsidiaries.store',
            department: 'administration.organization.departments.store',
            division: 'administration.organization.divisions.store',
            subdivision: 'administration.organization.subdivisions.store',
            location: 'administration.organization.locations.store',
            group: 'administration.organization.groups.store',
        };
        const data: Record<string, unknown> = { name: form.data.name, code: form.data.code || null };
        if (formType === 'subsidiary') delete data.code;
        if (formType === 'division') data.subsidiary_id = form.data.subsidiary_id;
        if (formType === 'subdivision') { data.division_id = form.data.division_id; data.parent_id = form.data.parent_id || null; }
        if (formType === 'department') data.subdivision_id = form.data.subdivision_id;
        if (formType === 'location') { data.subdivision_id = form.data.subdivision_id; data.department_id = form.data.department_id; }
        if (formType === 'group') { data.subdivision_id = form.data.subdivision_id; data.location_ids = form.data.location_ids; }
        form.transform(() => data);
        if (editing) {
            const updateRoutes: Record<FormType, string> = {
                subsidiary: 'administration.subsidiaries.update',
                department: 'administration.organization.departments.update',
                division: 'administration.organization.divisions.update',
                subdivision: 'administration.organization.subdivisions.update',
                location: 'administration.organization.locations.update',
                group: 'administration.organization.groups.update',
            };
            form.patch(route(updateRoutes[formType], editing.id), { onSuccess: closeForm });
        } else {
            form.post(route(routeName[formType]), { onSuccess: closeForm });
        }
    };

    const titles: Record<FormType, string> = { subsidiary: 'Subsidiary', division: 'Division', subdivision: 'Sub-Division', department: 'Department', location: 'Location', group: 'Group Consolidated FS' };
    let selectedSubdivision: Subdivision | null = null;
    if (formType === 'group' && form.data.subdivision_id) {
        for (const subsidiary of subsidiaries) for (const division of subsidiary.divisions) {
            selectedSubdivision = findSubdivision(division.subdivisions, Number(form.data.subdivision_id));
            if (selectedSubdivision) break;
        }
    }

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Organization">
            <Head title="Organization" />
            <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
                    <Link href={route('administration.organization.index')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-arms-green">Organization</Link>
                </div>

                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div><p className="text-sm text-stone-600">Manually build: Subsidiary → Division → Sub-Division → Department → Location.</p><p className="mt-1 text-xs text-stone-500">Group Consolidated FS can include multiple locations.</p></div>
                    <button type="button" onClick={() => openForm('subsidiary')} className="rounded-xl bg-arms-green px-5 py-3 text-sm font-semibold text-white">+ Add Subsidiary</button>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                    {subsidiaries.length === 0 ? <div className="p-10 text-center text-sm text-stone-500">No subsidiaries yet. Add one to start.</div> : <div className="space-y-6 p-6">{subsidiaries.map((subsidiary) => (
                        <article key={subsidiary.id} className="overflow-visible rounded-2xl border border-stone-200">
                            <div className="bg-arms-green px-6 py-6 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Subsidiary</p><h1 className="mt-2 text-2xl font-bold">{subsidiary.name}</h1></div><ActionMenu><ActionItem onClick={() => openEdit('subsidiary', subsidiary)}>Edit</ActionItem><ActionItem onClick={() => removeItem('subsidiary', subsidiary.route_key)} danger>Delete</ActionItem><ActionItem onClick={() => openForm('division', { subsidiary_id: subsidiary.id })}>+ Add Division</ActionItem></ActionMenu></div></div>
                            <div className="space-y-6 p-6">{subsidiary.divisions.map((division) => (
                                <article key={division.id} className="rounded-2xl border border-stone-200 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-arms-green">Division</p><h2 className="mt-1 text-lg font-bold">{division.name}</h2></div><ActionMenu><ActionItem onClick={() => openEdit('division', division)}>Edit</ActionItem><ActionItem onClick={() => removeItem('division', division.id)} danger>Delete</ActionItem><ActionItem onClick={() => openForm('subdivision', { division_id: division.id })}>+ Add Sub-Division</ActionItem></ActionMenu></div>
                                    {division.subdivisions.map((subdivision) => <SubdivisionNode key={subdivision.id} subdivision={subdivision} divisionId={division.id} openForm={openForm} openEdit={openEdit} removeItem={removeItem} />)}
                                </article>
                            ))}</div>
                        </article>
                    ))}</div>}
                </div>
            </section>

            <Modal show={showForm} onClose={closeForm} maxWidth="lg">
                <form onSubmit={submit} className="p-6">
                    <h2 className="font-serif text-2xl text-[#073d2f]">{titles[formType]}</h2>

                    {formType === 'division' && <label className="mt-5 block text-sm font-semibold">Subsidiary<select value={form.data.subsidiary_id} onChange={(e) => form.setData('subsidiary_id', Number(e.target.value))} className="mt-2 block w-full rounded-xl border-stone-300"><option value="">Select subsidiary</option>{subsidiaries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><InputError message={form.errors.subsidiary_id} className="mt-2" /></label>}

                    {formType === 'department' && <label className="mt-5 block text-sm font-semibold">Sub-Division<select value={form.data.subdivision_id} onChange={(e) => form.setData('subdivision_id', Number(e.target.value))} className="mt-2 block w-full rounded-xl border-stone-300"><option value="">Select sub-division</option>{subsidiaries.flatMap((s) => s.divisions).flatMap((d) => flatten(d.subdivisions)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><InputError message={form.errors.subdivision_id} className="mt-2" /></label>}

                    {formType === 'location' && <label className="mt-5 block text-sm font-semibold">Department<select value={form.data.department_id} onChange={(e) => form.setData('department_id', Number(e.target.value))} className="mt-2 block w-full rounded-xl border-stone-300"><option value="">Select department</option>{(form.data.subdivision_id ? findSubdivision(subsidiaries.flatMap((s) => s.divisions).flatMap((d) => d.subdivisions), Number(form.data.subdivision_id))?.departments ?? [] : []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><InputError message={form.errors.department_id} className="mt-2" /></label>}

                    {formType === 'subdivision' && <label className="mt-5 block text-sm font-semibold">Parent<select value={form.data.parent_id ? String(form.data.parent_id) : 'division'} onChange={(e) => form.setData('parent_id', e.target.value === 'division' ? '' : Number(e.target.value))} className="mt-2 block w-full rounded-xl border-stone-300"><option value="division">Selected Division</option>{form.data.division_id && subsidiaries.flatMap((s) => s.divisions).find((d) => d.id === Number(form.data.division_id))?.subdivisions.flatMap((s) => flatten([s])).map((s) => <option key={s.id} value={s.id}>{'— '.repeat(s.depth)}{s.name}</option>)}</select><InputError message={form.errors.parent_id} className="mt-2" /></label>}

                    {formType === 'group' && <div className="mt-5 rounded-xl bg-stone-50 p-4"><p className="text-sm font-semibold">Locations in this Group Consolidated FS</p>{selectedSubdivision?.locations.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedSubdivision.locations.map((location) => { const checked = form.data.location_ids.includes(location.id); return <label key={location.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={() => form.setData('location_ids', checked ? form.data.location_ids.filter((id) => id !== location.id) : [...form.data.location_ids, location.id])} />{location.name}</label>; })}</div> : <p className="mt-2 text-xs text-amber-700">Add a location first.</p>}<InputError message={form.errors.location_ids} className="mt-2" /></div>}

                    <label className="mt-5 block text-sm font-semibold">{formType === 'group' ? 'Group Consolidated FS name' : titles[formType] + ' name'} <span className="text-red-700">*</span><input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="mt-2 block w-full rounded-xl border-stone-300" autoFocus /></label>
                    <InputError message={form.errors.name} className="mt-2" />

                    {formType !== 'subsidiary' && <label className="mt-4 block text-sm font-semibold">Code <span className="font-normal text-stone-400">(optional)</span><input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} className="mt-2 block w-full rounded-xl border-stone-300" /><InputError message={form.errors.code} className="mt-2" /></label>}

                    <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={form.processing} className="rounded-xl bg-arms-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{form.processing ? 'Saving…' : editing ? 'Update' : 'Save'}</button></div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
