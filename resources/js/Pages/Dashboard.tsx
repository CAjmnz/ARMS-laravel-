import ArmsIcon from '@/Components/ArmsIcon';
import { CategoryOverview, DashboardPanel, DashboardStatCard, MemberOverview, QuickAccess, RecentActivities, StorageOverview, type CategoryItem, type DashboardSummary, type MemberRoleItem, type QuickActionItem, type RecentActivityItem } from '@/Components/DashboardSections';
import { DocumentActivityChart } from '@/Components/DashboardCharts';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

interface ActivityPoint {
    cumulative: number;
    label: string;
    uploads: number;
}
interface AccountDetails { department:string|null; employeeId:string; lastLoginAt:string|null; name:string; position:string|null; subsidiary:string|null }
interface DashboardProps { account:AccountDetails; activity:ActivityPoint[]; greeting:string; lastLoginAt:string|null; summary:DashboardSummary; recentActivities:RecentActivityItem[]; topCategories:CategoryItem[]; storageBytes:number; memberRoles:MemberRoleItem[] }

function formatDateTime(value:string|null):string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
}

function currentDateLabel():string {
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());
}

export default function Dashboard({account,activity,greeting,lastLoginAt,summary,recentActivities,topCategories,storageBytes,memberRoles}:DashboardProps) {
    const { auth } = usePage().props;
    const [search,setSearch] = useState('');
    const quickActions = useMemo<QuickActionItem[]>(() => {
        const actions:QuickActionItem[] = [{label:'Document Management',description:'Browse records',icon:'document',href:route('documents.manage')}];
        if (auth.permissions.includes('documents.upload')) {
    actions.push({
        label: 'Upload Document',
        description: 'Choose a destination',
        icon: 'document',
        href: route('documents.manage'),
    });
}
        if (auth.permissions.includes('folders.manage')) actions.push({label:'Create Folder',description:'Build record structure',icon:'folder',href:route('documents.manage')});
        if (auth.permissions.includes('users.manage')) actions.push({label:'Manage Users',description:'Accounts and access',icon:'users',href:route('users.index')});
        if (auth.permissions.includes('system-settings.manage')) actions.push({label:'System Settings',description:'Configure ARMS',icon:'gear',href:route('system.index')});
        return actions.slice(0,5);
    },[auth.permissions]);

    const submitSearch = (event:FormEvent) => {
        event.preventDefault();
        const query = search.trim();
        if (query) router.get(route('documents.manage'),{search:query});
    };

    return <AuthenticatedLayout title="Dashboard">
        <Head title="Dashboard" />
        <main className="mx-auto max-w-[1680px] space-y-5 px-5 py-6 sm:px-8 lg:px-10">
            <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-arms-green-light">ARMS Dashboard</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-arms-dark sm:text-3xl">Welcome back, {account.name || 'Administrator'}!</h1>
                    <p className="mt-1 text-sm text-stone-500">{greeting}. Here&apos;s what&apos;s happening with your records today.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form onSubmit={submitSearch} className="relative min-w-0 sm:w-80">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"><ArmsIcon name="search" className="h-4 w-4" /></span>
                        <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search documents, folders..." className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                    </form>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-600 shadow-sm"><ArmsIcon name="clock" className="h-4 w-4 text-[]" /><span>{currentDateLabel()}</span></div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard summary">
                <DashboardStatCard icon="document" label="Total Documents" value={summary.documents} description="Current document records" />
                <DashboardStatCard icon="folder" label="Total Folders" value={summary.folders} description="Folders in the records hierarchy" />
                <DashboardStatCard icon="users" label="Total Users" value={summary.users} description="Registered system accounts" />
                <DashboardStatCard icon="users" label="Online Now" value={summary.online} description="Active in the last 15 minutes" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.85fr)]">
                <DashboardPanel title="Document Activity" action={<span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600">Last 6 months</span>}><DocumentActivityChart activity={activity} /></DashboardPanel>
                <DashboardPanel title="Recent Activities"><RecentActivities items={recentActivities} formatDate={formatDateTime} /></DashboardPanel>
            </section>

            <DashboardPanel title="Quick Access"><QuickAccess actions={quickActions} /></DashboardPanel>

            <section className="grid gap-5 lg:grid-cols-3">
                <DashboardPanel title="Top Document Categories"><CategoryOverview categories={topCategories} /></DashboardPanel>
                <DashboardPanel title="Storage Overview"><StorageOverview bytes={storageBytes} /></DashboardPanel>
                <DashboardPanel title="Member Overview"><MemberOverview roles={memberRoles} /></DashboardPanel>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-xs text-stone-500 shadow-sm">
                <span>Last login: <strong className="font-semibold text-[#173d32]">{formatDateTime(lastLoginAt)}</strong></span>
                <span>{account.department || 'No department'} · {account.subsidiary || 'No subsidiary'}</span>
            </section>
        </main>
    </AuthenticatedLayout>;
}
