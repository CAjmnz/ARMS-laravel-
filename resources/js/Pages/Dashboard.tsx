import ArmsIcon, { ArmsIconName } from '@/Components/ArmsIcon';
import {
    DocumentActivityChart,
    DocumentStatusChart,
} from '@/Components/DashboardCharts';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';

interface DashboardSummary {
    documents: number;
    online: number;
    pending: number;
    users: number;
}

interface DocumentStatus {
    published: number;
    publishedPercentage: number;
    total: number;
    unpublished: number;
    unpublishedPercentage: number;
}

interface ActivityPoint {
    cumulative: number;
    label: string;
    uploads: number;
}

interface AccountDetails {
    department: string | null;
    employeeId: string;
    lastLoginAt: string | null;
    name: string;
    position: string | null;
    subsidiary: string | null;
}

interface DashboardProps {
    account: AccountDetails;
    activity: ActivityPoint[];
    documentStatus: DocumentStatus;
    greeting: string;
    lastLoginAt: string | null;
    summary: DashboardSummary;
}

interface SummaryCardProps {
    description: string;
    icon: ArmsIconName;
    label: string;
    value: number;
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'Not recorded';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function SummaryCard({ description, icon, label, value }: SummaryCardProps) {
    return (
        <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white px-5 py-5 shadow-sm">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#d4a936] to-[#08613f]" />
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#033b2d] text-[#f0d264]">
                    <ArmsIcon name={icon} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-600">{label}</p>
                    <p className="font-serif text-3xl font-semibold text-[#073d2f]">
                        {value.toLocaleString()}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                        {description}
                    </p>
                </div>
                <ArmsIcon name="chevron" className="h-4 w-4 text-stone-400" />
            </div>
        </article>
    );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-5 font-serif text-2xl text-[#102d25]">{title}</h2>
            {children}
        </section>
    );
}

export default function Dashboard({
    account,
    activity,
    documentStatus,
    greeting,
    lastLoginAt,
    summary,
}: DashboardProps) {
    const { auth } = usePage().props;
    const canManageUsers = auth.permissions.includes('users.manage');

    return (
        <AuthenticatedLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="mx-auto max-w-[1680px] space-y-6 px-5 py-7 sm:px-8 lg:px-10">
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#033b2d] via-[#07553d] to-[#0b7652] px-7 py-9 text-white shadow-lg sm:px-10">
                    <div
                        aria-hidden="true"
                        className="absolute -right-20 -top-32 h-96 w-96 rounded-full border border-[#d4a936]/20"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute right-12 top-8 hidden opacity-30 sm:block"
                    >
                        <div className="relative h-40 w-52">
                            <div className="absolute left-0 top-8 h-28 w-40 rotate-[-6deg] rounded-xl border border-white/50 bg-white/10" />
                            <div className="absolute left-7 top-4 h-28 w-40 rotate-3 rounded-xl border border-white/50 bg-white/10" />
                            <div className="absolute right-1 top-12 rounded-2xl border-2 border-[#d4a936] bg-[#033b2d]/80 p-4 text-[#d4a936]">
                                <ArmsIcon name="shield" className="h-16 w-16" />
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 max-w-3xl">
                        <span className="inline-flex rounded-full border border-[#d4a936] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#f1d66f]">
                            ARMS WORKSPACE
                        </span>
                        <h2 className="mt-5 font-serif text-3xl sm:text-5xl">
                            {greeting}, {account.name || 'Administrator'}.
                        </h2>
                        <div className="mt-4 h-0.5 w-12 bg-[#d4a936]" />
                        <p className="mt-5 text-sm text-emerald-50/85 sm:text-base">
                            Here is a summary of your records management
                            workspace.
                        </p>
                        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-100/80">
                            <ArmsIcon name="clock" className="h-4 w-4" />
                            Last login:{' '}
                            <span className="font-semibold text-[#f1d66f]">
                                {formatDateTime(lastLoginAt)}
                            </span>
                        </p>
                    </div>
                </section>

                <section aria-labelledby="records-overview-title">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <h2
                            id="records-overview-title"
                            className="font-serif text-2xl text-[#102d25]"
                        >
                            Records overview
                        </h2>
                        <p className="text-xs text-stone-500">
                            Values use your existing RMS data
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            label="Pending"
                            value={summary.pending}
                            description="Unpublished folders"
                            icon="clock"
                        />
                        <SummaryCard
                            label="Documents"
                            value={summary.documents}
                            description="Document records"
                            icon="document"
                        />
                        <SummaryCard
                            label="Users"
                            value={summary.users}
                            description="Registered accounts"
                            icon="users"
                        />
                        <SummaryCard
                            label="Online"
                            value={summary.online}
                            description="Active in the last 15 minutes"
                            icon="users"
                        />
                    </div>
                </section>

                <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                    <Panel title="Document Status">
                        <DocumentStatusChart status={documentStatus} />
                    </Panel>
                    <Panel title="Document Activity">
                        <DocumentActivityChart activity={activity} />
                    </Panel>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <Panel title="Quick actions">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Link
                                href={route('profile.edit')}
                                className="flex items-center gap-4 rounded-xl border border-stone-200 p-4 transition hover:border-[#d4a936] hover:bg-[#fafaf8]"
                            >
                                <span className="rounded-full bg-emerald-50 p-3 text-[#08613f]">
                                    <ArmsIcon name="gear" />
                                </span>
                                <span>
                                    <span className="block font-semibold">
                                        View profile
                                    </span>
                                    <span className="text-xs text-stone-500">
                                        Review account details
                                    </span>
                                </span>
                            </Link>

                            {canManageUsers && (
                                <Link
                                    href={route('roles.index')}
                                    className="flex items-center gap-4 rounded-xl border border-stone-200 p-4 transition hover:border-[#d4a936] hover:bg-[#fafaf8]"
                                >
                                    <span className="rounded-full bg-amber-50 p-3 text-[#9a741b]">
                                        <ArmsIcon name="users" />
                                    </span>
                                    <span>
                                        <span className="block font-semibold">
                                            Roles & permissions
                                        </span>
                                        <span className="text-xs text-stone-500">
                                            View fixed role access
                                        </span>
                                    </span>
                                </Link>
                            )}
                        </div>
                    </Panel>

                    <Panel title="Account details">
                        <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
                            {[
                                ['Employee', account.name],
                                ['Employee ID', account.employeeId],
                                ['Position', account.position],
                                ['Subsidiary', account.subsidiary],
                                ['Department', account.department],
                                [
                                    'Last login',
                                    formatDateTime(account.lastLoginAt),
                                ],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex justify-between gap-4 border-b border-stone-100 py-3"
                                >
                                    <dt className="text-stone-500">{label}</dt>
                                    <dd className="max-w-[65%] truncate text-right font-medium">
                                        {value || '—'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </Panel>
                </div>

                <footer className="py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#08613f]">
                    Alturas RMS <span className="px-2 text-[#d4a936]">•</span>
                    <span className="font-normal normal-case tracking-normal text-stone-500">
                        Secure records workspace
                    </span>
                </footer>
            </div>
        </AuthenticatedLayout>
    );
}
