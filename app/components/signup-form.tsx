"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthButton, AuthHeading, Checkbox, Field, PasswordField, authStyles as s } from "./auth-shell";
import { useAuth } from "@/hooks/useAuth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 0–4: length, mixed case, digit, symbol. */
function strengthOf(pw: string) {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (pw.length >= 8 && /\d/.test(pw)) score += 1;
  if (pw.length >= 8 && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

const STRENGTH_COPY = [
  "At least 8 characters.",
  "Okay. Mix upper and lower case to make it stronger.",
  "Good. Add a number.",
  "Strong. Add a symbol to make it excellent.",
  "Excellent.",
];

type Errors = Partial<Record<"name" | "email" | "password" | "confirmPassword" | "terms", string>>;

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;
    const errs: Errors = {};
    if (values.name.trim().length < 2) errs.name = "Enter your full name.";
    if (!EMAIL_RE.test(values.email.trim())) errs.email = "Use a full email address, like name@shop.pk.";
    if (values.password.length < 8) errs.password = "Use at least 8 characters.";
    if (!errs.password && values.password !== values.confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (!terms) errs.terms = "Please accept the terms to continue.";
    setErrors(errs);
    setError("");
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`su-${first}`)?.focus();
      return;
    }

    setState("busy");
    try {
      await signup({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      setState("done");
      router.push("/setup-business");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create your business account.");
      setState("idle");
    }
  }

  const strength = strengthOf(values.password);
  const locked = state !== "idle";

  return (
    <div className="w-full">
      <AuthHeading step="STEP 1 · YOUR ACCOUNT" title="Create your account" lede="Register as the store owner. You’ll set up your shop right after." />

      {error && <AuthAlert>{error}</AuthAlert>}

      <form onSubmit={submit} noValidate>
        <div className={s.fields}>
          <Field id="su-name" label="Your name" name="name" placeholder="e.g. Muhammad Aslam" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} disabled={locked} />
          <Field
            id="su-email"
            label="Email"
            hint="· for receipts and recovery"
            name="email"
            type="email"
            inputMode="email"
            placeholder="owner@shop.pk"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
            error={errors.email}
            disabled={locked}
          />
          <PasswordField
            id="su-password"
            label="Password"
            name="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            error={errors.password}
            disabled={locked}
            shown={show}
            onToggle={() => setShow((v) => !v)}
            aria-describedby="su-strength"
          >
            {values.password && !errors.password ? (
              <>
                <div className={s.strength} aria-hidden>
                  {[1, 2, 3, 4].map((n) => (
                    <i key={n} style={strength >= n ? { background: strength <= 1 ? "var(--warn)" : "var(--brand)" } : undefined} />
                  ))}
                </div>
                <div id="su-strength" className={s.strengthText} aria-live="polite">
                  {STRENGTH_COPY[strength]}
                </div>
              </>
            ) : null}
          </PasswordField>
          <PasswordField
            id="su-confirmPassword"
            label="Confirm password"
            name="confirmPassword"
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            disabled={locked}
            shown={show}
            onToggle={() => setShow((v) => !v)}
          />
          <div>
            <Checkbox
              checked={terms}
              onChange={(v) => {
                setTerms(v);
                if (errors.terms) setErrors((x) => ({ ...x, terms: undefined }));
              }}
            >
              I agree to the Terms of Service and Privacy Policy.
            </Checkbox>
            {errors.terms ? (
              <div className={s.fieldError} role="alert">
                {errors.terms}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <AuthButton state={state} busyLabel="Creating account…" doneLabel="Account created — setting up your shop">
            Create account
          </AuthButton>
        </div>
        <p className={s.fine}>Your shop, staff and books are set up in the next step.</p>
      </form>
    </div>
  );
}
