"use client";

import type { ReactNode } from "react";
import { BrandMark, Icon } from "@/app/components/icons";
import ob from "./onboarding.module.css";

export type OnboardingStep = { title: string; hint?: string };

type OnboardingFrameProps = {
  /** Small line under the wordmark, e.g. the business name. */
  context?: string;
  railEyebrow: string;
  railTitle: string;
  railText?: string;
  steps: OnboardingStep[];
  /** 1-based index of the active step. */
  current: number;
  topRight?: ReactNode;
  children: ReactNode;
};

/** Guided onboarding layout: step rail (desktop) / progress bar (mobile) + active step card. */
export function OnboardingFrame({ context, railEyebrow, railTitle, railText, steps, current, topRight, children }: OnboardingFrameProps) {
  const active = steps[current - 1];
  return (
    <div className={ob.root}>
      <header className={ob.top}>
        <div className={ob.brand}>
          <BrandMark size={30} />
          <div>
            <strong>Almadel</strong>
            <span>{context || "Store Management"}</span>
          </div>
        </div>
        {topRight ? <div className={ob.topRight}>{topRight}</div> : null}
      </header>

      <div className={ob.layout}>
        <aside className={ob.rail} aria-label="Setup progress">
          <p className={ob.railEyebrow}>{railEyebrow}</p>
          <h2 className={ob.railTitle}>{railTitle}</h2>
          {railText ? <p className={ob.railText}>{railText}</p> : null}
          <ol className={ob.steps}>
            {steps.map((s, i) => {
              const n = i + 1;
              const state = n < current ? ob.stepDone : n === current ? ob.stepCurrent : "";
              return (
                <li key={s.title} className={`${ob.step} ${state}`} aria-current={n === current ? "step" : undefined}>
                  <span className={ob.node}>{n < current ? <Icon name="check" size={13} strokeWidth={2.2} /> : n}</span>
                  <span className={ob.stepText}>
                    <strong>{s.title}</strong>
                    {s.hint ? <span>{s.hint}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className={ob.railNote}>
            <Icon name="lock" size={14} />
            <span>Everything here can be changed later from Settings. Your data is encrypted in transit and at rest.</span>
          </div>
        </aside>

        <main className={ob.main}>
          <div className={ob.mobileProgress} aria-hidden>
            <div>
              <strong>{active?.title}</strong>
              <span>
                {String(current).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
              </span>
            </div>
            <div className={ob.bar}>
              {steps.map((s, i) => (
                <i key={s.title} className={i < current ? ob.barOn : ""} />
              ))}
            </div>
          </div>
          <section className={ob.card} key={current}>
            {children}
          </section>
        </main>
      </div>

      <footer className={ob.footer}>© {new Date().getFullYear()} Almadel · All data is securely encrypted.</footer>
    </div>
  );
}

export function StepHead({ step, total, title, description }: { step?: number; total?: number; title: string; description?: ReactNode }) {
  return (
    <div className={ob.stepHead}>
      {step && total ? (
        <small>
          Step {String(step).padStart(2, "0")} — {String(total).padStart(2, "0")}
        </small>
      ) : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function YesNo({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className={ob.yesNo} role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value} className={value ? ob.yesNoOn : ""} onClick={() => onChange(true)}>
        Yes
      </button>
      <button type="button" role="radio" aria-checked={!value} className={!value ? ob.yesNoOn : ""} onClick={() => onChange(false)}>
        No
      </button>
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <span className={ob.errorText} role="alert">
      <Icon name="alert" size={13} />
      {children}
    </span>
  );
}

export function UserChip({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className={ob.userChip}>
      <i>{initials || "A"}</i>
      <b>{name}</b>
    </span>
  );
}

export function LoadingScreen({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4 text-[13px] text-[var(--muted)]">
        <span className="relative grid place-items-center">
          <BrandMark size={40} />
          <span className="absolute -inset-2 rounded-[14px] border border-[var(--brand-line)] [animation:almadelPulse_1.8s_var(--ease)_infinite]" />
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}
