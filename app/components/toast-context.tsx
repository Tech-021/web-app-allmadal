"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { shouldSuppressAuthSessionToast } from "@/app/lib/auth-session";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (type === "error" && shouldSuppressAuthSessionToast(message)) {
      return;
    }
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmResponse = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmDialog }}>
      {children}

      {/* Floating toasts */}
      <div
        className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 left-4 sm:left-auto sm:right-5 z-[100] flex flex-col items-stretch sm:items-end gap-2 pointer-events-none max-md:bottom-[96px]"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="al-toast pointer-events-auto flex w-full sm:w-[380px] items-start gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3 pr-2 shadow-[var(--shadow-lg)]"
          >
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                t.type === "success"
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : t.type === "error"
                  ? "bg-[var(--neg-soft)] text-[var(--neg)]"
                  : "bg-[var(--info-soft)] text-[var(--info)]"
              }`}
              aria-hidden
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.type === "success" ? "M20 6L9 17l-5-5" : t.type === "error" ? "M18 6L6 18M6 6l12 12" : "M12 11v5M12 7.5h.01"} />
              </svg>
            </span>
            <p className="m-0 flex-1 pt-0.5 text-[13px] font-medium leading-snug text-[var(--text)]">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation dialog */}
      {confirmState && (
        <div className="al-overlay fixed inset-0 z-[110] grid place-items-center bg-[var(--scrim)] backdrop-blur-[3px] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="almadel-confirm-title"
            className="al-dialog w-full max-w-md overflow-hidden rounded-[18px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-start gap-3 p-5 pb-4">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  confirmState.options.danger ? "bg-[var(--neg-soft)] text-[var(--neg)]" : "bg-[var(--brand-soft)] text-[var(--brand)]"
                }`}
                aria-hidden
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={confirmState.options.danger ? "M12 3l9.5 17h-19zM12 10v4M12 17.5h.01" : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01"} />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="almadel-confirm-title" className="m-0 text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                  {confirmState.options.title}
                </h3>
                <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[var(--muted)]">{confirmState.options.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
              <button
                type="button"
                onClick={() => handleConfirmResponse(false)}
                className="h-9 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[13px] font-medium text-[var(--text)] shadow-[var(--shadow-xs)] transition hover:border-[var(--border-strong)]"
              >
                {confirmState.options.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirmResponse(true)}
                className={`h-9 rounded-[9px] px-4 text-[13px] font-medium transition active:scale-[0.98] ${
                  confirmState.options.danger
                    ? "bg-[var(--neg)] text-[var(--surface)] hover:opacity-90"
                    : "bg-[var(--brand)] text-[var(--on-brand)] hover:bg-[var(--brand-strong)]"
                }`}
              >
                {confirmState.options.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
