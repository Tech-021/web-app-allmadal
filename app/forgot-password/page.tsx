"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthAlert, AuthButton, AuthShell, Field, authStyles } from "@/app/components/auth-shell";
import { publicApi } from "@/app/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await publicApi("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to request password reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell mode="login">
      <div className="w-full">
        {submitted ? (
          <div className="al-pop rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-7 text-center shadow-[var(--shadow-md)]">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[14px] border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="m-0 text-[24px] font-semibold tracking-[-.025em] text-[var(--text)]">Check your inbox</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Agar yeh email registered hai, tou humne password reset link bhej di hai:
            </p>
            <p className="mt-1 font-semibold text-[var(--text)] text-sm break-all">{email}</p>
            <p className="mt-3 text-xs text-[var(--faint)]">
              Please check your spam or junk folder if you don&apos;t see it within a couple minutes.
            </p>

            <Link
              href="/login"
              className={`${authStyles.btn} ${authStyles.primary} mt-6`}
            >
              Wapas Login Page Par Jayein
            </Link>
          </div>
        ) : (
          <div>
            <h1 className={authStyles.title}>Reset password</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Apna registered email address enter karein. Hum aapko password reset karne ka link bhejenge.
            </p>

            <form className={`mt-7 ${authStyles.fields}`} onSubmit={submit}>
              <Field
                label="Email address"
                name="email"
                type="email"
                placeholder="you@almadel.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <AuthAlert>{error}</AuthAlert>
              )}

              <AuthButton state={busy ? "busy" : "idle"} busyLabel="Sending link…">Reset Link Bhejein</AuthButton>
            </form>

            <div className="mt-7 text-center">
              <Link className={authStyles.backLink} href="/login">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Wapas Login Karein
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
