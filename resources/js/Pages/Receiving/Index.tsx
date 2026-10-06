import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type Organization = { id: number; name: string; departments: { id: number; name: string }[] };
type RecordItem = {
    id: number; receiving_number: string; received_at: string; sender_name: string; show_url: string;
    requesting_office?: string; title: string; document_type: string; status: string;
    priority: string; classification: string; barcode?: string;
};
type Page<T> = { data: T[]; current_page: number; last_page: number; from: number | null; to: number | null; total: number; links: { url: string | null; label: string; active: boolean }[] };

export default function Index({ records, filters, statuses, organizations }: {
    records: Page<RecordItem>; filters: { search: string; status: string; per_page: number };
    statuses: string[]; organizations: Organization[];
}) {
    const page = usePage();
    const [open, setOpen] = useState(false);
    const form = useForm({
        received_at: new Date().toISOString().slice(0,16), sender_name: '', requesting_office: '',
        subsidiary_id: '', department_id: '', title: '', document_type: '', page_count: '',
        copy_count: '1', physical_status: 'Original', digital_copy_status: 'Not available',
        purpose: '', priority: 'Normal', classification: 'Internal', barcode: '',
        initial_condition: '', remarks: '',
    });
    const selectedOrganization = useMemo(() => organizations.find((item) => String(item.id) === form.data.subsidiary_id), [organizations, form.data.subsidiary_id]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('receiving.store'), { onSuccess: () => { form.reset(); setOpen(false); } });
    };

    return (
        <AuthenticatedLayout title="Receiving" breadcrumb="Records / Receiving" description="Register physical records as they enter the records-management workflow.">
            <Head title="Receiving" />
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div><h1 className="text-2xl font-semibold text-arms-dark">Receiving</h1><p className="mt-1 text-sm text-stone-500">Incoming records and their processing history.</p></div>
                    <button onClick={() => setOpen(true)} className="rounded-xl bg-arms-green px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#022f24]">+ New Receiving Record</button>
                </div>

                <form method="get" className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_180px_100px]">
                    <input name="search" defaultValue={filters.search} placeholder="Search receiving no., sender, title, type, barcode..." className="rounded-xl border-stone-300 text-sm" />
                    <select name="status" defaultValue={filters.status} className="rounded-xl border-stone-300 text-sm"><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
                    <button className="rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-semibold">Search</button>
                </form>

                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>
                                <th className="px-5 py-4">Receiving No.</th><th className="px-5 py-4">Received</th><th className="px-5 py-4">Sender</th><th className="px-5 py-4">Title</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4"></th>
                            </tr></thead>
                            <tbody className="divide-y divide-stone-100">{records.data.map((record) => (
                                <tr key={record.id} className="hover:bg-stone-50">
                                    <td className="px-5 py-4 font-semibold text-arms-green">{record.receiving_number}</td>
                                    <td className="px-5 py-4 whitespace-nowrap">{new Date(record.received_at).toLocaleString()}</td>
                                    <td className="px-5 py-4">{record.sender_name}</td>
                                    <td className="px-5 py-4 font-medium">{record.title}</td>
                                    <td className="px-5 py-4">{record.document_type}</td>
                                    <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{record.status}</span></td>
                                    <td className="px-5 py-4">{record.priority}</td>
                                    <td className="px-5 py-4"><Link href={record.show_url} className="font-semibold text-arms-green hover:underline">View</Link></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {records.data.length === 0 && <div className="p-12 text-center text-sm text-stone-500">No receiving records found.</div>}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-4 text-sm text-stone-500">
                        <span>{records.from ?? 0}–{records.to ?? 0} of {records.total}</span>
                        <div className="flex gap-1">{records.links.map((link, index) => link.url ? <Link key={index} href={link.url} preserveScroll className={`rounded-lg px-3 py-1.5 ${link.active ? 'bg-arms-green text-white' : 'hover:bg-stone-100'}`} dangerouslySetInnerHTML={{ __html: link.label }} /> : null)}</div>
                    </div>
                </div>
            </div>

            {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <form onSubmit={submit} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">New Receiving Record</h2><p className="text-sm text-stone-500">Capture the physical record before registration or scanning.</p></div><button type="button" onClick={() => setOpen(false)} className="text-xl text-stone-400">×</button></div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            ['received_at','Date / Time Received','datetime-local'],['sender_name','Sender','text'],['requesting_office','Requesting Office','text'],
                            ['title','Document Title','text'],['document_type','Document Type','text'],['page_count','Page Count','number'],
                            ['copy_count','Copies','number'],['barcode','Barcode / Reference','text'],
                        ].map(([name,label,type]) => <label key={name} className="space-y-1 text-sm font-medium"><span>{label}</span><input type={type} value={(form.data as any)[name]} onChange={(e) => form.setData(name as any,e.target.value)} className="w-full rounded-xl border-stone-300" /></label>)}
                        <label className="space-y-1 text-sm font-medium"><span>Subsidiary</span><select value={form.data.subsidiary_id} onChange={(e) => { form.setData('subsidiary_id',e.target.value); form.setData('department_id',''); }} className="w-full rounded-xl border-stone-300"><option value="">Select</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                        <label className="space-y-1 text-sm font-medium"><span>Department</span><select value={form.data.department_id} onChange={(e) => form.setData('department_id',e.target.value)} className="w-full rounded-xl border-stone-300"><option value="">Select</option>{selectedOrganization?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                        {[
                            ['physical_status',['Original','Copy','Certified Copy','Unknown']],['digital_copy_status',['Available','Not available','To be scanned']],
                            ['priority',['Low','Normal','High','Urgent']],['classification',['Public','Internal','Confidential','Restricted']],
                        ].map(([name,options]) => <label key={name as string} className="space-y-1 text-sm font-medium"><span>{String(name).replaceAll('_',' ')}</span><select value={(form.data as any)[name as string]} onChange={(e) => form.setData(name as any,e.target.value)} className="w-full rounded-xl border-stone-300">{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}
                        {['purpose','initial_condition','remarks'].map((name) => <label key={name} className="space-y-1 text-sm font-medium md:col-span-2"><span>{name.replaceAll('_',' ')}</span><textarea value={(form.data as any)[name]} onChange={(e) => form.setData(name as any,e.target.value)} rows={3} className="w-full rounded-xl border-stone-300" /></label>)}
                    </div>
                    <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-stone-300 px-5 py-2.5 font-semibold">Cancel</button><button disabled={form.processing} className="rounded-xl bg-arms-green px-5 py-2.5 font-semibold text-white disabled:opacity-50">Save Receiving Record</button></div>
                </form>
            </div>}
        </AuthenticatedLayout>
    );
}
