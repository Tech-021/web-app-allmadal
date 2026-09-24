"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Language, getTranslation } from "@/app/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("almadel_lang");
      if (stored === "en" || stored === "ur") {
        setLanguageState(stored);
        document.documentElement.setAttribute("lang", stored === "ur" ? "ur-Latn" : "en");
      }
    } catch {
      // localStorage may fail in restricted iframes
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("almadel_lang", lang);
      document.documentElement.setAttribute("lang", lang === "ur" ? "ur-Latn" : "en");
    } catch {
      // ignore storage error
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ur" : "en");
  };

  const t = (key: string, fallback?: string) => {
    return getTranslation(key, language, fallback);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
