"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { shouldSuppressAuthSessionToast } from "@/app/lib/auth-session";
import { Icon, type IconName } from "@/app/components/icons";
import { DUR, EASE, EASE_EXIT, SPRING, useIsPhone } from "./motion";
import { Overlay } from "./overlay";
import s from "./toast.module.css";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastOptions {
  /** Second line under the headline (amount, invoice, what to do next). */
  description?: string;
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss delay in ms. Errors and loading toasts never auto-dismiss. */
  duration?: number;
}

export interface ToastItem extends ToastOptions {
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
  /** Shows a toast and returns its id. Loading toasts stay until updated or dismissed. */
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  /** Turns an existing toast into another state (e.g. loading → success). */
  updateToast: (id: string, patch: Partial<Omit<ToastItem, "id">>) => void;
  dismissToast: (id: string) => void;
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;

const ICONS: Record<Exclude<ToastType, "loading">, IconName> = {
  success: "check",
  error: "alert",
  warning: "alert",
  info: "info",
};

type Swipe = "right" | "down" | null;

/*
 * States board: five kinds, one shape. Rises in, restacks smoothly when a neighbour comes or goes,
 * pauses on hover/focus, swipes away (right on desktop, down on phones), Esc closes the focused one.
 */
function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const phone = useIsPhone();
  const [paused, setPaused] = useState(false);
  const [swipe, setSwipe] = useState<Swipe>(null);
  const remaining = useRef(toast.duration ?? DEFAULT_DURATION);
  const startedAt = useRef(0);
  const persistent = toast.type === "error" || toast.type === "loading";
  const duration = toast.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    remaining.current = duration;
  }, [toast.type, duration]);

  useEffect(() => {
    if (persistent || paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [persistent, paused, toast.id, onDismiss]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setPaused(false);
    const far = phone ? info.offset.y > 56 || info.velocity.y > 500 : info.offset.x > 88 || info.velocity.x > 500;
    if (!far) return;
    setSwipe(phone ? "down" : "right");
    onDismiss(toast.id);
  };

  const exit =
    swipe === "right"
      ? { x: 420, opacity: 0, transition: { duration: 0.22, ease: EASE_EXIT } }
      : swipe === "down"
      ? { y: 140, opacity: 0, transition: { duration: 0.22, ease: EASE_EXIT } }
      : phone
      ? { y: 18, opacity: 0, transition: { duration: DUR.exit, ease: EASE_EXIT } }
      : { x: 28, opacity: 0, scale: 0.98, transition: { duration: DUR.exit, ease: EASE_EXIT } };

  return (
    <motion.div
      layout="position"
      className={`${s.toast} ${toast.type === "error" ? s.error : ""} ${paused ? s.paused : ""}`}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      tabIndex={-1}
      initial={{ opacity: 0, y: phone ? 24 : 14, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={exit}
      transition={{ duration: DUR.sheet, ease: EASE, layout: SPRING }}
      drag={phone ? "y" : "x"}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={phone ? { top: 0.04, bottom: 0.9 } : { left: 0.04, right: 0.9 }}
      dragSnapToOrigin
      onDragStart={() => setPaused(true)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDismiss(toast.id);
        }
      }}
    >
      <span className={`${s.icon} ${s[`icon_${toast.type}`]}`} aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={toast.type}
            className={s.iconGlyph}
            initial={{ opacity: 0, scale: 0.4, rotate: -40 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 520, damping: 26 }}
          >
            {toast.type === "loading" ? <span className={s.spin} /> : <Icon name={ICONS[toast.type]} size={15} strokeWidth={2} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className={s.body}>
        <p className={s.title}>{toast.message}</p>
        {toast.description ? <p className={s.desc}>{toast.description}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className={s.action}
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className={s.close} onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <Icon name="x" size={14} />
      </button>
      {!persistent ? (
        <span
          key={`${toast.type}-${duration}`}
          className={`${s.bar} ${s[`bar_${toast.type}`] ?? ""}`}
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden
        />
      ) : null}
    </motion.div>
  );
}

/** While it animates out, AnimatePresence keeps rendering the last options it was given. */
function ConfirmDialog({ options: o, onClose }: { options: ConfirmOptions | null; onClose: (result: boolean) => void }) {
  return (
    <Overlay
      open={Boolean(o)}
      onClose={() => onClose(false)}
      className={`${s.scrim} al-overlay`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="almadel-confirm-title"
      aria-describedby="almadel-confirm-text"
    >
      <div className={s.dialog}>
        <div className={s.dialogBody}>
          <span className={`${s.dialogIcon} ${o?.danger ? s.dialogIconDanger : ""}`} aria-hidden>
            <Icon name={o?.danger ? "alert" : "info"} size={19} />
          </span>
          <div>
            <h3 id="almadel-confirm-title" className={s.dialogTitle}>
              {o?.title}
            </h3>
            <p id="almadel-confirm-text" className={s.dialogText}>
              {o?.message}
            </p>
          </div>
        </div>
        <div className={s.dialogFoot}>
          {/* Focus lands on the safe action when the confirm is destructive (Payments board: discard protection) */}
          <button type="button" autoFocus={Boolean(o?.danger)} className={s.btn} onClick={() => onClose(false)}>
            {o?.cancelLabel || "Cancel"}
          </button>
          <button type="button" autoFocus={!o?.danger} className={`${s.btn} ${o?.danger ? s.btnDanger : s.btnPrimary}`} onClick={() => onClose(true)}>
            {o?.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", options?: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    if (type === "error" && shouldSuppressAuthSessionToast(message)) {
      return id;
    }
    setToasts((prev) => {
      // The same message twice in a row refreshes instead of stacking.
      const withoutDupe = prev.filter((t) => !(t.message === message && t.type === type));
      return [...withoutDupe, { id, message, type, ...options }];
    });
    return id;
  }, []);

  const updateToast = useCallback((id: string, patch: Partial<Omit<ToastItem, "id">>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmResponse = useCallback((result: boolean) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const visible = toasts.slice(-MAX_VISIBLE);
  const hidden = toasts.length - visible.length;

  return (
    <ToastContext.Provider value={{ showToast, updateToast, dismissToast, confirmDialog }}>
      {children}

      <section className={`al-toast-stack ${s.stack}`} aria-label="Notifications">
        <AnimatePresence initial={false} mode="popLayout">
          {hidden > 0 ? (
            <motion.div
              key="more"
              layout="position"
              className={s.more}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: DUR.exit } }}
              transition={{ duration: DUR.pop, ease: EASE, layout: SPRING }}
            >
              +{hidden} more
            </motion.div>
          ) : null}
          {visible.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </section>

      <ConfirmDialog options={confirmState?.options ?? null} onClose={handleConfirmResponse} />
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
