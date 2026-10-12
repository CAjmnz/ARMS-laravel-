import ArmsIcon from '@/Components/ArmsIcon';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
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
    avatar_url?: string | null;
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
        avatar: null as File | null,
    });
    const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url ?? null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);

    useEffect(() => {
        if (!form.data.avatar) {
            setAvatarPreview(profile.avatar_url ?? null);
            return;
        }

        const previewUrl = URL.createObjectURL(form.data.avatar);
        setAvatarPreview(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [form.data.avatar, profile.avatar_url]);

    const submitProfile = (event: FormEvent) => {
        event.preventDefault();
        // Send multipart uploads as POST with Laravel method spoofing so PHP parses name/email and avatar.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(route('profile.update'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => setProfileModalOpen(false),
        });
    };

    const resetProfile = () => {
        form.setData({ name: profile.name ?? '', email: profile.email ?? '', avatar: null });
        form.clearErrors();
    };

    return (
        <AuthenticatedLayout breadcrumb="A.R.M.S" title="Edit Profile">
            <Head title="Edit Profile" />

            <section className="mx-auto max-w-[1550px] px-5 py-7 sm:px-8 lg:px-10">
                <div className="mb-5 flex items-center gap-2 text-sm text-stone-500">
                    <button type="button" onClick={() => router.visit(route('dashboard'))} className="font-medium text-arms-green hover:underline">
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
                            <div className="relative mx-auto w-fit">
                                <div className="grid h-36 w-36 place-items-center overflow-hidden rounded-full border-8 border-emerald-50 bg-[#0b5d45] font-serif text-4xl font-semibold text-white shadow-inner">
                                    {avatarPreview ? <img src={avatarPreview} alt={`${profile.name} profile`} className="h-full w-full object-cover" /> : initials(profile.name)}
                                </div>
                                <button type="button" onClick={() => setProfileModalOpen(true)} aria-label="Edit profile" title="Edit profile" className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-[#087451] text-white shadow-md transition hover:bg-[#055b40]">
                                    <span aria-hidden="true" className="text-xl leading-none">+</span>
                                </button>
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
                                        className="h-12 w-full rounded-xl border-stone-300 bg-white px-4 text-sm shadow-sm focus:border-arms-green-light focus:ring-arms-green-light"
                                    />
                                </Field>
                                <Field label="Email Address" error={form.errors.email}>
                                    <input
                                        type="email"
                                        value={form.data.email}
                                        onChange={(e) => form.setData('email', e.target.value)}
                                        className="h-12 w-full rounded-xl border-stone-300 bg-white px-4 text-sm shadow-sm focus:border-arms-green-light focus:ring-arms-green-light"
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

            {profileModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileModalOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" className="my-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087451]">Account Settings</p><h2 id="profile-modal-title" className="mt-1 text-2xl font-semibold text-[#073d2f]">Edit Profile</h2><p className="mt-1 text-sm text-stone-500">Update your name, email, or profile picture.</p></div>
                            <button type="button" onClick={() => setProfileModalOpen(false)} aria-label="Close modal" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><ArmsIcon name="x" /></button>
                        </div>
                        <form onSubmit={(event) => { submitProfile(event); }} className="mt-6 space-y-5">
                            <div className="flex flex-col items-center">
                                <div className="h-24 w-24 overflow-hidden rounded-full bg-[#0b5d45] text-2xl font-semibold text-white">{avatarPreview ? <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center">{initials(form.data.name || profile.name)}</div>}</div>
                                <label className="mt-3 cursor-pointer rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#087451] hover:bg-emerald-100">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => form.setData('avatar', event.currentTarget.files?.[0] ?? null)} /></label>
                                <p className="mt-2 text-xs text-stone-500">JPG, PNG, or WebP · Max 2 MB</p>
                                {form.errors.avatar && <p className="mt-1 text-xs text-red-600">{form.errors.avatar}</p>}
                            </div>
                            <div><label htmlFor="modal-profile-name" className="block text-sm font-medium text-stone-700">Complete Name</label><input id="modal-profile-name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="mt-2 h-11 w-full rounded-xl border-stone-300" />{form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}</div>
                            <div><label htmlFor="modal-profile-email" className="block text-sm font-medium text-stone-700">Email Address</label><input id="modal-profile-email" type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} className="mt-2 h-11 w-full rounded-xl border-stone-300" />{form.errors.email && <p className="mt-1 text-xs text-red-600">{form.errors.email}</p>}</div>
                            <div className="flex justify-end gap-3 border-t border-stone-100 pt-5"><button type="button" onClick={() => { resetProfile(); setProfileModalOpen(false); }} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button><button disabled={form.processing} className="rounded-xl bg-[#087451] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#055b40] disabled:opacity-50">{form.processing ? 'Saving…' : 'Save Changes'}</button></div>
                        </form>
                    </div>
                </div>
            )}
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
