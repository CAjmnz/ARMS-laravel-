import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Department {
    id: number;
    route_key: string;
    name: string;
    status: string;
    subsidiary_id: number;
    subsidiary_name: string;
    dependency_counts: {
        users: number;
        folders: number;
    };
}

interface SubsidiaryOption {
    id: number;
    name: string;
}

interface PageProps {
    departments: {
        data: Department[];
        links: {
            url: string | null;
            label: string;
            active: boolean;
        }[];
    };
    filters: {
        search: string;
        sort: 'id' | 'name' | 'subsidiary';
        order: 'asc' | 'desc';
        per_page: number;
    };
    subsidiaries: SubsidiaryOption[];
}

export default function Departments({
    departments,
    filters,
    subsidiaries,
}: PageProps) {
    const [editing, setEditing] = useState<Department | null>(null);
    const [deleting, setDeleting] = useState<Department | null>(null);
    const [showForm, setShowForm] = useState(false);
    const form = useForm({
        subsidiary_id: '',
        name: '',
    });

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const openCreateForm = () => {
        form.reset();
        form.clearErrors();
        setEditing(null);
        setShowForm(true);
    };

    const openEditForm = (department: Department) => {
        setEditing(department);
        form.setData({
            subsidiary_id: String(department.subsidiary_id),
            name: department.name,
        });
        form.clearErrors();
        setShowForm(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (editing) {
            form.patch(
                route('administration.departments.update', editing.route_key),
                {
                    onSuccess: closeForm,
                },
            );

            return;
        }

        form.post(route('administration.departments.store'), {
            onSuccess: closeForm,
        });
    };

    const updateFilters = (changes: Record<string, string | number>) => {
        router.get(
            route('administration.departments.index'),
            {
                ...filters,
                ...changes,
                page: 1,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const toggleSort = (sort: 'id' | 'name' | 'subsidiary') => {
        updateFilters({
            sort,
            order:
                filters.sort === sort && filters.order === 'asc'
                    ? 'desc'
                    : 'asc',
        });
    };

    const deletionBlocked =
        deleting !== null &&
        Object.values(deleting.dependency_counts).some(Boolean);

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Departments">
            <Head title="Departments" />

            <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
                <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
                    <Link href={route('administration.subsidiaries.index')} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">Subsidiaries</Link>
                    <Link href={route('administration.departments.index')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-arms-green">Departments</Link>
                </div>
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <p className="text-sm text-stone-600">
                        Manage departments and their subsidiary assignments.
                    </p>

                    <button
                        type="button"
                        onClick={openCreateForm}
                        className="rounded-xl bg-arms-green px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#033b2d]"
                    >
                        New Department
                    </button>
                </div>

                <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                            aria-label="Search departments"
                            defaultValue={filters.search}
                            onChange={(event) =>
                                updateFilters({
                                    search: event.target.value,
                                })
                            }
                            placeholder="Search departments or subsidiaries"
                            className="w-full rounded-xl border-stone-300 text-sm focus:border-arms-green focus:ring-arms-green sm:max-w-sm"
                        />

                        <select
                            aria-label="Records per page"
                            value={filters.per_page}
                            onChange={(event) =>
                                updateFilters({
                                    per_page: Number(event.target.value),
                                })
                            }
                            className="rounded-xl border-stone-300 text-sm focus:border-arms-green focus:ring-arms-green"
                        >
                            <option value="10">10 per page</option>
                            <option value="25">25 per page</option>
                            <option value="50">50 per page</option>
                            <option value="100">100 per page</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-sm">
                            <thead className="border-y border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                                <tr>
                                    <th className="px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('id')}
                                        >
                                            ID
                                        </button>
                                    </th>
                                    <th className="px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort('name')}
                                        >
                                            Department
                                        </button>
                                    </th>
                                    <th className="px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSort('subsidiary')
                                            }
                                        >
                                            Subsidiary
                                        </button>
                                    </th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Users</th>
                                    <th className="px-3 py-3">Folders</th>
                                    <th className="px-3 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.data.map((department) => (
                                    <tr
                                        key={department.id}
                                        className="border-b border-stone-100"
                                    >
                                        <td className="px-3 py-4">
                                            {department.id}
                                        </td>
                                        <td className="px-3 py-4 font-semibold text-[#073d2f]">
                                            {department.name}
                                        </td>
                                        <td className="px-3 py-4">
                                            {department.subsidiary_name}
                                        </td>
                                        <td className="px-3 py-4">
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-arms-green">
                                                {department.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4">
                                            {department.dependency_counts.users}
                                        </td>
                                        <td className="px-3 py-4">
                                            {department.dependency_counts.folders}
                                        </td>
                                        <td className="px-3 py-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openEditForm(department)
                                                }
                                                className="mr-4 font-semibold text-arms-green"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDeleting(department)
                                                }
                                                className="font-semibold text-red-700"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {departments.data.length === 0 && (
                        <p className="py-10 text-center text-stone-500">
                            No departments found.
                        </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                        {departments.links.map((link, index) => (
                            <button
                                key={index}
                                type="button"
                                disabled={!link.url}
                                onClick={() =>
                                    link.url && router.visit(link.url)
                                }
                                className={
                                    link.active
                                        ? 'rounded-lg bg-[#033b2d] px-3 py-2 text-sm text-white'
                                        : 'rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700'
                                }
                                dangerouslySetInnerHTML={{
                                    __html: link.label,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <Modal show={showForm} onClose={closeForm} maxWidth="md">
                <form onSubmit={submit} className="p-6">
                    <h2 className="font-serif text-2xl text-[#073d2f]">
                        {editing ? 'Edit Department' : 'New Department'}
                    </h2>

                    <label className="mt-5 block text-sm font-semibold">
                        Subsidiary <span className="text-red-700">*</span>
                        <select
                            value={form.data.subsidiary_id}
                            onChange={(event) =>
                                form.setData(
                                    'subsidiary_id',
                                    event.target.value,
                                )
                            }
                            className="mt-2 block w-full rounded-xl border-stone-300 focus:border-arms-green focus:ring-arms-green"
                        >
                            <option value="">Select a subsidiary</option>
                            {subsidiaries.map((subsidiary) => (
                                <option
                                    key={subsidiary.id}
                                    value={subsidiary.id}
                                >
                                    {subsidiary.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <InputError
                        message={form.errors.subsidiary_id}
                        className="mt-2"
                    />

                    <label className="mt-5 block text-sm font-semibold">
                        Department name <span className="text-red-700">*</span>
                        <input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            className="mt-2 block w-full rounded-xl border-stone-300 focus:border-arms-green focus:ring-arms-green"
                            autoFocus
                        />
                    </label>
                    <InputError message={form.errors.name} className="mt-2" />

                    <div className="mt-7 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeForm}
                            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={form.processing}
                            className="rounded-xl bg-arms-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {form.processing
                                ? 'Saving…'
                                : editing
                                  ? 'Update'
                                  : 'Save'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                show={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                maxWidth="md"
            >
                <div className="p-6">
                    <h2 className="font-serif text-2xl text-[#073d2f]">
                        Delete department
                    </h2>
                    <p className="mt-3 text-stone-600">
                        Delete <strong>{deleting?.name}</strong>? This action is
                        available only when it has no related records.
                    </p>

                    <dl className="mt-5 grid grid-cols-2 gap-3 text-center text-sm">
                        <div className="rounded-lg bg-stone-50 p-3">
                            <dt>Users</dt>
                            <dd className="mt-1 font-semibold">
                                {deleting?.dependency_counts.users}
                            </dd>
                        </div>
                        <div className="rounded-lg bg-stone-50 p-3">
                            <dt>Folders</dt>
                            <dd className="mt-1 font-semibold">
                                {deleting?.dependency_counts.folders}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-7 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleting(null)}
                            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!deleting || deletionBlocked}
                            onClick={() =>
                                deleting &&
                                router.delete(
                                    route(
                                        'administration.departments.destroy',
                                        deleting.route_key,
                                    ),
                                    {
                                        onSuccess: () => setDeleting(null),
                                    },
                                )
                            }
                            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
