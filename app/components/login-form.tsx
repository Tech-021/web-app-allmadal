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
      <h1 className="text-[2rem] font-extrabold tracking-[-.035em] text-[#111827]">
        {t("auth.welcome_back", "Welcome back")}
      </h1>
      <p className="mt-1.5 text-sm text-[#6b7280]">
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
              className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[#6b7280] transition hover:text-[#00875A] cursor-pointer"
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? (language === "ur" ? "Chupayein" : "Hide") : (language === "ur" ? "Dikhayein" : "Show")}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-medium text-[#4b5563] cursor-pointer">
            <input
              className="accent-[#00875A] rounded"
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t("auth.remember_me", "Remember me")}
          </label>
          <Link className="font-bold text-[#00875A] transition hover:underline" href="/forgot-password">
            {t("auth.forgot_password", "Forgot Password?")}
          </Link>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="h-12.5 w-full rounded-full bg-[#00875A] font-extrabold text-white shadow-[0_8px_20px_rgba(0,135,90,.22)] transition-all duration-200 hover:bg-[#006b3f] hover:shadow-[0_10px_24px_rgba(0,135,90,.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 text-sm tracking-wide cursor-pointer"
        >
          {busy ? t("auth.signing_in", "Signing in…") : t("auth.login", "Login Karein")}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-[#e5e7eb]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 font-medium text-[#9ca3af]">or</span>
          </div>
        </div>

        <Link
          href="/magic-link"
          className="flex h-12.5 w-full items-center justify-center rounded-full border-2 border-[#00875A] bg-white font-extrabold text-[#00875A] text-sm tracking-wide transition hover:bg-emerald-50"
        >
          {t("auth.magic_link", "Email me a sign-in link")}
        </Link>
      </form>

      <p className="mt-7 text-center text-xs font-medium text-[#6b7280]">
        Don&apos;t have an account?{" "}
        <Link className="font-bold text-[#00875A] hover:underline" href="/signup">
          Naya Account Banayein
        </Link>
      </p>
    </div>
  );
}
