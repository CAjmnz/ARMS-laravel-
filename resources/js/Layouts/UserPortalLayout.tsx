import ArmsIcon from '@/Components/ArmsIcon';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, useMemo, useState } from 'react';

interface Props {
    title: string;
    description?: string;
}

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export default function UserPortalLayout({ children, title, description }: PropsWithChildren<Props>) {
    const { auth } = usePage().props;
    const [open, setOpen] = useState(false);

    const items = useMemo(() => [
        { label: 'Dashboard', href: route('portal.dashboard'), active: route().current('portal.dashboard') ?? false, icon: 'chart' as const },
        { label: 'My Documents', href: route('portal.documents'), active: route().current('portal.documents') ?? false, icon: 'folder' as const },
        { label: 'Profile', href: route('profile.edit'), active: route().current('profile.*') ?? false, icon: 'users' as const },
    ], []);

    return (
        <div className="min-h-screen bg-[#fafaf8] text-arms-dark">
            <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-[#033b2d] to-[#012a21] text-white shadow-2xl transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="border-b border-white/10 px-7 py-8">
                    <Link href={route('portal.dashboard')} className="flex items-center gap-4">
                        <div className="rounded-2xl border-2 border-[#d4a936] p-2 text-[#d4a936]"><ArmsIcon name="shield" className="h-10 w-10" /></div>
                        <div><p className="font-serif text-3xl tracking-wide">ARMS</p><p className="max-w-40 text-xs leading-4 text-emerald-100/75">Alturas Records Management System</p></div>
                    </Link>
                </div>
                <nav className="space-y-2 px-4 py-8">
                    <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/50">User Portal</p>
                    {items.map((item) => <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={`relative flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-semibold transition ${item.active ? 'bg-white/10 text-[#e8c85c]' : 'text-emerald-50/85 hover:bg-white/5 hover:text-white'}`}>
                        {item.active && <span className="absolute inset-y-2 -left-4 w-1 rounded-r bg-[#d4a936]" />}
                        <ArmsIcon name={item.icon} />
                        <span>{item.label}</span>
                    </Link>)}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-5">
                    <Link href={route('logout')} method="post" as="button" className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-emerald-50/85 hover:bg-white/5 hover:text-white">
                        <ArmsIcon name="x" /> Logout
                    </Link>
                </div>
            </aside>

            {open && <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}

            <div className="min-h-screen lg:pl-72">
                <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8 lg:px-10">
                    <div className="flex min-h-16 items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-stone-200 bg-white p-2.5 text-arms-green shadow-sm lg:hidden" aria-label="Open navigation"><ArmsIcon name="menu" /></button>
                            <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#087b57]">A.R.M.S › User Portal</p><h1 className="truncate text-2xl font-semibold text-[#082f25]">{title}</h1>{description && <p className="mt-1 text-xs text-[#71837d]">{description}</p>}</div>
                        </div>
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button type="button" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-emerald-50">
                                    <span className="grid h-10 w-10 place-items-center rounded-full border border-[#c6ead7] bg-[#dff7eb] text-xs font-extrabold text-[#07513c]">{initials(auth.user.name)}</span>
                                    <span className="hidden text-left sm:block"><span className="block max-w-44 truncate text-xs font-bold text-[#18322b]">{auth.user.name}</span><span className="block max-w-44 truncate text-[10px] text-[#71837d]">{auth.user.position ?? auth.roles[0] ?? 'User'}</span></span>
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content width="48" contentClasses="bg-white py-2">
                                <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                <Dropdown.Link href={route('logout')} method="post" as="button">Logout</Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>
                <main>{children}</main>
            </div>
        </div>
    );
}
