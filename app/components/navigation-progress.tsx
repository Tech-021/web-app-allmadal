"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import s from "./navigation-progress.module.css";

/*
 * The AuthMobile board's sweep, used for page changes: a 2px jade bar at the top edge while the
 * next route loads, then a full-width flash as it lands. Lives in the root layout so it survives
 * the route change it is reporting on. Quick navigations (under 120ms) never show it.
 */

const START_EVENT = "almadel:navigation-start";
const SHOW_AFTER_MS = 120;
const GIVE_UP_MS = 15000;

/** For navigations that don't come from a link click (router.push after a palette pick, etc.). */
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

type Phase = "idle" | "loading" | "done";

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef(false);
  const timers = useRef<number[]>([]);
  const lastPath = useRef(pathname);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
    const start = () => {
      clear();
      pending.current = true;
      timers.current.push(
        window.setTimeout(() => pending.current && setPhase("loading"), SHOW_AFTER_MS),
        window.setTimeout(() => {
          pending.current = false;
          setPhase("idle");
        }, GIVE_UP_MS),
      );
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      clear();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
    };
  }, []);

  // The route landed: finish the bar if it was showing, otherwise just stand down.
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (!pending.current) return;
    pending.current = false;
    timers.current.forEach(window.clearTimeout);
    timers.current = [window.setTimeout(() => setPhase((p) => (p === "loading" ? "done" : "idle")), 0)];
  }, [pathname]);

  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => setPhase("idle"), 260);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="nav-progress"
          className={s.track}
          role="progressbar"
          aria-label="Loading page"
          aria-busy={phase === "loading"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.32, delay: 0.06 } }}
        >
          {phase === "loading" ? (
            <i className={s.sweep} />
          ) : (
            <motion.i className={s.fill} initial={{ scaleX: 0.4 }} animate={{ scaleX: 1 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
