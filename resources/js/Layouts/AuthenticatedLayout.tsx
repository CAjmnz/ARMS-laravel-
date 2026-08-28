import ArmsIcon, { ArmsIconName } from '@/Components/ArmsIcon';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';
import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useMemo,
    useState,
} from 'react';

interface AuthenticatedLayoutProps {
    breadcrumb?: string;
    header?: ReactNode;
    title?: string;
}

interface NavigationItem {
    active: boolean;
    href: string;
    icon: ArmsIconName;
    label: string;
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
}

export default function AuthenticatedLayout({
    breadcrumb = 'A.R.M.S',
    children,
    header,
    title = 'Dashboard',
}: PropsWithChildren<AuthenticatedLayoutProps>) {
    const page = usePage();
    const { auth, flash, errors } = page.props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('arms-sidebar-collapsed') === '1');
    const [now, setNow] = useState(() => new Date());
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);

    const navigation = useMemo<NavigationItem[]>(() => {
        const items: NavigationItem[] = [
            {
                active: route().current('dashboard') ?? false,
                href: route('dashboard'),
                icon: 'chart',
                label: 'Dashboard',
            },
        ];

        if (auth.permissions.includes('documents.view')) {
            items.push({
                active: route().current('documents.manage') ?? false,
                href: route('documents.manage'),
                icon: 'folder',
                label: 'Document Management',
            });
        }

        if (auth.roles.includes('super-administrator')) {
            items.push(
                {
                    active:
                        route().current('administration.subsidiaries.*') ??
                        false,
                    href: route('administration.subsidiaries.index'),
                    icon: 'building',
                    label: 'Subsidiaries',
                },
                {
                    active:
                        route().current('administration.departments.*') ??
                        false,
                    href: route('administration.departments.index'),
                    icon: 'building',
                    label: 'Departments',
                },
            );
        }

        if (auth.permissions.includes('users.manage')) {
            items.push(
                {
                    active: route().current('users.*') ?? false,
                    href: route('users.index'),
                    icon: 'users',
                    label: 'Users',
                },
                {
                    active: route().current('roles.*') ?? false,
                    href: route('roles.index'),
                    icon: 'users',
                    label: 'Roles & Permissions',
                },
            );
        }

        items.push({
            active: route().current('profile.*') ?? false,
            href: route('profile.edit'),
            icon: 'gear',
            label: 'Profile',
        });

        return items;
    }, [auth.permissions, auth.roles]);

    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), 60_000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        const next = flash?.success
            ? { type: 'success' as const, message: flash.success }
            : flash?.error
                ? { type: 'error' as const, message: flash.error }
                : flash?.warning
                    ? { type: 'warning' as const, message: flash.warning }
                    : flash?.info
                        ? { type: 'info' as const, message: flash.info }
                        : Object.values(errors ?? {})[0]
                            ? { type: 'error' as const, message: String(Object.values(errors ?? {})[0]) }
                            : null;

        if (!next) return;
        setToast(next);
        const timer = window.setTimeout(() => setToast(null), 4200);
        return () => window.clearTimeout(timer);
    }, [flash?.success, flash?.error, flash?.warning, flash?.info, errors]);

    useEffect(() => {
        window.localStorage.setItem('arms-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (!sidebarOpen) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', closeOnEscape);

        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [sidebarOpen]);

    return (
        <div className="min-h-screen bg-[#fafaf8] text-[#102d25]">
            <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
                className="fixed left-4 top-4 z-30 rounded-xl border border-stone-200 bg-white p-3 text-[#033b2d] shadow-lg lg:hidden"
            >
                <ArmsIcon name="menu" />
            </button>

            {sidebarOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                />
            )}

            <aside
                aria-label="Primary navigation"
                className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gradient-to-b from-[#033b2d] to-[#012a21] text-white shadow-2xl transition-all duration-200 lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className={`flex items-start justify-between border-b border-white/10 py-8 ${sidebarCollapsed ? 'lg:px-4' : 'px-7'}`}>
                    <Link
                        href={route('dashboard')}
                        className="flex items-center gap-4"
                    >
                        <div className="rounded-2xl border-2 border-[#d4a936] p-2 text-[#d4a936]">
                            <ArmsIcon name="shield" className="h-10 w-10" />
                        </div>
                        <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
                            <p className="font-serif text-3xl tracking-wide">
                                ARMS
                            </p>
                            <p className="max-w-36 text-xs leading-4 text-emerald-100/75">
                                Alturas Records Management System
                            </p>
                        </div>
                    </Link>

                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setSidebarOpen(false)}
                        className="rounded-lg p-2 text-emerald-100 hover:bg-white/10 lg:hidden"
                    >
                        <ArmsIcon name="x" />
                    </button>
                </div>

                <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="absolute -right-4 top-24 hidden h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-[#08613f] shadow-lg transition hover:bg-emerald-50 lg:flex">
                    <ArmsIcon name="chevron" className={`h-4 w-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
                </button>

                <nav className="flex-1 space-y-2 px-4 py-8">
                    <p className={`px-4 pb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/50 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                        Workspace
                    </p>

                    {navigation.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={`relative flex items-center rounded-xl px-4 py-3.5 text-sm font-semibold transition ${sidebarCollapsed ? 'lg:justify-center lg:gap-0' : 'gap-4'} ${
                                item.active
                                    ? 'bg-white/10 text-[#e8c85c]'
                                    : 'text-emerald-50/85 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            {item.active && (
                                <span className="absolute inset-y-2 -left-4 w-1 rounded-r bg-[#d4a936]" />
                            )}
                            <ArmsIcon name={item.icon} />
                            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className={`m-5 rounded-2xl border border-white/15 bg-white/5 p-4 ${sidebarCollapsed ? 'lg:m-3 lg:p-3' : ''}`}>
                    <div className="flex items-center gap-3">
                        <ArmsIcon
                            name="shield"
                            className="h-7 w-7 text-[#d4a936]"
                        />
                        <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
                            <p className="text-sm font-semibold text-[#e8c85c]">
                                Authorized
                            </p>
                            <p className="text-xs text-emerald-100/75">
                                personnel only
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            <div className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72'}`}>
                <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 px-5 py-5 shadow-sm backdrop-blur sm:px-8 lg:px-10">
                    <div className="flex min-h-16 items-center justify-between gap-5 pl-14 lg:pl-0">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7a57]">
                                {breadcrumb} <span className="px-1">›</span>{' '}
                                {title}
                            </p>
                            <h1 className="mt-1 font-serif text-4xl text-[#082f25]">
                                {title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-7">
                            <div className="hidden items-center gap-3 border-r border-stone-200 pr-7 text-right md:flex">
                                <ArmsIcon
                                    name="clock"
                                    className="h-6 w-6 text-[#033b2d]"
                                />
                                <div>
                                    <p className="text-sm font-semibold">
                                        {now.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                    <p className="text-xs text-stone-500">
                                        {now.toLocaleDateString([], {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        aria-label="Open account menu"
                                        className="flex items-center gap-3 rounded-2xl border border-[#d4a936] bg-white px-3 py-2 text-left shadow-sm transition hover:bg-[#fffdf5] focus:outline-none focus:ring-2 focus:ring-[#d4a936]"
                                    >
                                        <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#d4a936] bg-[#033b2d] font-serif text-lg text-[#f2d46c]">
                                            {initials(auth.user.name)}
                                        </span>
                                        <span className="hidden sm:block">
                                            <span className="block max-w-44 truncate font-serif text-base font-semibold">
                                                {auth.user.name}
                                            </span>
                                            <span className="block max-w-44 truncate text-xs text-stone-500">
                                                {auth.user.position ??
                                                    auth.roles[0] ??
                                                    'Authorized user'}
                                            </span>
                                        </span>
                                        <ArmsIcon
                                            name="chevron"
                                            className="hidden h-4 w-4 rotate-90 sm:block"
                                        />
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content
                                    width="48"
                                    contentClasses="bg-white py-2"
                                >
                                    <div className="border-b border-stone-100 px-4 py-3">
                                        <p className="truncate font-serif text-base font-semibold text-[#073d2f]">
                                            {auth.user.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-stone-500">
                                            {auth.user.employee_id}
                                        </p>
                                    </div>
                                    <Dropdown.Link href={route('profile.edit')}>
                                        My Profile
                                    </Dropdown.Link>
                                    <div className="mx-3 my-2 border-t border-stone-100" />
                                    <Dropdown.Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        className="text-red-700 hover:bg-red-50 focus:bg-red-50"
                                    >
                                        Sign out
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>
                    </div>
                </header>

                {header}
                <main>{children}</main>
            </div>

            {toast && (
                <div className="fixed right-5 top-24 z-[120] w-[min(92vw,380px)]">
                    <div className={'flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl ' + (toast.type === 'success' ? 'border-emerald-200' : toast.type === 'error' ? 'border-red-200' : toast.type === 'warning' ? 'border-amber-200' : 'border-sky-200')}>
                        <span className={'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-bold text-white ' + (toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500')}>
                            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '×' : toast.type === 'warning' ? '!' : 'i'}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold capitalize text-[#073d2f]">{toast.type}</p>
                            <p className="mt-0.5 text-sm leading-5 text-stone-600">{toast.message}</p>
                        </div>
                        <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="rounded-lg p-1 text-xl leading-none text-stone-400 hover:bg-stone-100 hover:text-stone-700">×</button>
                    </div>
                </div>
            )}
        </div>
    );
}
