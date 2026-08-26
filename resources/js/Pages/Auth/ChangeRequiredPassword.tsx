import InputError from "@/Components/InputError";
import { Head, useForm } from "@inertiajs/react";
import { FormEventHandler } from "react";
export default function ChangeRequiredPassword() {
    const { data, setData, put, processing, errors } = useForm({
        current_password: "",
        password: "",
        password_confirmation: "",
    });
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route("password.required.update"));
    };
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f7f4] px-5">
            <Head title="Change password" />
            <section className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
                <h1 className="font-serif text-3xl font-semibold text-[#073d2f]">
                    Create a new password
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                    You must change your temporary password before continuing.
                </p>
                <form onSubmit={submit} className="mt-7 space-y-5">
                    {(
                        [
                            "current_password",
                            "password",
                            "password_confirmation",
                        ] as const
                    ).map((field) => (
                        <div key={field}>
                            <label
                                htmlFor={field}
                                className="text-sm font-semibold text-stone-800"
                            >
                                {
                                    {
                                        current_password: "Current password",
                                        password: "New password",
                                        password_confirmation:
                                            "Confirm new password",
                                    }[field]
                                }
                            </label>
                            <input
                                id={field}
                                type="password"
                                autoComplete={
                                    field === "current_password"
                                        ? "current-password"
                                        : "new-password"
                                }
                                value={data[field]}
                                onChange={(e) => setData(field, e.target.value)}
                                className="mt-2 h-12 w-full rounded-lg border border-stone-300 px-4 focus:border-[#08613f] focus:ring-[#08613f]"
                            />
                            <InputError
                                message={errors[field]}
                                className="mt-2"
                            />
                        </div>
                    ))}
                    <button
                        disabled={processing}
                        className="h-12 w-full rounded-lg bg-[#08613f] font-semibold text-white disabled:opacity-60"
                    >
                        {processing
                            ? "Saving…"
                            : "Change password and continue"}
                    </button>
                </form>
            </section>
        </main>
    );
}
