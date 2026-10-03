"use client";

import { animate, motion, MotionConfig, useMotionValue, useReducedMotion, useTransform, type Variants } from "framer-motion";
import { useCallback, useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

/** Live media-query match (false on the server and first paint). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** Phones: sheets rise from the bottom edge, toasts go full width (same breakpoint as the CSS). */
export const PHONE_QUERY = "(max-width: 640px)";
export const useIsPhone = () => useMediaQuery(PHONE_QUERY);

/* --------------------------------------------------------------------------
   Motion tokens (System board · "Motion with purpose"): one curve, three speeds.
   Durations are in seconds, framer-motion's unit.
   -------------------------------------------------------------------------- */

/** cubic-bezier(.22, 1, .36, 1): every entrance, every settle. */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Exits accelerate away so the next state is never kept waiting. */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;
/** Rolling figures: decelerates gently so the last digits stay readable. */
export const EASE_COUNT = [0.25, 1, 0.5, 1] as const;

export const DUR = {
  /** press, hover, toggle, focus */
  press: 0.12,
  /** popover, toast, tab, palette */
  pop: 0.2,
  /** sheet, drawer, mode switch, chart draw */
  sheet: 0.32,
  /** exits run quicker than their entrance */
  exit: 0.18,
} as const;

/** Critically damped: settles without overshoot (drag release, list reflow). */
export const SPRING = { type: "spring", stiffness: 520, damping: 44, mass: 0.9 } as const;

/**
 * App-wide motion defaults. `reducedMotion="user"` follows the OS setting:
 * transforms and layout animations are dropped, fades remain ("reduce: fades only, no travel").
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DUR.sheet, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

/**
 * Rolls a number from its previous value to the new one; on first mount it counts up from `from` (0).
 * Frames write straight to the DOM through a MotionValue, so a long count never re-renders React.
 * The formatted final value is always exactly `value`. Reduced motion: no count-up, the value is set.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 600,
  delay = 0,
  from = 0,
  ease = EASE_COUNT,
  className,
  style,
}: {
  value: number;
  format?: (n: number, final: boolean) => string;
  /** ms */
  duration?: number;
  /** ms, first run only matters in practice */
  delay?: number;
  from?: number;
  ease?: readonly [number, number, number, number];
  className?: string;
  style?: CSSProperties;
}) {
  const target = Number.isFinite(value) ? value : 0;
  const reduce = useReducedMotion();
  const current = useMotionValue(from);
  const text = useTransform(current, (n) => format(n, n === target));

  useEffect(() => {
    if (reduce || current.get() === target) {
      current.jump(target);
      return;
    }
    const controls = animate(current, target, { duration: duration / 1000, delay: delay / 1000, ease: [...ease] });
    return () => controls.stop();
    // `ease` is a constant tuple in practice; re-running on identity changes would restart the roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay, reduce, current]);

  return (
    <motion.span className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {text}
    </motion.span>
  );
}

/* --------------------------------------------------------------------------
   Staggered reveal: a group fades its items up one after another
   (SignIn board: 0 · 40 · 80 · 120 … ms, 600ms rise).
   -------------------------------------------------------------------------- */

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Stagger container. Items inside (at any depth) that are `<Reveal>` rise in order of mount. */
export function RevealGroup({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div className={className} style={style} data-reveal="" variants={groupVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/** One step of a RevealGroup. Outside a group it renders statically. */
export function Reveal({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div className={className} style={style} data-reveal="" variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** Skeleton block used while data loads. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`al-skeleton block ${className}`} style={style} />;
}
