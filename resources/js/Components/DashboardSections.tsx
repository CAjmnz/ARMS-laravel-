import ArmsIcon, { ArmsIconName } from '@/Components/ArmsIcon';
import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';

export type DashboardSummary = {
    documents: number;
    folders: number;
    online: number;
    users: number;
};

export type RecentActivityItem = {
    id: number;
    actor: string;
    description: string;
    event: string;
    occurredAt: string | null;
};

export type CategoryItem = {
    id: number;
    name: string;
    count: number;
};

export type MemberRoleItem = {
    name: string;
    count: number;
};

export type QuickActionItem = {
    description: string;
    href: string;
    icon: ArmsIconName;
    label: string;
};

export function DashboardPanel({ children, title, action }: { children: ReactNode; title: string; action?: ReactNode }) {
    return (
        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
                <h2 className="text-base font-semibold text-[#102d25]">{title}</h2>
                {action}
            </header>
            <div className="p-5 sm:p-6">{children}</div>
        </section>
    );
}

export function DashboardStatCard({ icon, label, value, description }: { icon: ArmsIconName; label: string; value: number; description: string }) {
    return (
        <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#08613f]">
                    <ArmsIcon name={icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-[#073d2f]">{value.toLocaleString()}</p>
                    <p className="mt-1 truncate text-xs text-stone-500">{description}</p>
                </div>
            </div>
        </article>
    );
}

export function RecentActivities({ items, formatDate }: { items: RecentActivityItem[]; formatDate: (value: string | null) => string }) {
    if (!items.length) {
        return <p className="py-12 text-center text-sm text-stone-500">No recent activity is available.</p>;
    }

    return (
        <div className="divide-y divide-stone-100">
            {items.map((item) => (
                <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#08613f]">
                        <ArmsIcon name={item.event.includes('auth') ? 'users' : item.event.includes('folder') ? 'folder' : 'document'} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-5 text-[#173d32]">{item.description}</p>
                        <p className="mt-1 text-xs text-stone-500">{item.actor}</p>
                    </div>
                    <time className="shrink-0 text-[11px] text-stone-400">{formatDate(item.occurredAt)}</time>
                </div>
            ))}
        </div>
    );
}

export function QuickAccess({ actions }: { actions: QuickActionItem[] }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {actions.map((action) => (
                <Link key={action.label} href={action.href} className="group rounded-xl border border-stone-200 bg-white px-4 py-5 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm">
                    <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-[#08613f] transition group-hover:bg-white">
                        <ArmsIcon name={action.icon} className="h-5 w-5" />
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-[#173d32]">{action.label}</span>
                    <span className="mt-1 block text-xs text-stone-500">{action.description}</span>
                </Link>
            ))}
        </div>
    );
}

export function CategoryOverview({ categories }: { categories: CategoryItem[] }) {
    const max = Math.max(...categories.map((item) => item.count), 1);

    if (!categories.length) {
        return <p className="py-8 text-center text-sm text-stone-500">No document categories are available.</p>;
    }

    return (
        <div className="space-y-4">
            {categories.map((item) => (
                <div key={item.id}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                        <span className="truncate font-medium text-[#173d32]">{item.name}</span>
                        <span className="shrink-0 font-semibold text-stone-600">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-[#0b7652]" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function StorageOverview({ bytes }: { bytes: number }) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = units[0];
    for (let index = 0; index < units.length - 1 && value >= 1024; index += 1) {
        value /= 1024;
        unit = units[index + 1];
    }

    return (
        <div className="flex min-h-36 items-center justify-center">
            <div className="text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[8px] border-emerald-100 bg-white text-[#08613f]">
                    <ArmsIcon name="document" className="h-6 w-6" />
                </span>
                <p className="mt-4 text-2xl font-bold text-[#073d2f]">{value.toFixed(value >= 10 || unit === 'B' ? 0 : 2)} {unit}</p>
                <p className="mt-1 text-xs text-stone-500">Managed document versions stored by ARMS</p>
            </div>
        </div>
    );
}

export function MemberOverview({ roles }: { roles: MemberRoleItem[] }) {
    const total = roles.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="flex min-h-36 items-center gap-6">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[10px] border-emerald-100 bg-white text-center">
                <div>
                    <p className="text-xl font-bold text-[#073d2f]">{total}</p>
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Users</p>
                </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                {roles.map((role) => (
                    <div key={role.name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-stone-600">{role.name}</span>
                        <span className="font-semibold text-[#173d32]">{role.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
