"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell, Field } from "@/app/components/auth-shell";
import { api } from "@/app/lib/api";

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
      await api("/auth/forgot-password", {
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
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-[0_20px_50px_rgba(0,135,90,.07)]">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-[#00875A]">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-[#111827]">Check your inbox</h1>
            <p className="mt-2 text-sm text-[#6b7280]">
              Agar yeh email registered hai, tou humne password reset link bhej di hai:
            </p>
            <p className="mt-1 font-semibold text-[#111827] text-sm break-all">{email}</p>
            <p className="mt-3 text-xs text-[#9ca3af]">
              Please check your spam or junk folder if you don&apos;t see it within a couple minutes.
            </p>

            <Link
              href="/login"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#00875A] font-bold text-white shadow-md transition hover:bg-[#006b3f]"
            >
              Wapas Login Page Par Jayein
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Reset password</h1>
            <p className="mt-1.5 text-sm text-[#6b7280]">
              Apna registered email address enter karein. Hum aapko password reset karne ka link bhejenge.
            </p>

            <form className="mt-7 space-y-4.5" onSubmit={submit}>
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
                <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
                  {error}
                </p>
              )}

              <button
                disabled={busy}
                className="h-12.5 w-full rounded-full bg-[#00875A] font-extrabold text-white shadow-[0_8px_20px_rgba(0,135,90,.22)] transition-all duration-200 hover:bg-[#006b3f] hover:shadow-[0_10px_24px_rgba(0,135,90,.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 text-sm tracking-wide cursor-pointer"
              >
                {busy ? "Sending link…" : "Reset Link Bhejein"}
              </button>
            </form>

            <div className="mt-7 text-center">
              <Link className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00875A] hover:underline" href="/login">
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
