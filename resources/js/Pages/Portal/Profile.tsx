import UserPortalLayout from '@/Layouts/UserPortalLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm';

type ProfileSummary = {
    employee_id: string;
    name: string;
    email?: string | null;
    position?: string | null;
    subsidiary?: string | null;
    department?: string | null;
    account_status: string;
    role?: string | null;
    member_since?: string | null;
    last_login_at?: string | null;
};

type Props = { profile: ProfileSummary };

export default function Profile({ profile }: Props) {
    const form = useForm({ name: profile.name ?? '', email: profile.email ?? '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.patch(route('profile.update'), { preserveScroll: true });
    };

    return (
        <UserPortalLayout title="Profile" description="View and update your RMS account information.">
            <Head title="Profile" />
            <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#073d2f]">Account Summary</h2>
                        <dl className="mt-5 space-y-4 text-sm">
                            <div><dt className="text-stone-500">Employee ID</dt><dd className="font-medium text-stone-800">{profile.employee_id || '—'}</dd></div>
                            <div><dt className="text-stone-500">Position</dt><dd className="font-medium text-stone-800">{profile.position ?? '—'}</dd></div>
                            <div><dt className="text-stone-500">Department</dt><dd className="font-medium text-stone-800">{profile.department ?? '—'}</dd></div>
                            <div><dt className="text-stone-500">Subsidiary</dt><dd className="font-medium text-stone-800">{profile.subsidiary ?? '—'}</dd></div>
                            <div><dt className="text-stone-500">Role</dt><dd className="font-medium text-stone-800">{profile.role ?? 'User'}</dd></div>
                            <div><dt className="text-stone-500">Status</dt><dd className="font-medium capitalize text-stone-800">{profile.account_status}</dd></div>
                        </dl>
                    </aside>
                    <main className="space-y-6">
                        <form onSubmit={submit} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
                            <h2 className="text-lg font-semibold text-[#073d2f]">Profile Information</h2>
                            <p className="mt-1 text-sm text-stone-500">Update the editable details attached to your existing RMS account.</p>
                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                <label className="block text-sm font-medium text-stone-700">Complete Name<input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="mt-2 h-12 w-full rounded-xl border-stone-300" />{form.errors.name && <span className="mt-1 block text-xs text-red-600">{form.errors.name}</span>}</label>
                                <label className="block text-sm font-medium text-stone-700">Email Address<input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className="mt-2 h-12 w-full rounded-xl border-stone-300" />{form.errors.email && <span className="mt-1 block text-xs text-red-600">{form.errors.email}</span>}</label>
                            </div>
                            <div className="mt-6 flex justify-end"><button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{form.processing ? 'Saving…' : 'Save Changes'}</button></div>
                        </form>
                        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7"><UpdatePasswordForm className="profile-password-form" /></div>
                    </main>
                </div>
            </section>
        </UserPortalLayout>
    );
}
