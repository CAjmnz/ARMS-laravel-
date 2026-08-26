import ArmsIcon from '@/Components/ArmsIcon';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Folder {
    id: number;
    name: string;
    is_published: boolean;
    children_count: number;
    documents_count: number;
    can_manage: boolean;
    can_publish?: boolean;
    can_unpublish?: boolean;
}

interface Props {
    currentFolder: Folder | null;
    breadcrumbs: { id: number; name: string }[];
    folders: { data: Folder[] };
    filters: { search: string };
}

export default function Manage({
    currentFolder,
    breadcrumbs,
    folders,
    filters,
}: Props) {
    const [creating, setCreating] = useState(false);
    const form = useForm({ name: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (currentFolder) {
            form.post(route('documents.folders.store', currentFolder.id), {
                onSuccess: () => {
                    form.reset();
                    setCreating(false);
                },
            });
        }
    };

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Document Management">
            <Head title="Document Management" />

            <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex flex-wrap gap-3 lg:order-2">
                            {!currentFolder && (
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#08613f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#033b2d]"
                                >
                                    <span className="text-lg leading-none">+</span>
                                    Add New Filename
                                </button>
                            )}

                            {currentFolder?.can_manage && (
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#08613f] bg-white px-5 py-3 text-sm font-semibold text-[#08613f] hover:bg-emerald-50"
                                >
                                    <span className="text-lg leading-none">+</span>
                                    New Folder
                                </button>
                            )}
                        </div>

                        <div className="relative flex-1">
                            <ArmsIcon
                                name="folder"
                                className="absolute left-4 top-3.5 h-5 w-5 text-stone-400"
                            />
                            <input
                                defaultValue={filters.search}
                                onChange={(event) =>
                                    router.get(
                                        route(
                                            'documents.manage',
                                            currentFolder?.id,
                                        ),
                                        { search: event.target.value },
                                        {
                                            preserveState: true,
                                            replace: true,
                                        },
                                    )
                                }
                                placeholder="Search in Document Management"
                                className="w-full rounded-xl border-stone-200 py-3 pl-12 text-sm focus:border-[#08613f] focus:ring-[#08613f]"
                            />
                        </div>

                        {currentFolder?.can_manage && (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#08613f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#033b2d]"
                            >
                                <span className="text-lg leading-none">+</span>
                                New folder
                            </button>
                        )}
                    </div>
                </div>

                <nav className="mt-6 flex flex-wrap items-center gap-1 text-sm">
                    <Link
                        href={route('documents.manage')}
                        className="rounded-lg px-2 py-1 font-semibold text-[#08613f] hover:bg-emerald-50"
                    >
                        Documents
                    </Link>
                    {breadcrumbs.map((item) => (
                        <span key={item.id} className="flex items-center gap-1">
                            <span className="text-stone-400">›</span>
                            <Link
                                href={route('documents.manage', item.id)}
                                className="rounded-lg px-2 py-1 font-medium text-stone-700 hover:bg-stone-100"
                            >
                                {item.name}
                            </Link>
                        </span>
                    ))}
                </nav>

                <div className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
                        <div>
                            <h2 className="font-serif text-2xl text-[#073d2f]">
                                {currentFolder?.name ?? 'My Drive'}
                            </h2>
                            <p className="mt-1 text-sm text-stone-500">
                                {currentFolder
                                    ? 'Folders and documents in this location'
                                    : 'Your permitted root folders'}
                            </p>
                        </div>
                        <span className="text-sm text-stone-500">
                            {folders.data.length} folders
                        </span>
                    </div>

                    {folders.data.length ? (
                        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                            {folders.data.map((folder) => (
                                <Link
                                    key={folder.id}
                                    href={route('documents.manage', folder.id)}
                                    className="group flex items-start gap-4 rounded-xl border border-stone-200 p-4 transition hover:-translate-y-0.5 hover:border-[#d4a936] hover:bg-[#fffdf5] hover:shadow-md"
                                >
                                    <span className="rounded-xl bg-emerald-50 p-3 text-[#08613f] group-hover:bg-[#033b2d] group-hover:text-[#f2d46c]">
                                        <ArmsIcon name="folder" className="h-6 w-6" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-[#073d2f]">
                                            {folder.name}
                                        </span>
                                        <span className="mt-2 block text-xs text-stone-500">
                                            {folder.children_count} folders ·{' '}
                                            {folder.documents_count} documents
                                        </span>
                                        <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${folder.is_published ? 'bg-emerald-50 text-[#08613f]' : 'bg-amber-50 text-amber-800'}`}>
                                            {folder.is_published
                                                ? 'Published'
                                                : 'Unpublished'}
                                        </span>
                                        {(folder.can_publish || folder.can_unpublish) && (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    router.patch(route(folder.is_published ? 'documents.folders.unpublish' : 'documents.folders.publish', folder.id));
                                                }}
                                                className="mt-2 block rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold text-[#08613f] hover:bg-emerald-50"
                                            >
                                                {folder.is_published ? 'Unpublish' : 'Publish'}
                                            </button>
                                        )}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="px-6 py-20 text-center">
                            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[#08613f]">
                                <ArmsIcon name="folder" className="h-8 w-8" />
                            </span>
                            <h3 className="mt-5 font-serif text-xl text-[#073d2f]">
                                No folders found
                            </h3>
                            <p className="mt-2 text-sm text-stone-500">
                                Create a folder here, or adjust your search.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {creating && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#012a21]/45 p-4">
                    <form
                        onSubmit={submit}
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                    >
                        <h2 className="font-serif text-2xl text-[#073d2f]">
                            New folder
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                            Create a folder in {currentFolder?.name}.
                        </p>
                        <input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            placeholder="Folder name"
                            className="mt-5 w-full rounded-xl border-stone-300"
                            autoFocus
                        />
                        <p className="mt-2 text-sm text-red-700">
                            {form.errors.name}
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCreating(false)}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={form.processing}
                                className="rounded-xl bg-[#08613f] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Create folder
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
