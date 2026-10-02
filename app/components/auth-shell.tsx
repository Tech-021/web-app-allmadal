import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";

import { BrandMark, Icon, type IconName } from "./icons";

export function AlmadelLogoMark() {
  return <BrandMark size={40} />;
}

const FEATURES: Array<{ title: string; body: string; d: string }> = [
  {
    title: "POS billing in seconds",
    body: "Barcode scanning, discounts, khata customers and printed receipts at the counter.",
    d: "M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5M7 8v8M10 8v8M13.5 8v8M17 8v8",
  },
  {
    title: "Books that balance",
    body: "Cash, accounts, customer khata, suppliers, expenses and daily closing.",
    d: "M3 3v18h18M7 15l4-4 3 3 5-6",
  },
  {
    title: "One team, one workspace",
    body: "Owner, staff and accountant roles with live updates across counters.",
    d: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  },
];

export function AuthShell({ children, mode }: { children: React.ReactNode; mode: "login" | "signup" }) {
  return (
    <main className="min-h-screen bg-[var(--bg)] lg:grid lg:grid-cols-[minmax(440px,44%)_1fr]">
      <aside
        data-theme="dark"
        className="relative hidden overflow-hidden bg-[#090b0c] px-12 py-11 text-[#eceeef] lg:flex lg:min-h-screen lg:flex-col xl:px-16"
      >
        {/* restrained jade horizon light */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[radial-gradient(80%_70%_at_30%_100%,rgba(60,203,154,.16),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[.35] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(60,203,154,.5)] to-transparent" />

        <div className="relative flex items-center gap-3 al-page-enter">
          <AlmadelLogoMark />
          <div>
            <p className="m-0 text-[17px] font-semibold tracking-[-0.015em]">Almadel</p>
            <p className="m-0 text-xs text-[#80888f]">Store Management</p>
          </div>
        </div>

        <div className="relative my-auto max-w-[460px] py-16">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[.14em] text-[#3ccb9a]">One team. One workspace.</p>
          <h1 className="m-0 text-[44px] font-semibold leading-[1.06] tracking-[-.04em] text-[#f6f7f7]">
            Apni Dukaan Ko
            <br />
            Asaan Banayein.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-[#a9b0b6]">
            Complete store management, inventory tracking, POS billing, and staff management in one secure workspace.
          </p>
          <ul className="al-stagger mt-10 flex list-none flex-col gap-0 p-0">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4 border-t border-[rgba(255,255,255,.07)] py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[rgba(255,255,255,.08)] bg-[rgba(255,255,255,.03)] text-[#3ccb9a]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={f.d} />
                  </svg>
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-[#eceeef]">{f.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-[#80888f]">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative m-0 text-xs text-[#5f676e]">© 2026 Almadel. All rights reserved.</p>
      </aside>
      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--border)] lg:border-0 lg:pb-0">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size={32} />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">Almadel</span>
          </div>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher variant="pill" />
            <p className="m-0 hidden text-[13px] text-[var(--muted)] sm:block">
              {mode === "login" ? "New to Almadel?" : "Already have an account?"}{" "}
              <Link className="ml-1 font-medium text-[var(--brand)] transition hover:underline" href={mode === "login" ? "/signup" : "/login"}>
                {mode === "login" ? "Naya Account Banayein" : "Sign in"}
              </Link>
            </p>
          </div>
        </header>
        <div className="al-page-enter mx-auto flex w-full max-w-[420px] flex-1 items-center py-10 sm:py-12">{children}</div>
      </section>
    </main>
  );
}

export function Field({ label, error, right, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; right?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--text-2)]">{label}</span>
      <span
        className={`relative block rounded-[10px] border bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--ring)] ${
          error ? "border-[var(--neg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
        }`}
      >
        <input
          {...props}
          className="h-11 w-full rounded-[10px] bg-transparent px-3.5 pr-14 text-[14.5px] text-[var(--text)] outline-none placeholder:text-[var(--faint)] max-sm:text-[16px]"
        />
        {right}
      </span>
      {error && <span className="mt-1.5 block text-xs font-medium text-[var(--neg)]">{error}</span>}
    </label>
  );
}

const STATE_TONE = {
  pos: "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]",
  neg: "border-[color-mix(in_oklab,var(--neg)_25%,transparent)] bg-[var(--neg-soft)] text-[var(--neg)]",
  warn: "border-[color-mix(in_oklab,var(--warn)_25%,transparent)] bg-[var(--warn-soft)] text-[var(--warn)]",
} as const;

/** Status seal shown above auth result states (link sent, invalid, expired, updated). */
export function AuthStateIcon({ icon, tone = "pos" }: { icon: IconName; tone?: keyof typeof STATE_TONE }) {
  return (
    <span className={`mb-5 inline-grid size-12 place-items-center rounded-[14px] border [animation:almadelScaleUp_420ms_var(--ease-spring)_backwards] ${STATE_TONE[tone]}`}>
      <Icon name={icon} size={22} />
    </span>
  );
}
