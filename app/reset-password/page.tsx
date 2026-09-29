"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell, Field } from "@/app/components/auth-shell";
import { publicApi } from "@/app/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid. Request a new link from the login page.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await publicApi("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full">
        <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Invalid link</h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          This password reset link is missing or incomplete. Request a new one from the login page.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#00875A] font-bold text-white shadow-md transition hover:bg-[#006b3f]"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-[0_20px_50px_rgba(0,135,90,.07)]">
        <h1 className="text-2xl font-extrabold text-[#111827]">Password updated</h1>
        <p className="mt-2 text-sm text-[#6b7280]">You can sign in with your new password.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#00875A] font-bold text-white shadow-md transition hover:bg-[#006b3f]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-[#6b7280]">Enter a new password for your Almadel account.</p>

      <form className="mt-7 space-y-4.5" onSubmit={submit}>
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-12.5 w-full rounded-full bg-[#00875A] font-extrabold text-white shadow-[0_8px_20px_rgba(0,135,90,.22)] transition-all duration-200 hover:bg-[#006b3f] disabled:cursor-not-allowed disabled:opacity-60 text-sm tracking-wide cursor-pointer"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell mode="login">
      <Suspense
        fallback={
          <p className="text-sm text-[#6b7280]">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
