import ArmsIcon from '@/Components/ArmsIcon';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect } from 'react';

const featureCards = [
    {
        icon: 'folder' as const,
        title: 'Document Management',
        description: 'Organize, store, retrieve, and manage records with a clear folder structure.',
    },
    {
        icon: 'building' as const,
        title: 'Structured Records',
        description: 'Keep records aligned to subsidiaries, departments, and organizational access.',
    },
    {
        icon: 'users' as const,
        title: 'Controlled Access',
        description: 'Use role-based access so authorized personnel only see what they need.',
    },
    {
        icon: 'shield' as const,
        title: 'Secure & Reliable',
        description: 'Protect organizational records with controlled access and traceable activity.',
    },
];

interface LandingStats {
    departments: number;
    documents: number;
    folders: number;
    online: number;
    users: number;
}

export default function Welcome({
    auth,
    landingStats,
}: PageProps<{ landingStats: LandingStats }>) {
    const primaryHref = auth.user ? route('dashboard') : route('login');
    const primaryLabel = auth.user ? 'Open Dashboard' : 'Get Started';
    const number = (value: number) => new Intl.NumberFormat().format(value);
    const stats = [
        { icon: 'document' as const, value: number(landingStats.documents), label: 'Documents Managed' },
        { icon: 'folder' as const, value: number(landingStats.folders), label: 'Folders Organized' },
        { icon: 'users' as const, value: number(landingStats.users), label: 'System Users' },
        { icon: 'building' as const, value: number(landingStats.departments), label: 'Departments' },
    ];

    useEffect(() => {
        const interval = window.setInterval(() => {
            router.reload({ only: ['landingStats'] });
        }, 10_000);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <>
            <Head title="Welcome to ARMS" />

            <div className="min-h-screen bg-[#fafaf8] text-arms-dark">
                <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 shadow-sm backdrop-blur">
                    <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="rounded-xl border-2 border-[#d4a936] bg-[#033b2d] p-2 text-[#e8c85c] shadow-sm">
                                <ArmsIcon name="shield" className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="font-serif text-2xl font-semibold tracking-wide text-[#082f25]">ARMS</p>
                                <p className="hidden text-[11px] font-medium text-stone-500 sm:block">Alturas Records Management System</p>
                            </div>
                        </Link>

                        <nav className="hidden items-center gap-1 lg:flex">
                            <a href="#features" className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-arms-dark">Features</a>
                            <a href="#benefits" className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-arms-dark">Benefits</a>
                            <a href="#about" className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-arms-dark">About</a>
                            <a href="#contact" className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-arms-dark">Contact</a>
                        </nav>

                        <Link
                            href={primaryHref}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-arms-green px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#064f34] focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        >
                            <ArmsIcon name={auth.user ? 'chart' : 'shield'} className="h-4 w-4" />
                            {auth.user ? 'Dashboard' : 'Sign In'}
                        </Link>
                    </div>
                </header>

                <main>
                    <section className="relative overflow-hidden border-b border-stone-200 bg-white">
                        <div className="absolute inset-y-0 right-0 hidden w-[46%] bg-gradient-to-br from-[#edf7f2] via-[#f7fbf9] to-[#fafaf8] lg:block" />
                        <div className="absolute -right-20 top-16 hidden h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl lg:block" />

                        <div className="relative mx-auto grid max-w-[1680px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-10 lg:py-24">
                            <div className="max-w-3xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-arms-green-light">
                                    <span className="h-2 w-2 rounded-full bg-[#d4a936]" />
                                    Welcome to ARMS
                                </div>

                                <h1 className="mt-6 font-serif text-5xl font-semibold leading-[1.02] tracking-tight text-[#082f25] sm:text-6xl lg:text-7xl">
                                    Smart management for your records
                                </h1>

                                <div className="mt-6 h-1 w-16 rounded-full bg-[#d4a936]" />

                                <p className="mt-7 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
                                    ARMS gives your organization a centralized workspace for managing documents, folders, access, and records with a secure and structured workflow.
                                </p>

                                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                    <Link
                                        href={primaryHref}
                                        className="inline-flex h-12 items-center justify-center gap-3 rounded-xl bg-arms-green px-6 text-sm font-semibold text-white shadow-md transition hover:bg-[#064f34]"
                                    >
                                        {primaryLabel}
                                        <ArmsIcon name="chevron" className="h-4 w-4" />
                                    </Link>
                                    <a
                                        href="#about"
                                        className="inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-6 text-sm font-semibold text-[#173d32] shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                                    >
                                        Learn More
                                        <ArmsIcon name="chevron" className="h-4 w-4 rotate-90" />
                                    </a>
                                </div>

                                <div className="mt-8 flex items-center gap-3 text-sm text-stone-500">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-arms-green">
                                        <ArmsIcon name="shield" className="h-5 w-5" />
                                    </div>
                                    <span>Secure access for authorized personnel</span>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-emerald-100/80 via-white to-amber-50 blur-2xl" />
                                <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white p-4 shadow-2xl sm:p-6">
                                    <div className="mb-5 flex items-center justify-between border-b border-stone-200 pb-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7a57]">A.R.M.S › Dashboard</p>
                                            <h2 className="mt-1 font-serif text-3xl text-[#082f25]">Dashboard</h2>
                                        </div>
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#033b2d] text-[#e8c85c]">
                                            <ArmsIcon name="shield" className="h-6 w-6" />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        {[
                                            ['document', 'Documents', number(landingStats.documents)],
                                            ['folder', 'Folders', number(landingStats.folders)],
                                            ['users', 'Users', number(landingStats.users)],
                                            ['clock', 'Online', number(landingStats.online)],
                                        ].map(([icon, label, value]) => (
                                            <div key={label} className="rounded-2xl border border-stone-200 bg-[#fafaf8] p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-medium text-stone-500">{label}</p>
                                                        <p className="mt-2 text-2xl font-bold text-arms-dark">{value}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-emerald-50 p-2 text-arms-green">
                                                        <ArmsIcon name={icon as 'document' | 'folder' | 'users' | 'clock'} className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-arms-dark">Document Activity</p>
                                                    <p className="mt-1 text-xs text-stone-400">Last 6 months</p>
                                                </div>
                                                <span className="rounded-lg bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-500">Overview</span>
                                            </div>
                                            <div className="mt-6 flex h-36 items-end gap-3">
                                                {[38, 56, 44, 72, 64, 88, 78, 96].map((height, index) => (
                                                    <div key={index} className="flex flex-1 items-end">
                                                        <div className="w-full rounded-t-md bg-gradient-to-t from-[#08613f] to-[#36a278]" style={{ height: `${height}%` }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                            <p className="text-sm font-semibold text-arms-dark">Recent Activity</p>
                                            <div className="mt-4 space-y-4">
                                                {[
                                                    ['document', 'Annual Report', 'Uploaded'],
                                                    ['folder', 'Finance Records', 'Updated'],
                                                    ['users', 'User Access', 'Reviewed'],
                                                ].map(([icon, title, action]) => (
                                                    <div key={title} className="flex items-center gap-3">
                                                        <div className="rounded-xl bg-emerald-50 p-2 text-arms-green">
                                                            <ArmsIcon name={icon as 'document' | 'folder' | 'users'} className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs font-semibold text-arms-dark">{title}</p>
                                                            <p className="text-[11px] text-stone-400">{action}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="features" className="mx-auto max-w-[1680px] px-5 py-8 sm:px-8 lg:px-10">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {featureCards.map((feature) => (
                                <article key={feature.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-arms-green">
                                        <ArmsIcon name={feature.icon} className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-4 text-base font-bold text-arms-dark">{feature.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-stone-500">{feature.description}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section id="about" className="border-y border-stone-200 bg-white">
                        <div className="mx-auto grid max-w-[1680px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-16">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-arms-green-light">About ARMS</p>
                                <h2 className="mt-2 font-serif text-4xl text-[#082f25]">Built around your records workflow</h2>
                                <div className="mt-4 h-1 w-14 rounded-full bg-[#d4a936]" />
                                <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">
                                    ARMS supports organized record management through a unified interface that keeps document handling, access, and administrative structure consistent across the system.
                                </p>
                            </div>

                            <div id="benefits" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {stats.map((stat) => (
                                    <div key={stat.label} className="rounded-2xl border border-stone-200 bg-[#fafaf8] p-5 text-center shadow-sm">
                                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-arms-green">
                                            <ArmsIcon name={stat.icon} className="h-5 w-5" />
                                        </div>
                                        <p className="mt-4 text-3xl font-bold tracking-tight text-arms-dark">{stat.value}</p>
                                        <p className="mt-1 text-xs font-medium text-stone-500">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </main>

                <footer id="contact" className="bg-gradient-to-r from-[#033b2d] to-[#012a21] text-white">
                    <div className="mx-auto flex max-w-[1680px] flex-col gap-6 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-[#d4a936]/80 p-2 text-[#e8c85c]">
                                <ArmsIcon name="shield" className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="font-serif text-xl">ARMS</p>
                                <p className="text-xs text-emerald-100/70">Alturas Records Management System</p>
                            </div>
                        </div>

                        <p className="text-xs text-emerald-100/70">© 2026 ARMS. All rights reserved.</p>

                        <div className="flex items-center gap-3 text-sm text-emerald-50">
                            <ArmsIcon name="users" className="h-5 w-5 text-[#e8c85c]" />
                            <span><strong className="font-semibold">Need help?</strong> Contact your system administrator.</span>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
