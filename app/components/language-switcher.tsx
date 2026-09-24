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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border transition shadow-xs cursor-pointer ${
          language === "ur"
            ? "bg-[#e6f4ed] border-[#00875A]/30 text-[#00875A]"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
        } ${className}`}
      >
        <span>🌐</span>
        <span>{language === "en" ? "اردو" : "EN"}</span>
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language selector"
      className={`inline-flex items-center p-0.5 rounded-full bg-gray-100/90 border border-gray-200/80 text-xs font-bold shadow-2xs ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={language === "en"}
        onClick={() => setLanguage("en")}
        className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer ${
          language === "en"
            ? "bg-white text-[#00875A] shadow-xs"
            : "text-gray-500 hover:text-gray-900"
        }`}
      >
        English
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={language === "ur"}
        onClick={() => setLanguage("ur")}
        className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer ${
          language === "ur"
            ? "bg-[#00875A] text-white shadow-xs"
            : "text-gray-500 hover:text-gray-900"
        }`}
      >
        اردو Roman
      </button>
    </div>
  );
}
