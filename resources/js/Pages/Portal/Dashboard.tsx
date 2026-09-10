import UserPortalLayout from '@/Layouts/UserPortalLayout';
import { Head, Link } from '@inertiajs/react';

type Props = {
    summary: { visible_documents: number; downloadable_documents: number };
    profile: { name: string; employee_id: string; position?: string | null; subsidiary?: string | null; department?: string | null; role?: string | null };
};

export default function Dashboard({ summary, profile }: Props) {
    return (
        <UserPortalLayout title="Dashboard" description="A simple workspace for your assigned RMS records.">
            <Head title="User Portal" />
            <section className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="rounded-3xl bg-gradient-to-r from-[#0b5d45] to-[#033b2d] p-7 text-white shadow-lg sm:p-9">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/70">ARMS User Portal</p>
                    <h2 className="mt-2 text-3xl font-semibold">Welcome, {profile.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">Access only the documents assigned to your account. Your existing RMS permissions remain enforced throughout the portal.</p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-semibold text-stone-500">Documents available to you</p>
                        <p className="mt-2 text-4xl font-semibold text-[#073d2f]">{summary.visible_documents}</p>
                        <p className="mt-2 text-sm text-stone-500">These are determined by your existing document and folder access assignments.</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-semibold text-stone-500">Download access</p>
                        <p className="mt-2 text-4xl font-semibold text-[#073d2f]">{summary.downloadable_documents}</p>
                        <p className="mt-2 text-sm text-stone-500">Level 1 remains view-only. Level 2 can download only records with download permission.</p>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-[#073d2f]">My Documents</h3><p className="mt-1 text-sm text-stone-500">The full portal document browser will be added in the next feature.</p></div><Link href={route('portal.documents')} className="rounded-xl bg-arms-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-arms-dark">Open My Documents</Link></div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-[#073d2f]">Account</h3>
                        <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-stone-500">Employee ID</dt><dd className="font-medium text-stone-800">{profile.employee_id}</dd></div><div><dt className="text-stone-500">Department</dt><dd className="font-medium text-stone-800">{profile.department ?? '—'}</dd></div><div><dt className="text-stone-500">Subsidiary</dt><dd className="font-medium text-stone-800">{profile.subsidiary ?? '—'}</dd></div><div><dt className="text-stone-500">Role</dt><dd className="font-medium text-stone-800">{profile.role ?? 'User'}</dd></div></dl>
                    </div>
                </div>
            </section>
        </UserPortalLayout>
    );
}
