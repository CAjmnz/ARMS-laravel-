import UserPortalLayout from '@/Layouts/UserPortalLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
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
    avatar_url?: string | null;
};

type Props = { profile: ProfileSummary };

export default function Profile({ profile }: Props) {
    const form = useForm({ name: profile.name ?? '', email: profile.email ?? '', avatar: null as File | null });
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

    const submit = (event: FormEvent) => {
        event.preventDefault();
        // Send multipart uploads as POST with Laravel method spoofing so PHP parses name/email and avatar.
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(route('profile.update'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => setProfileModalOpen(false),
        });
    };

    return (
        <UserPortalLayout title="Profile" description="View and update your RMS account information.">
            <Head title="Profile" />
            <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8 lg:px-10">
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#073d2f]">Account Summary</h2>
                        <div className="mt-5 flex justify-center">
                            <div className="relative w-fit">
                                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[#0b5d45] text-2xl font-semibold text-white ring-4 ring-emerald-50">
                                    {avatarPreview ? <img src={avatarPreview} alt={`${profile.name} profile`} className="h-full w-full object-cover" /> : profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}
                                </div>
                                <button type="button" onClick={() => setProfileModalOpen(true)} aria-label="Edit profile" title="Edit profile" className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-[#087451] text-white shadow-md transition hover:bg-[#055b40]"><span className="text-xl leading-none">+</span></button>
                            </div>
                        </div>
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
                                <label className="block text-sm font-medium text-stone-700 md:col-span-2">Profile Picture
                                    <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                                        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0b5d45] text-xl font-semibold text-white">
                                            {avatarPreview ? <img src={avatarPreview} alt="Profile picture preview" className="h-full w-full object-cover" /> : profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => form.setData('avatar', event.currentTarget.files?.[0] ?? null)} className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-800 hover:file:bg-emerald-200" />
                                            <p className="mt-2 text-xs text-stone-500">JPG, PNG, or WebP. Maximum file size: 2 MB.</p>
                                            {form.errors.avatar && <span className="mt-1 block text-xs text-red-600">{form.errors.avatar}</span>}
                                        </div>
                                    </div>
                                </label>
                            </div>
                            <div className="mt-6 flex justify-end"><button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{form.processing ? 'Saving…' : 'Save Changes'}</button></div>
                        </form>
                        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7"><UpdatePasswordForm className="profile-password-form" /></div>
                    </main>
                </div>
            </section>

            {profileModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileModalOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="portal-profile-modal-title" className="my-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087451]">Account Settings</p><h2 id="portal-profile-modal-title" className="mt-1 text-2xl font-semibold text-[#073d2f]">Edit Profile</h2><p className="mt-1 text-sm text-stone-500">Update your name, email, or profile picture.</p></div>
                            <button type="button" onClick={() => setProfileModalOpen(false)} aria-label="Close modal" className="rounded-full p-2 text-stone-500 hover:bg-stone-100"><span aria-hidden="true" className="text-xl">×</span></button>
                        </div>
                        <form onSubmit={submit} className="mt-6 space-y-5">
                            <div className="flex flex-col items-center">
                                <div className="h-24 w-24 overflow-hidden rounded-full bg-[#0b5d45] text-2xl font-semibold text-white">{avatarPreview ? <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center">{profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</div>}</div>
                                <label className="mt-3 cursor-pointer rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#087451] hover:bg-emerald-100">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => form.setData('avatar', event.currentTarget.files?.[0] ?? null)} /></label>
                                <p className="mt-2 text-xs text-stone-500">JPG, PNG, or WebP · Max 2 MB</p>
                                {form.errors.avatar && <p className="mt-1 text-xs text-red-600">{form.errors.avatar}</p>}
                            </div>
                            <div><label htmlFor="portal-modal-profile-name" className="block text-sm font-medium text-stone-700">Complete Name</label><input id="portal-modal-profile-name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className="mt-2 h-11 w-full rounded-xl border-stone-300" />{form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}</div>
                            <div><label htmlFor="portal-modal-profile-email" className="block text-sm font-medium text-stone-700">Email Address</label><input id="portal-modal-profile-email" type="email" value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} className="mt-2 h-11 w-full rounded-xl border-stone-300" />{form.errors.email && <p className="mt-1 text-xs text-red-600">{form.errors.email}</p>}</div>
                            <div className="flex justify-end gap-3 border-t border-stone-100 pt-5"><button type="button" onClick={() => { form.setData({ name: profile.name ?? '', email: profile.email ?? '', avatar: null }); form.clearErrors(); setProfileModalOpen(false); }} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button><button disabled={form.processing} className="rounded-xl bg-[#087451] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#055b40] disabled:opacity-50">{form.processing ? 'Saving…' : 'Save Changes'}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </UserPortalLayout>
    );
}
