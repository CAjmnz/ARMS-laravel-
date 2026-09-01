import InputError from "@/Components/InputError";
import { Head, useForm } from "@inertiajs/react";
import { FormEventHandler, useState } from "react";
const Shield = ({ small = false }: { small?: boolean }) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 64 72"
        className={small ? "h-6 w-6" : "h-24 w-24"}
        fill="none"
    >
        <path
            d="M32 3 57 13v20c0 17-10 29-25 36C17 62 7 50 7 33V13L32 3Z"
            fill="#07553d"
            stroke="#d4a936"
            strokeWidth="2"
        />
        <rect x="22" y="30" width="20" height="17" rx="3" fill="#d4a936" />
        <path d="M26 30v-5a6 6 0 0 1 12 0v5" stroke="#d4a936" strokeWidth="3" />
    </svg>
);
export default function ArmsLogin({ status }: { status?: string }) {
    const [visible, setVisible] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        employee_id: "",
        password: "",
        remember: false,
    });
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route("login"), { onFinish: () => reset("password") });
    };
    return (
        <main className="min-h-screen bg-[#fafaf8] lg:grid lg:grid-cols-[46%_54%]">
            <Head title="Sign in" />
            <section className="relative hidden min-h-screen overflow-hidden bg-[#033b2d] px-16 text-white lg:flex lg:flex-col lg:justify-center">
                <div className="relative z-10 -mt-36">
                    <h1 className="font-serif text-7xl font-semibold">ARMS</h1>
                    <p className="mt-3 text-2xl text-[#e1b53f]">
                        Alturas Records Management System
                    </p>
                    <div className="mt-7 h-1 w-14 bg-[#d4a936]" />
                    <p className="mt-8 flex items-center gap-3 text-lg">
                        <Shield small />
                        Secure access to your organization&apos;s records
                    </p>
                </div>
                <div
                    aria-hidden="true"
                    className="absolute inset-x-10 bottom-10 h-[43%] opacity-25"
                >
                    <div className="absolute bottom-8 left-2 h-72 w-60 border-2 border-emerald-100 [clip-path:polygon(50%_0,100%_18%,90%_72%,50%_100%,10%_72%,0_18%)]" />
                    {[0, 1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className="absolute bottom-20 h-64 w-44 rounded-t-lg border border-emerald-100"
                            style={{
                                left: `${220 + n * 42}px`,
                                transform: `translateY(${-n * 22}px)`,
                            }}
                        />
                    ))}
                    <div className="absolute inset-x-0 bottom-0 h-32 -skew-y-6 border-t border-emerald-200 bg-emerald-800/30" />
                </div>
            </section>
            <section className="flex min-h-screen items-center justify-center px-5 py-10">
                <div className="w-full max-w-[540px] rounded-2xl border border-stone-200 bg-white px-6 py-10 shadow-xl sm:px-12">
                    <div className="flex justify-center">
                        <Shield />
                    </div>
                    <h2 className="mt-4 text-center font-serif text-4xl font-semibold text-[#073d2f]">
                        Sign in to your account
                    </h2>
                    {status && (
                        <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                            {status}
                        </p>
                    )}
                    <form onSubmit={submit} className="mt-8">
                        <label
                            htmlFor="employee_id"
                            className="text-sm font-semibold"
                        >
                            Employee ID
                        </label>
                        <input
                            id="employee_id"
                            autoFocus
                            autoComplete="username"
                            value={data.employee_id}
                            onChange={(e) =>
                                setData("employee_id", e.target.value)
                            }
                            placeholder="Enter your employee ID"
                            className="mt-2 h-14 w-full rounded-lg border border-stone-300 px-4 focus:border-[#0b6548] focus:ring-[#0b6548]"
                        />
                        <InputError
                            message={errors.employee_id}
                            className="mt-2"
                        />
                        <label
                            htmlFor="password"
                            className="mt-6 block text-sm font-semibold"
                        >
                            Password
                        </label>
                        <div className="relative mt-2">
                            <input
                                id="password"
                                type={visible ? "text" : "password"}
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) =>
                                    setData("password", e.target.value)
                                }
                                className="h-14 w-full rounded-lg border border-stone-300 px-4 pr-14 focus:border-[#0b6548] focus:ring-[#0b6548]"
                            />
                            <button
                                type="button"
                                onClick={() => setVisible((v) => !v)}
                                aria-label={
                                    visible ? "Hide password" : "Show password"
                                }
                                className="absolute inset-y-0 right-3 px-2"
                            >
                                {visible ? "◉" : "◎"}
                            </button>
                        </div>
                        <InputError
                            message={errors.password}
                            className="mt-2"
                        />
                        <label className="mt-5 flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={data.remember}
                                onChange={(e) =>
                                    setData("remember", e.target.checked)
                                }
                                className="rounded text-arms-green"
                            />
                            Remember me
                        </label>
                        <button
                            disabled={processing}
                            className="mt-6 h-14 w-full rounded-lg bg-arms-green font-semibold text-white hover:bg-[#064f34] disabled:opacity-60"
                        >
                            {processing ? "Signing in…" : "Sign In"}
                        </button>
                    </form>
                    <div className="mt-8 flex items-center gap-4">
                        <span className="h-px flex-1 bg-stone-200" />
                        <Shield small />
                        <span className="h-px flex-1 bg-stone-200" />
                    </div>
                    <p className="mt-4 text-center text-sm font-medium">
                        Authorized personnel only
                    </p>
                    <p className="mt-2 text-center text-sm text-stone-500">
                        Need help? Contact your system administrator.
                    </p>
                </div>
            </section>
        </main>
    );
}
