"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { useLanguage } from "./language-context";
import { BrandMark, Icon, type IconName } from "./icons";
import { CounterStory, SignupStory } from "./auth-story";
import { DUR, EASE, EASE_EXIT, Reveal } from "./motion";
import s from "./auth.module.css";

export function AlmadelLogoMark() {
  return <BrandMark size={40} />;
}

/**
 * Any AuthButton that is busy (or done and navigating) lights the top sweep loader,
 * so every auth page gets the AuthMobile board's loader without wiring it by hand.
 */
const AuthBusyContext = createContext<((busy: boolean) => void) | null>(null);

/** Height-animated reveal for messages that push the form down (errors, alerts). */
const collapse = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { height: { duration: DUR.sheet, ease: EASE }, opacity: { duration: DUR.pop, delay: 0.06 } } },
  exit: { opacity: 0, height: 0, transition: { height: { duration: DUR.pop, ease: EASE_EXIT }, opacity: { duration: DUR.press } } },
};

export function AuthShell({ children, mode, busy }: { children: ReactNode; mode: "login" | "signup"; busy?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const [formBusy, setFormBusy] = useState(false);
  const loading = Boolean(busy) || formBusy;
  return (
    <AuthBusyContext.Provider value={setFormBusy}>
      <main className={`${s.page} ${mode === "signup" ? s.pageSignup : ""}`} aria-busy={loading || undefined}>
        <AnimatePresence>
          {loading && (
            <motion.div
              key="sweep"
              className={s.sweep}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: DUR.sheet } }}
            >
              <i />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign in: a live demo counter (decorative). Sign up: the steps ahead, mirrored to the right. */}
        <aside
          className={s.aside}
          data-theme="dark"
          aria-hidden={mode === "login" ? true : undefined}
          aria-label={mode === "signup" ? "What happens next" : undefined}
        >
          <div className={s.asideRules} />
          <div className={s.asideGlow} />
          <div className={`${s.brand} ${mode === "signup" ? s.narrowOnly : ""}`}>
            <BrandMark size={30} />
            Almadel
          </div>

          {mode === "login" ? <CounterStory /> : <SignupStory />}

          <div className={`${s.tagline} ${mode === "signup" ? s.narrowOnly : ""}`}>
            <p>
              Run the counter.
              <br />
              Keep the books.
            </p>
            <p>Dukaan bhi, hisaab bhi.</p>
          </div>
        </aside>

        <section className={s.main}>
          <div className={s.topRow}>
            {mode === "signup" ? (
              <span className={s.topBrand}>
                <BrandMark size={26} />
                Almadel
              </span>
            ) : null}
            <span>{mode === "login" ? "New to Almadel?" : "Already have an account?"}</span>
            <Link href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link>
          </div>
          <div className={s.formWrap}>{children}</div>
          <div className={s.foot}>
            <span>© Almadel</span>
            <span>
              {language === "en" ? (
                <>
                  English ·{" "}
                  <button type="button" className={s.langLink} onClick={() => setLanguage("ur")}>
                    Roman Urdu
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={s.langLink} onClick={() => setLanguage("en")}>
                    English
                  </button>{" "}
                  · Roman Urdu
                </>
              )}
            </span>
          </div>
        </section>
      </main>
    </AuthBusyContext.Provider>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
  label: ReactNode;
  /** Text after the label, quieter (e.g. "· for receipts and recovery"). */
  hint?: ReactNode;
  /** Right side of the label row (e.g. a "Forgot?" link). */
  labelAside?: ReactNode;
  error?: ReactNode;
  /** Error styling without a message under the field (e.g. the server rejected the password). */
  invalid?: boolean;
  /** Control placed inside the input on the right (e.g. the show-password button). */
  right?: ReactNode;
  children?: ReactNode;
};

/** Labelled auth input. Errors slide open under the field and are linked with aria-describedby. */
export function Field({ label, hint, labelAside, error, invalid, right, children, id, className, ref, ...props }: FieldProps) {
  const autoId = useId();
  const isInvalid = Boolean(error) || Boolean(invalid);
  const inputId = id || `f-${autoId}`;
  const errorId = `${inputId}-err`;
  return (
    <div className={s.field}>
      <div className={s.label}>
        <label htmlFor={inputId}>
          {label}
          {hint ? <span className={s.hint}> {hint}</span> : null}
        </label>
        {labelAside}
      </div>
      <div className={s.control}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          aria-invalid={isInvalid || undefined}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={`${s.input} ${right ? s.inputWithAction : ""} ${isInvalid ? s.invalid : ""} ${className || ""}`.trim()}
        />
        {right}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.div key="error" className={s.collapse} {...collapse}>
            <div id={errorId} className={s.fieldError}>
              <Icon name="alert" size={13} />
              <span>{error}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </div>
  );
}

const EYE_OPEN = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const EYE_SHUT =
  "M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2";

/** Eye button for password fields; the glyph cross-fades between states. */
export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={s.eye} onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.svg
          key={shown ? "shut" : "open"}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: DUR.press, ease: EASE }}
        >
          <path d={shown ? EYE_SHUT : EYE_OPEN} />
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}

/** Password field with its own show/hide state. */
export function PasswordField(props: Omit<FieldProps, "type" | "right"> & { shown?: boolean; onToggle?: () => void }) {
  const [own, setOwn] = useState(false);
  const shown = props.shown ?? own;
  const { shown: _shown, onToggle, children, ...rest } = props;
  void _shown;
  return (
    <Field {...rest} type={shown ? "text" : "password"} right={<PasswordToggle shown={shown} onToggle={onToggle ?? (() => setOwn((v) => !v))} />}>
      {children}
    </Field>
  );
}

export function Checkbox({ checked, onChange, children, name, required }: { checked?: boolean; onChange?: (v: boolean) => void; children: ReactNode; name?: string; required?: boolean }) {
  return (
    <label className={s.check}>
      <input type="checkbox" name={name} required={required} checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
      <span className={s.box} aria-hidden>
        <Icon name="check" size={11} strokeWidth={2.6} />
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Check mark that draws itself (button success state). */
function DrawnCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d="M20 6L9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.36, delay: 0.08, ease: EASE }} />
    </svg>
  );
}

/**
 * Auth submit button. The originating control carries the loading state; "done" shows
 * the outcome while the next page loads. Each state's label rolls in from below.
 */
export function AuthButton({
  state = "idle",
  children,
  busyLabel,
  doneLabel,
  variant = "primary",
  type = "submit",
  disabled,
  onClick,
}: {
  state?: "idle" | "busy" | "done";
  children: ReactNode;
  busyLabel?: ReactNode;
  doneLabel?: ReactNode;
  variant?: "primary" | "secondary";
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const reportBusy = useContext(AuthBusyContext);
  const working = state !== "idle";
  useEffect(() => {
    if (!reportBusy || variant !== "primary") return;
    reportBusy(working);
    return () => reportBusy(false);
  }, [reportBusy, working, variant]);

  return (
    <button
      type={type}
      className={`${s.btn} ${variant === "primary" ? s.primary : ""}`}
      disabled={disabled || working}
      aria-busy={state === "busy"}
      data-state={state}
      onClick={onClick}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className={s.btnLabel}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: DUR.sheet, ease: EASE } }}
          exit={{ opacity: 0, y: -12, transition: { duration: DUR.pop, ease: EASE_EXIT } }}
        >
          {state === "busy" ? (
            <>
              <span className={s.spin} aria-hidden />
              {busyLabel ?? children}
            </>
          ) : state === "done" ? (
            <>
              <DrawnCheck />
              {doneLabel ?? children}
            </>
          ) : (
            children
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function AuthLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.btn}>
      {children}
    </Link>
  );
}

/** Inline alert. Inside an AnimatePresence it also slides closed when it goes away. */
export function AuthAlert({ tone = "neg", id, children }: { tone?: "neg" | "pos"; id?: string; children: ReactNode }) {
  return (
    <motion.div className={s.collapse} {...collapse}>
      <div id={id} role={tone === "neg" ? "alert" : "status"} className={`${s.alert} ${tone === "neg" ? s.alertNeg : s.alertPos}`}>
        <Icon name={tone === "neg" ? "alert" : "check"} size={16} />
        <div>{children}</div>
      </div>
    </motion.div>
  );
}

export function AuthDivider({ children = "or" }: { children?: ReactNode }) {
  return <div className={s.divider}>{children}</div>;
}

/** Title block: optional step marker, heading and one-line lede. Each rises in turn inside a RevealGroup. */
export function AuthHeading({ step, title, lede }: { step?: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <div>
      {step ? (
        <Reveal>
          <div className={s.step}>{step}</div>
        </Reveal>
      ) : null}
      <Reveal>
        <h1 className={s.title}>{title}</h1>
      </Reveal>
      {lede ? (
        <Reveal>
          <p className={s.lede}>{lede}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

export const authStyles = s;

/** Status seal shown above auth result states (link sent, invalid, expired, updated). */
export function AuthStateIcon({ icon, tone = "pos" }: { icon: IconName; tone?: "pos" | "neg" | "warn" }) {
  return (
    <span className={`${s.seal} ${s[`seal_${tone}`]}`}>
      <Icon name={icon} size={22} />
    </span>
  );
}
