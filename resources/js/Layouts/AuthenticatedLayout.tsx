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
    description?: string;
    header?: ReactNode;
    kicker?: string;
    showClock?: boolean;
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
    description,
    header,
    kicker,
    showClock = true,
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
            items.push({
                active:
                    (route().current('administration.subsidiaries.*') ?? false) ||
                    (route().current('administration.departments.*') ?? false),
                href: route('administration.subsidiaries.index'),
                icon: 'building',
                label: 'Organization',
            });
        }

        if (auth.permissions.includes('users.manage')) {
            items.push({
                active: route().current('users.*') ?? false,
                href: route('users.index'),
                icon: 'users',
                label: 'Users',
            });
        }

        if (auth.permissions.includes('system-settings.manage')) {
            items.push({
                active: route().current('system.*') ?? false,
                href: route('system.index'),
                icon: 'gear',
                label: 'System Settings',
            });
        }

        return items;
    }, [auth.permissions, auth.roles]);

    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), 1_000);

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
        <div className="min-h-screen bg-[#fafaf8] text-arms-dark">
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

                <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="absolute -right-4 top-24 hidden h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-arms-green shadow-lg transition hover:bg-emerald-50 hover:text-arms-dark lg:flex">
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
                <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8 lg:px-10">
                    <div className="flex min-h-16 flex-col gap-4 pl-14 xl:flex-row xl:items-center xl:justify-between xl:gap-5 lg:pl-0">
                        <div className="min-w-0 shrink-0">
                            <p className={'text-[10px] font-extrabold uppercase tracking-[0.18em] ' + (kicker ? 'text-[#087b57]' : 'text-[#8b7a57]')}>
                                {kicker ?? <>{breadcrumb} <span className="px-1">›</span> {title}</>}
                            </p>
                            <h1 className={'mt-1 truncate text-[#082f25] ' + (kicker ? 'text-[30px] font-semibold leading-tight tracking-tight' : 'font-serif text-4xl')}>
                                {title}
                            </h1>
                            {description && <p className="mt-1 max-w-[560px] text-[13px] leading-5 text-[#71837d]">{description}</p>}
                        </div>

                        {header && <div className="min-w-0 flex-1 xl:px-2">{header}</div>}

                        <div className="flex shrink-0 items-center gap-4 sm:gap-7">
                            {showClock && <div className="hidden items-center gap-3 border-r border-stone-200 pr-7 text-right md:flex">
                                <ArmsIcon
                                    name="clock"
                                    className="h-6 w-6 text-[#033b2d]"
                                />
                                <div>
                                    <p className="text-sm font-semibold">
                                        {now.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
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
                            </div>}

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        aria-label="Open account menu"
                                        className="flex items-center gap-2.5 rounded-xl bg-transparent px-1 py-1 text-left transition hover:bg-[#effaf4] focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                    >
                                        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[#c6ead7] bg-gradient-to-br from-[#dff7eb] to-[#bdf0d4] text-xs font-extrabold text-[#07513c] shadow-[0_5px_14px_rgba(6,59,45,0.1)]">
                                            {initials(auth.user.name)}
                                        </span>
                                        <span className="hidden sm:block">
                                            <span className="block max-w-36 truncate text-xs font-bold text-[#18322b]">
                                                {auth.user.name}
                                            </span>
                                            <span className="mt-0.5 block max-w-36 truncate text-[10px] font-medium text-[#71837d]">
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

                <main>{children}</main>
            </div>

            {toast && (
                <div className="fixed right-5 top-24 z-[120] w-[min(92vw,440px)]">
                    <div className={'relative overflow-hidden rounded-2xl border bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] ' + (toast.type === 'success' ? 'border-emerald-200 bg-emerald-50/40' : toast.type === 'error' ? 'border-red-200 bg-red-50/40' : toast.type === 'warning' ? 'border-amber-200 bg-amber-50/40' : 'border-sky-200 bg-sky-50/40')}>
                        <div className="flex items-start gap-4 p-5 pb-6">
                            <span className={'grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-sm ' + (toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500')}>
                                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : toast.type === 'warning' ? '⚠' : 'i'}
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <p className={'text-base font-bold capitalize ' + (toast.type === 'error' ? 'text-red-800' : 'text-arms-dark')}>{toast.type}</p>
                                <p className="mt-1 text-sm leading-5 text-stone-700">{toast.message}</p>
                            </div>
                            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded-lg p-1.5 text-xl leading-none text-stone-500 transition hover:bg-white/80 hover:text-stone-800">×</button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/5">
                            <div className={'h-full w-3/5 rounded-r-full ' + (toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500')} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
