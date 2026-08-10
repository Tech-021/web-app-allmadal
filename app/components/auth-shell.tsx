import Link from "next/link";

function Mark() {
  return <div className="grid size-11 place-items-center rounded-xl bg-[#1d4934] text-lg font-bold text-white shadow-[0_8px_24px_rgba(29,73,52,.2)]">AM</div>;
}

export function AuthShell({ children, mode }: { children: React.ReactNode; mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen bg-[#f6f7f5] lg:grid lg:grid-cols-[minmax(420px,46%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#173d2b] px-14 py-12 text-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-36 -left-20 size-[430px] rounded-full bg-[#285b43] opacity-70" />
        <div className="relative flex items-center gap-3"><Mark /><div><p className="text-lg font-semibold tracking-tight">Al Madel</p><p className="text-xs text-white/55">Management Portal</p></div></div>
        <div className="relative my-auto max-w-lg py-20">
          <p className="mb-5 text-xs font-bold uppercase tracking-[.22em] text-[#a7ceb7]">One team. One workspace.</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-.04em]">Everything your team needs, in one place.</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-white/65">A secure workspace built to help Al Madel teams stay connected, organized, and moving forward.</p>
        </div>
        <p className="relative text-xs text-white/40">© 2026 Al Madel. All rights reserved.</p>
      </aside>
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden"><Mark /><span className="font-semibold">Al Madel</span></div>
          <p className="text-sm text-[#65716a]">{mode === "login" ? "New to Al Madel?" : "Already have an account?"} <Link className="ml-1 font-semibold text-[#1d4934] hover:underline" href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create account" : "Sign in"}</Link></p>
        </header>
        <div className="mx-auto flex w-full max-w-[450px] flex-1 items-center py-12">{children}</div>
      </section>
    </main>
  );
}

export function Field({ label, error, right, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; right?: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-[#263a30]">{label}</span><span className={`relative block rounded-xl border bg-white transition focus-within:border-[#1d4934] focus-within:ring-4 focus-within:ring-[#1d4934]/8 ${error ? "border-red-400" : "border-[#dce2de]"}`}><input {...props} className="h-12 w-full rounded-xl bg-transparent px-4 pr-12 text-[15px] outline-none placeholder:text-[#a2aaa5]" />{right}</span>{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>;
}
