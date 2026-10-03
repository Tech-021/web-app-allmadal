"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, useAnimate, useReducedMotion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { isRememberAuthPreferred } from "@/app/lib/auth-session";
import { AuthAlert, AuthButton, AuthDivider, AuthHeading, AuthLinkButton, Checkbox, Field, PasswordField, authStyles as s } from "./auth-shell";
import { Reveal, RevealGroup } from "./motion";
import { useToast } from "./toast-context";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "./language-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const noSubscribe = () => () => {};

export function LoginForm({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [fieldsScope, animateFields] = useAnimate<HTMLDivElement>();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  // The stored preference seeds the checkbox (read after hydration); a click overrides it.
  const storedRemember = useSyncExternalStore(noSubscribe, isRememberAuthPreferred, () => true);
  const [rememberChoice, setRememberMe] = useState<boolean | null>(null);
  const rememberMe = rememberChoice ?? storedRemember;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ur = (en: string, urdu: string) => (language === "ur" ? urdu : en);

  useEffect(() => {
    onBusyChange?.(state !== "idle");
  }, [state, onBusyChange]);

  /** The credentials block shakes once when the server turns them down, as a login window does. */
  function shake() {
    if (reduceMotion || !fieldsScope.current) return;
    void animateFields(fieldsScope.current, { x: [0, -9, 8, -6, 4, -2, 0] }, { duration: 0.46, ease: "easeInOut" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = ur("Enter the email you signed up with.", "Woh email likhein jis se account banaya tha.");
    else if (!EMAIL_RE.test(email.trim())) errs.email = ur("Use a full email address, like name@shop.pk.", "Poora email likhein, jaise name@shop.pk.");
    if (!password) errs.password = ur("Enter your password.", "Apna password likhein.");
    else if (password.length < 8) errs.password = ur("Passwords are at least 8 characters.", "Password kam az kam 8 haroof ka hota hai.");
    setFieldErrors(errs);
    setError("");
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return passwordRef.current?.focus();

    setState("busy");
    try {
      const user = await login({ email: email.trim(), password, rememberMe });
      setState("done");
      const firstName = user.name.split(" ")[0];
      showToast(ur("Signed in", "Sign in ho gaya"), "success", {
        description: ur(`Welcome back, ${firstName}. Opening today’s counter.`, `Khush aamdeed, ${firstName}. Aaj ka counter khul raha hai.`),
        duration: 4000,
      });
      router.push(user.role === "pending" ? "/setup-business" : "/dashboard");
    } catch (e) {
      // Commit first: the password field is still disabled until "idle" renders, and a disabled field can't take focus.
      flushSync(() => {
        setError(e instanceof Error ? e.message : "Unable to sign in.");
        setState("idle");
      });
      shake();
      passwordRef.current?.focus();
    }
  }

  const locked = state !== "idle";

  return (
    <RevealGroup className="w-full">
      <AuthHeading
        title={t("auth.welcome_back", "Welcome back")}
        lede={ur("Sign in to open today’s counter and books.", "Aaj ka counter aur hisaab kholne ke liye sign in karein.")}
      />

      <AnimatePresence initial={false}>
        {error && (
          <AuthAlert key="auth-error" id="login-auth-error">
            <b className="font-semibold">{ur("We couldn’t sign you in.", "Sign in nahi ho saka.")}</b> {error}{" "}
            <Link href="/forgot-password">{ur("Reset your password by email", "Email se password reset karein")}</Link>.
          </AuthAlert>
        )}
      </AnimatePresence>

      <form onSubmit={submit} noValidate>
        <div ref={fieldsScope} className={s.fields}>
          <Reveal>
            <Field
              ref={emailRef}
              label={t("auth.email", "Email address")}
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@shop.pk"
              autoComplete="username"
              value={email}
              disabled={locked}
              error={fieldErrors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
            />
          </Reveal>
          <Reveal>
            <PasswordField
              ref={passwordRef}
              label={t("auth.password", "Password")}
              labelAside={<Link href="/forgot-password">{ur("Forgot?", "Bhool gaye?")}</Link>}
              name="password"
              placeholder={ur("At least 8 characters", "Kam az kam 8 haroof")}
              autoComplete="current-password"
              value={password}
              disabled={locked}
              error={fieldErrors.password}
              invalid={Boolean(error)}
              aria-describedby={error ? "login-auth-error" : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                if (error) setError("");
              }}
            />
          </Reveal>
        </div>

        <Reveal className={s.optionsRow}>
          <Checkbox checked={rememberMe} onChange={setRememberMe} name="remember">
            {ur("Keep me signed in on this device", "Is device par sign in rehne dein")}
          </Checkbox>
        </Reveal>

        <Reveal>
          <AuthButton state={state} busyLabel={t("auth.signing_in", "Signing in…")} doneLabel={ur("Opening your workspace…", "Workspace khul raha hai…")}>
            {ur("Sign in", "Sign in karein")}
          </AuthButton>

          <AuthDivider>{ur("or", "ya")}</AuthDivider>

          <AuthLinkButton href="/magic-link">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 5h18v14H3zM3 6l9 7 9-7" />
            </svg>
            {t("auth.magic_link", "Email me a sign-in link")}
          </AuthLinkButton>
        </Reveal>
      </form>
    </RevealGroup>
  );
}
