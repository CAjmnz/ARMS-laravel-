import ArmsIcon from '@/Components/ArmsIcon';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';

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

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
        : '—';

const formatDateTime = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          }).format(new Date(value))
        : '—';

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

export default function Edit({
    profile,
}: PageProps<{ profile: ProfileSummary; mustVerifyEmail: boolean; status?: string }>) {
    const form = useForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
    });

    const submitProfile = (event: FormEvent) => {
        event.preventDefault();
        form.patch(route('profile.update'), { preserveScroll: true });
    };

    const resetProfile = () => {
        form.setData({ name: profile.name ?? '', email: profile.email ?? '' });
        form.clearErrors();
    };

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Edit Profile">
            <Head title="Edit Profile" />

            <section className="mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
                <div className="mb-5 flex items-center gap-2 text-sm text-stone-500">
                    <button type="button" onClick={() => router.visit(route('dashboard'))} className="font-medium text-[#08613f] hover:underline">
                        A.R.M.S
                    </button>
                    <span>›</span>
                    <span>My Profile</span>
                    <span>›</span>
                    <span className="font-medium text-[#073d2f]">Edit Profile</span>
                </div>

                <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
                    <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
                        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#087451]">Profile Summary</div>

                        <div className="mt-7 text-center">
                            <div className="mx-auto grid h-36 w-36 place-items-center rounded-full border-8 border-emerald-50 bg-[#0b5d45] font-serif text-4xl font-semibold text-white shadow-inner">
                                {initials(profile.name)}
                            </div>
                            <h2 className="mt-5 text-2xl font-semibold text-[#082f25]">{profile.name}</h2>
                            <p className="mt-1 text-sm font-medium text-[#087451]">{profile.position ?? 'Authorized Personnel'}</p>
                            <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                {profile.role ?? 'User'}
                            </span>
                        </div>

                        <div className="my-6 border-t border-stone-100" />

                        <dl className="space-y-4 text-sm">
                            <SummaryRow icon="users" label="Employee ID" value={profile.employee_id || '—'} />
                            <SummaryRow icon="document" label="Email Address" value={profile.email || '—'} />
                            <SummaryRow icon="building" label="Department" value={profile.department || '—'} />
                            <SummaryRow icon="building" label="Subsidiary" value={profile.subsidiary || '—'} />
                            <SummaryRow icon="shield" label="Account Status" value={profile.account_status === 'active' ? 'Active' : profile.account_status} badge />
                            <SummaryRow icon="clock" label="Member Since" value={formatDate(profile.member_since)} />
                            <SummaryRow icon="clock" label="Last Login" value={formatDateTime(profile.last_login_at)} />
                        </dl>
                    </aside>

                    <main className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                        <div className="border-b border-stone-100 px-6 py-5 sm:px-8">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087451]">Edit Profile Information</p>
                            <h2 className="mt-1 text-xl font-semibold text-[#073d2f]">Personal account details</h2>
                            <p className="mt-1 text-sm text-stone-500">Update the profile information attached to your RMS account.</p>
                        </div>

                        <form onSubmit={submitProfile} className="px-6 py-6 sm:px-8">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Field label="Complete Name" error={form.errors.name}>
                                    <input
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        className="h-12 w-full rounded-xl border-stone-300 bg-white px-4 text-sm shadow-sm focus:border-[#0b7652] focus:ring-[#0b7652]"
                                    />
                                </Field>
                                <Field label="Email Address" error={form.errors.email}>
                                    <input
                                        type="email"
                                        value={form.data.email}
                                        onChange={(e) => form.setData('email', e.target.value)}
                                        className="h-12 w-full rounded-xl border-stone-300 bg-white px-4 text-sm shadow-sm focus:border-[#0b7652] focus:ring-[#0b7652]"
                                    />
                                </Field>
                                <ReadOnlyField label="Position / Designation" value={profile.position ?? '—'} />
                                <ReadOnlyField label="Employee ID" value={profile.employee_id || '—'} />
                                <ReadOnlyField label="Department" value={profile.department ?? '—'} />
                                <ReadOnlyField label="Subsidiary" value={profile.subsidiary ?? '—'} />
                            </div>

                            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-stone-100 pt-5">
                                <button type="button" onClick={resetProfile} className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                                    Cancel
                                </button>
                                <button disabled={form.processing} className="rounded-xl bg-[#087451] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#055b40] disabled:cursor-not-allowed disabled:opacity-50">
                                    {form.processing ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>

                        <div className="border-t border-stone-100 bg-stone-50/40 px-6 py-6 sm:px-8">
                            <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                                <UpdatePasswordForm className="profile-password-form" />
                            </div>
                        </div>
                    </main>
                </div>
            </section>
        </AuthenticatedLayout>
    );
}

function SummaryRow({ icon, label, value, badge = false }: { icon: any; label: string; value: string; badge?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#087451]">
                <ArmsIcon name={icon} className="h-4 w-4" />
            </span>
            <dt className="min-w-0 flex-1 text-stone-500">{label}</dt>
            <dd className="max-w-[48%] truncate text-right font-medium text-[#233b34]">
                {badge ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{value}</span> : value}
            </dd>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className="block text-sm font-medium text-stone-700">
            {label}
            <div className="mt-2">{children}</div>
            {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
        </label>
    );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <label className="block text-sm font-medium text-stone-700">
            {label}
            <div className="mt-2 flex h-12 items-center rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-600">{value}</div>
        </label>
    );
}
