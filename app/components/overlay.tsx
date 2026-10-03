"use client";

import { AnimatePresence, useAnimate, useIsomorphicLayoutEffect, usePresence, useReducedMotion } from "framer-motion";
import { useEffect, useEffectEvent, useRef, type HTMLAttributes, type ReactNode } from "react";
import { DUR, EASE, EASE_EXIT, PHONE_QUERY } from "./motion";
import ui from "./workspace-ui.module.css";

/*
 * One overlay for every popup, drawer and sheet: it animates in AND out (the panel stays mounted
 * until its exit finishes), closes on Escape (topmost layer only) and scrim press, traps Tab,
 * locks page scroll and hands focus back to whatever opened it.
 *
 * Usage — the first element child is the panel that moves:
 *   <Overlay open={editing !== undefined} onClose={close} variant="drawer">
 *     <form className={ui.sheet}>…</form>
 *   </Overlay>
 */

type Variant = "dialog" | "drawer" | "sheet" | "palette";

type OverlayProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  open: boolean;
  onClose?: () => void;
  /**
   * dialog: centred, rises and scales · drawer: slides in from the right · sheet: rises from the bottom ·
   * palette: drops in from above (top-anchored command surfaces). On phones, dialogs and drawers use the sheet motion.
   */
  variant?: Variant;
  /** Scrim press and Escape close it. Pass false while a request is in flight. */
  dismissible?: boolean;
  /** Root (scrim) class. Defaults to the shared modal scrim, plus the drawer layout for `drawer`. */
  className?: string;
  children: ReactNode;
};

export function Overlay({ open, ...frame }: OverlayProps) {
  return <AnimatePresence>{open ? <OverlayFrame key="overlay" {...frame} /> : null}</AnimatePresence>;
}

/** Topmost-first stack: only the newest overlay answers Escape and Tab. */
const layers: symbol[] = [];
let scrollLocks = 0;

/**
 * What had focus before the latest focus move. An `autoFocus` inside a panel fires during commit,
 * before any effect runs, so by then `activeElement` is already inside: the opener is the one before.
 */
let focusBefore: Element | null = null;
let focusNow: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (e) => {
      focusBefore = focusNow;
      focusNow = e.target as Element;
    },
    true,
  );
}

function lockScroll() {
  if (scrollLocks++ > 0) return;
  const html = document.documentElement;
  const hasScrollbar = window.innerWidth > html.clientWidth;
  html.style.overflow = "hidden";
  if (hasScrollbar) html.style.scrollbarGutter = "stable";
}

function unlockScroll() {
  if (--scrollLocks > 0) return;
  const html = document.documentElement;
  html.style.overflow = "";
  html.style.scrollbarGutter = "";
}

type Pose = { x?: number; y?: number; scale?: number };
const REST = { x: 0, y: 0, scale: 1 };

/**
 * How each kind of panel arrives and leaves: off-stage poses, whether it fades, timings (s).
 * Numeric x/y/scale (not transform strings) so an interrupted move reverses from where it is.
 */
function choreography(variant: Variant, phone: boolean, panel: HTMLElement | null) {
  const w = panel?.offsetWidth ?? 0;
  const h = panel?.offsetHeight ?? 0;
  if (variant === "palette") return { from: { y: -8, scale: 0.98 }, to: { y: -4, scale: 0.985 }, fade: true, enter: DUR.pop, exit: 0.15 };
  if (phone || variant === "sheet") return { from: { y: h + 24 }, to: { y: h + 24 }, fade: false, enter: 0.42, exit: 0.26 };
  if (variant === "drawer") return { from: { x: w + 24 }, to: { x: w + 24 }, fade: false, enter: 0.42, exit: 0.26 };
  return { from: { y: 10, scale: 0.975 }, to: { y: 6, scale: 0.985 }, fade: true, enter: DUR.sheet, exit: DUR.exit };
}

/** The same pose as an inline transform, for the very first painted frame. */
const poseCss = ({ x = 0, y = 0, scale = 1 }: Pose) => `translateX(${x}px) translateY(${y}px) scale(${scale})`;

/** Keyframes from a pose to rest, only for the axes that pose moves. */
function fromPose(pose: Pose) {
  const frames: Record<string, [number, number]> = {};
  for (const key of Object.keys(pose) as Array<keyof Pose>) frames[key] = [pose[key] as number, REST[key]];
  return frames;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function OverlayFrame({ onClose, variant = "dialog", dismissible = true, className, children, onMouseDown, ...rest }: Omit<OverlayProps, "open">) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [isPresent, safeToRemove] = usePresence();
  const reduce = useReducedMotion();
  /** null until mounted; false only while (or after) exiting, so a StrictMode re-run of the mount effect still plays the entrance */
  const wasPresent = useRef<boolean | null>(null);
  const present = useRef(isPresent);
  const layer = useRef<symbol>(null);
  const opener = useRef<Element | null>(null);
  /** The control that first took focus inside (e.g. an autoFocus field); a StrictMode re-mount puts focus back on it. */
  const firstFocus = useRef<HTMLElement | null>(null);

  // Enter before first paint (no flash); exit, then let AnimatePresence unmount.
  useIsomorphicLayoutEffect(() => {
    const root = scope.current;
    const panel = root?.firstElementChild as HTMLElement | null;
    if (!root) return;
    const c = choreography(variant, window.matchMedia(PHONE_QUERY).matches, panel);
    const travel = !reduce;
    present.current = isPresent;

    if (isPresent) {
      // Reopened while it was animating out: continue from where it is instead of jumping off-stage.
      const resuming = wasPresent.current === false;
      wasPresent.current = true;
      if (resuming) {
        void animate(root, { opacity: 1 }, { duration: DUR.pop, ease: "linear" });
        if (panel) void animate(panel, { ...(travel ? REST : {}), opacity: 1 }, { duration: c.enter, ease: EASE });
        return;
      }
      // Paint the first frame off-stage: the animation itself only starts on the next frame.
      root.style.setProperty("opacity", "0");
      if (panel && travel) panel.style.setProperty("transform", poseCss(c.from));
      if (panel && (c.fade || !travel)) panel.style.setProperty("opacity", "0");
      void animate(root, { opacity: [0, 1] }, { duration: DUR.pop, ease: "linear" });
      if (panel) {
        const fadeIn = c.fade || !travel ? { opacity: [0, 1] } : {};
        void animate(panel, { ...(travel ? fromPose(c.from) : {}), ...fadeIn }, { duration: c.enter, ease: EASE });
      }
      return;
    }

    wasPresent.current = false;
    const leave = async () => {
      await Promise.all([
        panel
          ? animate(panel, travel ? { ...c.to, ...(c.fade ? { opacity: 0 } : {}) } : { opacity: 0 }, { duration: c.exit, ease: EASE_EXIT })
          : Promise.resolve(),
        animate(root, { opacity: 0 }, { duration: c.exit + 0.02, ease: "linear" }),
      ]);
      // Reopened mid-exit: the enter animation took over, so stay mounted.
      if (!present.current) safeToRemove?.();
    };
    void leave();
  }, [isPresent]);

  // Layer bookkeeping, scroll lock, focus in and back out.
  useEffect(() => {
    const id = Symbol("overlay");
    layer.current = id;
    layers.push(id);
    const root = scope.current;
    opener.current = root?.contains(document.activeElement) ? focusBefore : document.activeElement;
    lockScroll();

    if (root?.contains(document.activeElement)) {
      firstFocus.current = document.activeElement as HTMLElement;
    } else if (root) {
      // Nothing inside took focus: move it in, so Escape and Tab work straight away.
      const panel = root.firstElementChild as HTMLElement | null;
      const target = (firstFocus.current?.isConnected ? firstFocus.current : null) ?? panel;
      if (target === panel && panel && !panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
      target?.focus({ preventScroll: true });
    }

    return () => {
      layers.splice(layers.indexOf(id), 1);
      unlockScroll();
      const back = opener.current as HTMLElement | null;
      if (back?.isConnected && (document.activeElement === document.body || root?.contains(document.activeElement))) {
        back.focus({ preventScroll: true });
      }
    };
  }, [scope]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || !isPresent || layers[layers.length - 1] !== layer.current) return;
    if (e.key === "Escape") {
      // Bubble phase: a control inside (an open dropdown, a search box) gets Escape first and can keep it.
      e.preventDefault();
      e.stopPropagation();
      if (dismissible) onClose?.();
      return;
    }
    if (e.key !== "Tab" || !scope.current) return;
    const items = Array.from(scope.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !scope.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !scope.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    // On document, so window-level shortcuts of the page underneath never see this Escape.
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const rootClass = className ?? `${ui.modal} ${variant === "drawer" ? ui.modalDrawer : ""}`;

  return (
    <div
      {...rest}
      ref={scope}
      className={rootClass}
      data-motion=""
      data-state={isPresent ? "open" : "closing"}
      onMouseDown={(e) => {
        onMouseDown?.(e);
        if (e.target === e.currentTarget && isPresent && dismissible) onClose?.();
      }}
    >
      {children}
    </div>
  );
}
