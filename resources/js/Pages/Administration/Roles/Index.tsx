import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

type FixedRole = {
    id: number;
    name: string;
    slug: string;
    level: number;
    users_count: number;
    permissions: string[];
};

const capabilities = [
    ['Dashboard', 'dashboard.view'],
    ['Manage users', 'users.manage'],
    ['Manage documents', 'folders.manage'],
    ['View assigned documents', 'documents.view'],
    ['Download assigned documents', 'documents.download'],
    ['Assign document access', 'documents.access.manage'],
    ['System settings', 'system-settings.manage'],
    ['Backups', 'backups.manage'],
    ['Delete files / documents', 'documents.delete'],
] as const;

const descriptions: Record<string, string> = {
    'super-administrator': 'Full access, including System administration and document deletion.',
    administrator: 'User and document administration without protected System or deletion access.',
    'records-officer': 'View and download only documents assigned to the user.',
    viewer: 'View only documents assigned to the user.',
};

export default function Index({ roles }: { roles: FixedRole[] }) {
    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S › System Settings" title="Roles & Permissions">
            <Head title="Roles & Permissions" />
            <div className="bg-[#fafaf8] py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
                        <Link href={route('system.index', { tab: 'general' })} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">Global Configuration</Link>
                        <Link href={route('system.index', { tab: 'file-types' })} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">File Type Setting</Link>
                        <Link href={route('system.index', { tab: 'logs' })} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">Access Logs</Link>
                        <Link href={route('system.index', { tab: 'backup' })} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">Backup</Link>
                        <Link href={route('roles.index')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-arms-green">Roles & Permissions</Link>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#033b2d]">Roles & Permissions</h1>
                        <p className="mt-1 text-sm text-gray-600">Fixed permissions inherited from the CI3 Records Management System.</p>
                    </div>
                    <div className="rounded-xl border border-[#e2d4ae] bg-[#fffaf0] p-4 text-sm text-[#6d5114]">
                        <strong>Fixed legacy behavior:</strong> exactly four roles are available. Roles and permissions cannot be created, deleted, or customized.
                    </div>

                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {roles.map((role) => (
                            <article key={role.slug} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf5f0] text-lg font-bold text-[#03543f]">{role.level}</span>
                                    {role.level === 4 && <span className="rounded-full bg-[#fff0c2] px-2.5 py-1 text-xs font-bold text-[#8b6200]">PROTECTED</span>}
                                </div>
                                <h2 className="mt-4 text-lg font-bold text-[#033b2d]">{role.name}</h2>
                                <p className="mt-2 min-h-16 text-sm leading-6 text-gray-600">{descriptions[role.slug]}</p>
                                <p className="mt-4 border-t border-gray-100 pt-3 text-sm font-semibold text-[#0b563f]">{role.users_count} assigned {role.users_count === 1 ? 'user' : 'users'}</p>
                            </article>
                        ))}
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-6 py-5">
                            <h2 className="text-lg font-bold text-[#033b2d]">CI3 Access Rules</h2>
                            <p className="mt-1 text-sm text-gray-600">Read-only reference. Authorization is enforced by Laravel policies and middleware.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <tr><th className="px-6 py-4">Module / Action</th>{roles.map((role) => <th key={role.slug} className="px-5 py-4 text-center">Level {role.level}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {capabilities.map(([label, permission]) => (
                                        <tr key={permission}>
                                            <td className="px-6 py-4 font-medium text-gray-800">{label}</td>
                                            {roles.map((role) => {
                                                const allowed = role.permissions.includes(permission);
                                                return <td key={role.slug} className="px-5 py-4 text-center"><span className={allowed ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0b563f] font-bold text-white' : 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-400'} aria-label={allowed ? 'Allowed' : 'Not allowed'}>{allowed ? '✓' : '—'}</span></td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    <p className="text-sm text-gray-500">Roles are assigned from User Management. Level 4 can only be created through the secure Super User command.</p>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
