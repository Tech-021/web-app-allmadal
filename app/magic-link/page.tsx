"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthAlert, AuthButton, AuthShell, Field, authStyles } from "@/app/components/auth-shell";
import { publicApi } from "@/app/lib/api";

export default function MagicLinkRequestPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await publicApi("/auth/magic-link/request", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send sign-in link.");
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
              If an account exists for this email, we sent a one-time sign-in link (valid for 15 minutes):
            </p>
            <p className="mt-1 break-all text-sm font-semibold text-[var(--text)]">{email}</p>
            <p className="mt-3 text-xs text-[var(--faint)]">
              Check spam or junk if it does not arrive within a couple of minutes.
            </p>

            <Link
              href="/login"
              className={`${authStyles.btn} ${authStyles.primary} mt-6`}
            >
              Back to login
            </Link>
          </div>
        ) : (
          <div>
            <h1 className={authStyles.title}>Email sign-in link</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Enter your registered email. We will send a secure link so you can sign in without a password.
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

              <AuthButton state={busy ? "busy" : "idle"} busyLabel="Sending link…">Send sign-in link</AuthButton>
            </form>

            <div className="mt-7 text-center">
              <Link className={authStyles.backLink} href="/login">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Sign in with password
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
