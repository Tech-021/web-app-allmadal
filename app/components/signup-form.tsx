"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./auth-shell";
import { useAuth } from "@/hooks/useAuth";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await signup({ name: String(form.get("name")), email: String(form.get("email")), password });
      router.push("/setup-business");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create your business account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-.03em] text-[var(--text)]">Create Owner Account</h1>
      <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
        Register as a store owner to set up your store, manage inventory, sales, and employee accounts.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3.5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--brand)] shadow-[inset_0_0_0_1px_var(--brand-line)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6" /></svg>
        </span>
        <div>
          <p className="m-0 text-[13px] font-medium text-[var(--text)]">Store Owner Account</p>
          <p className="m-0 text-[12px] text-[var(--brand-ink)]">You will be guided to configure your business right after signup.</p>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field label="Owner full name" name="name" placeholder="e.g. Muhammad Aslam" autoComplete="name" minLength={2} required />
        <Field label="Business / Owner email" name="email" type="email" placeholder="owner@almadina.com" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type={show ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
          right={
            <button
              className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[var(--muted)] hover:text-[var(--brand)]"
              type="button"
              onClick={() => setShow(!show)}
            >
              {show ? "Hide" : "Show"}
            </button>
          }
        />
        <Field label="Confirm password" name="confirmPassword" type={show ? "text" : "password"} placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />

        <label className="flex items-start gap-2.5 text-xs leading-5 font-medium text-[var(--muted)] cursor-pointer">
          <input className="mt-0.5 accent-[var(--brand)] rounded" type="checkbox" required />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {error && (
          <p role="alert" className="al-pop rounded-[10px] border border-[color-mix(in_oklab,var(--neg)_25%,transparent)] bg-[var(--neg-soft)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--neg)]">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-11 w-full rounded-[10px] bg-[var(--brand)] text-[14px] font-medium text-[var(--on-brand)] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(10,94,72,.3)] transition-[background-color,transform] duration-150 hover:bg-[var(--brand-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Creating account…" : "Create account & set up business"}
        </button>
      </form>
    </div>
  );
}
