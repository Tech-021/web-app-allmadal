import Link from "next/link";

export function AlmadelLogoMark() {
  return (
    <div className="grid size-11 place-items-center rounded-2xl bg-[#00875A] text-white shadow-[0_8px_20px_rgba(0,135,90,.22)]">
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    </div>
  );
}

export function AuthShell({ children, mode }: { children: React.ReactNode; mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen bg-[#f7f9f8] lg:grid lg:grid-cols-[minmax(420px,46%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#056839] px-14 py-12 text-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-36 -left-20 size-[430px] rounded-full bg-[#00875A] opacity-60 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <AlmadelLogoMark />
          <div>
            <p className="text-xl font-extrabold tracking-tight">Almadel</p>
            <p className="text-xs font-medium text-white/70">Apni Dukaan Ko Asaan Banayein</p>
          </div>
        </div>
        <div className="relative my-auto max-w-lg py-20">
          <p className="mb-5 text-xs font-extrabold uppercase tracking-[.22em] text-[#a1f0c7]">One team. One workspace.</p>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-[-.04em]">Apni Dukaan Ko Asaan Banayein.</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-white/75">Complete store management, inventory tracking, POS billing, and staff management in one secure workspace.</p>
        </div>
        <p className="relative text-xs text-white/40">© 2026 Almadel. All rights reserved.</p>
      </aside>
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between lg:justify-end pb-4 border-b border-gray-100 lg:border-0 lg:pb-0">
          <div className="flex items-center gap-2.5 lg:hidden">
            <AlmadelLogoMark />
            <span className="font-extrabold text-base text-[#111827]">Almadel</span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#4b5563]">
            {mode === "login" ? "New to Almadel?" : "Already have an account?"}{" "}
            <Link className="ml-1 font-bold text-[#00875A] transition hover:underline" href={mode === "login" ? "/signup" : "/login"}>
              {mode === "login" ? "Naya Account Banayein" : "Sign in"}
            </Link>
          </p>
        </header>
        <div className="mx-auto flex w-full max-w-[450px] flex-1 items-center py-12">{children}</div>
      </section>
    </main>
  );
}

export function Field({ label, error, right, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; right?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#374151]">{label}</span>
      <span className={`relative block rounded-2xl border bg-white transition-all duration-200 focus-within:border-[#00875A] focus-within:ring-4 focus-within:ring-[#00875A]/12 ${error ? "border-red-400" : "border-[#e5e7eb]"}`}>
        <input {...props} className="h-12.5 w-full rounded-2xl bg-transparent px-4 pr-12 text-[14.5px] outline-none placeholder:text-[#9ca3af] font-medium" />
        {right}
      </span>
      {error && <span className="mt-1.5 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  );
}

