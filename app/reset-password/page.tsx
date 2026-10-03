"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthAlert, AuthButton, AuthShell, AuthStateIcon, Field, authStyles } from "@/app/components/auth-shell";
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
        <AuthStateIcon icon="alert" tone="neg" />
        <h1 className={authStyles.title}>Invalid link</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This password reset link is missing or incomplete. Request a new one from the login page.
        </p>
        <Link
          href="/forgot-password"
          className={`${authStyles.btn} ${authStyles.primary} mt-6`}
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="al-pop rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-7 text-center shadow-[var(--shadow-md)]">
        <AuthStateIcon icon="check" />
        <h1 className="m-0 text-[24px] font-semibold tracking-[-.025em] text-[var(--text)]">Password updated</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">You can sign in with your new password.</p>
        <Link
          href="/login"
          className={`${authStyles.btn} ${authStyles.primary} mt-6`}
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className={authStyles.title}>Choose a new password</h1>
      <p className="mt-1.5 text-sm text-[var(--muted)]">Enter a new password for your Almadel account.</p>

      <form className={`mt-7 ${authStyles.fields}`} onSubmit={submit}>
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
          <AuthAlert>{error}</AuthAlert>
        )}

        <AuthButton state={busy ? "busy" : "idle"} busyLabel="Saving…">Update password</AuthButton>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell mode="login">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
