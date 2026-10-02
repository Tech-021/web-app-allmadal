"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { isRememberAuthPreferred } from "@/app/lib/auth-session";
import { Field } from "./auth-shell";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "./language-context";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, language } = useLanguage();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    setRememberMe(isRememberAuthPreferred());
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = await login({
        email: String(form.get("email")),
        password: String(form.get("password")),
        rememberMe,
      });
      if (user.role === "pending") {
        router.push("/setup-business");
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-.03em] text-[var(--text)]">
        {t("auth.welcome_back", "Welcome back")}
      </h1>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        Apni Dukaan Ko Asaan Banayein. {language === "ur" ? "Credentials enter karein." : "Enter credentials to continue."}
      </p>

      <form className="mt-7 space-y-4.5" onSubmit={submit}>
        <Field
          label={t("auth.email", "Email address")}
          name="email"
          type="email"
          placeholder="you@almadel.com"
          autoComplete="email"
          required
        />
        <Field
          label={t("auth.password", "Password")}
          name="password"
          type={show ? "text" : "password"}
          placeholder={language === "ur" ? "Apna password darj karein" : "Enter your password"}
          autoComplete="current-password"
          minLength={8}
          required
          right={
            <button
              className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[var(--muted)] transition hover:text-[var(--brand)] cursor-pointer"
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? (language === "ur" ? "Chupayein" : "Hide") : (language === "ur" ? "Dikhayein" : "Show")}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-medium text-[var(--text-2)] cursor-pointer">
            <input
              className="accent-[var(--brand)] rounded"
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t("auth.remember_me", "Remember me")}
          </label>
          <Link className="font-medium text-[var(--brand)] transition hover:underline" href="/forgot-password">
            {t("auth.forgot_password", "Forgot Password?")}
          </Link>
        </div>

        {error && (
          <p role="alert" className="al-pop rounded-[10px] border border-[color-mix(in_oklab,var(--neg)_25%,transparent)] bg-[var(--neg-soft)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--neg)]">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-11 w-full rounded-[10px] bg-[var(--brand)] text-[14px] font-medium text-[var(--on-brand)] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(10,94,72,.3)] transition-[background-color,transform] duration-150 hover:bg-[var(--brand-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {busy ? t("auth.signing_in", "Signing in…") : t("auth.login", "Login Karein")}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg)] px-2 text-[var(--faint)]">or</span>
          </div>
        </div>

        <Link
          href="/magic-link"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[14px] font-medium text-[var(--text)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
        >
          {t("auth.magic_link", "Email me a sign-in link")}
        </Link>
      </form>

      <p className="mt-7 text-center text-xs font-medium text-[var(--muted)]">
        Don&apos;t have an account?{" "}
        <Link className="font-medium text-[var(--brand)] hover:underline" href="/signup">
          Naya Account Banayein
        </Link>
      </p>
    </div>
  );
}
