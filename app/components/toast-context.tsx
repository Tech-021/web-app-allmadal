"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

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

      {/* Floating Toast Containers */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl p-4 shadow-xl border backdrop-blur-md transition-all duration-300 ${
              t.type === "success"
                ? "bg-[#056839]/95 text-white border-[#00875a]"
                : t.type === "error"
                ? "bg-red-900/95 text-white border-red-700"
                : "bg-gray-900/95 text-white border-gray-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  t.type === "success"
                    ? "bg-[#00875a] text-white"
                    : t.type === "error"
                    ? "bg-red-600 text-white"
                    : "bg-gray-700 text-white"
                }`}
              >
                {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
              </span>
              <p className="text-xs font-bold leading-snug">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Custom Confirmation Modal Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-2xl text-base font-extrabold ${
                  confirmState.options.danger ? "bg-red-100 text-red-600" : "bg-[#e6f4ed] text-[#00875a]"
                }`}
              >
                {confirmState.options.danger ? "⚠️" : "❓"}
              </span>
              <h3 className="text-lg font-extrabold text-gray-900">{confirmState.options.title}</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-medium mb-6">
              {confirmState.options.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmResponse(false)}
                className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                {confirmState.options.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResponse(true)}
                className={`rounded-full px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition ${
                  confirmState.options.danger
                    ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                    : "bg-[#00875a] hover:bg-[#006b3f] shadow-[#00875a]/20"
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
