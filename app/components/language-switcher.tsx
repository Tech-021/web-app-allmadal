"use client";

import { useLanguage } from "./language-context";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "pill" | "compact";
}

export function LanguageSwitcher({ className = "", variant = "pill" }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => setLanguage(language === "en" ? "ur" : "en")}
        title={language === "en" ? "Switch to Roman Urdu" : "Switch to English"}
        aria-label={language === "en" ? "Switch to Roman Urdu" : "Switch to English"}
        className={`inline-flex h-8 min-h-8 items-center gap-1.5 rounded-lg border px-2 text-[11.5px] font-medium transition-colors duration-150 cursor-pointer max-md:h-10 max-md:min-h-10 max-md:rounded-[11px] ${
          language === "ur"
            ? "bg-[var(--brand-soft)] border-[var(--brand-line)] text-[var(--brand)]"
            : "bg-transparent border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:border-[var(--border)] hover:text-[var(--text)]"
        } ${className}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span>{language === "en" ? "EN" : "UR"}</span>
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language selector"
      className={`inline-flex items-center gap-0.5 rounded-[9px] border border-[var(--border)] bg-[var(--sunken)] p-[3px] text-xs ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={language === "en"}
        onClick={() => setLanguage("en")}
        className={`h-7 min-h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 cursor-pointer max-md:h-9 max-md:min-h-9 ${
          language === "en"
            ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
      >
        English
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={language === "ur"}
        onClick={() => setLanguage("ur")}
        className={`h-7 min-h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors duration-150 cursor-pointer max-md:h-9 max-md:min-h-9 ${
          language === "ur"
            ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
      >
        Roman Urdu
      </button>
    </div>
  );
}
