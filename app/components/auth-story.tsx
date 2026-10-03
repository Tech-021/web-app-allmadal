"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatRs } from "./figures";
import { DUR, EASE, EASE_EXIT } from "./motion";
import s from "./auth.module.css";

/*
 * "Today at the counter": the graphite story panel on the SignIn board.
 * Illustrative only (a demo shop, never the signed-out visitor's data) and aria-hidden by its parent.
 * Every sale that lands moves the counter by exactly its amount and re-weights the bar,
 * so the motion always explains the number.
 */

type Method = "cash" | "online" | "udhaar";
type Row = { id: string; label: string; amount: number; kind: "sale" | "payment" | "expense"; method?: Method; live?: boolean };

const METHODS: Method[] = ["cash", "online", "udhaar"];
const COLOR: Record<Method, string> = { cash: "#26A57A", online: "#7A84EE", udhaar: "#C1873F" };
const LEGEND: Record<Method, string> = { cash: "Cash", online: "Online", udhaar: "Khata" };

/** Takings when the page opens: Rs 1,24,560, split ≈ 62 / 27 / 11. */
const OPENING: Record<Method, number> = { cash: 77_230, online: 33_630, udhaar: 13_700 };
const OPENING_TOTAL = OPENING.cash + OPENING.online + OPENING.udhaar;

/** Earlier today, newest first. */
const HISTORY: Row[] = [
  { id: "h1", label: "INV-2041 · cash", amount: 3_450, kind: "sale", method: "cash" },
  { id: "h2", label: "Bilal Ahmed · khata paid", amount: 5_000, kind: "payment" },
  { id: "h3", label: "INV-2040 · Easypaisa", amount: 34_900, kind: "sale", method: "online" },
  { id: "h4", label: "Tea & refreshments", amount: -1_200, kind: "expense" },
  { id: "h5", label: "INV-2039 · cash", amount: 1_150, kind: "sale", method: "cash" },
  { id: "h6", label: "Rashid Electronics · udhaar", amount: 4_500, kind: "sale", method: "udhaar" },
];

/** What lands next, on a loop. Credit sales name the customer; the rest carry an invoice number. */
const NEXT: Array<{ via: string; amount: number; method: Method; customer?: string }> = [
  { via: "Easypaisa", amount: 2_200, method: "online" },
  { via: "cash", amount: 850, method: "cash" },
  { via: "udhaar", amount: 2_750, method: "udhaar", customer: "Rashid Electronics" },
  { via: "cash", amount: 3_450, method: "cash" },
  { via: "JazzCash", amount: 1_600, method: "online" },
  { via: "cash", amount: 640, method: "cash" },
  { via: "udhaar", amount: 1_200, method: "udhaar", customer: "Bilal Ahmed" },
  { via: "cash", amount: 2_950, method: "cash" },
  { via: "Easypaisa", amount: 5_000, method: "online" },
  { via: "cash", amount: 1_150, method: "cash" },
];

const FEED_LENGTH = 6;
const COUNT_UP_MS = 2600;
const ROLL_MS = 1200;

/** The panel only shows from 1024px up (smaller screens get the band without figures). */
const WIDE = "(min-width: 1024px)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const useWideViewport = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
const usePageVisible = () => useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true);

function amountText(row: Row) {
  if (row.kind === "expense") return `− ${formatRs(Math.abs(row.amount))}`;
  if (row.method === "udhaar") return formatRs(row.amount);
  return `+ ${formatRs(row.amount)}`;
}

function amountTone(row: Row) {
  if (row.kind === "expense") return s.amtOut;
  if (row.method === "udhaar") return s.amtCredit;
  return "";
}

export function CounterStory() {
  const reduce = useReducedMotion();
  const wide = useWideViewport();
  const visible = usePageVisible();

  const total = useMotionValue(0);
  const figure = useTransform(total, (n) => formatRs(n));

  const [counted, setCounted] = useState(false);
  const landed = Boolean(reduce) || counted;
  const [totals, setTotals] = useState(OPENING);
  const [rows, setRows] = useState<Row[]>(HISTORY);
  const [delta, setDelta] = useState<{ id: string; amount: number; method: Method } | null>(null);
  const runningTotal = useRef(OPENING_TOTAL);
  const step = useRef(0);

  // Count up from 0 to the opening figure (reduced motion: show it as-is, no count-up).
  useEffect(() => {
    if (reduce) {
      total.jump(runningTotal.current);
      return;
    }
    const controls = animate(total, OPENING_TOTAL, {
      duration: COUNT_UP_MS / 1000,
      delay: 0.15,
      ease: [0.5, 1, 0.89, 1], // ease-out quad, as on the board: the climb stays visible to the end
      onComplete: () => setCounted(true),
    });
    return () => controls.stop();
  }, [reduce, total]);

  // Then keep it live: a sale lands every ~3s while the panel is on screen and the tab is visible.
  useEffect(() => {
    if (!landed || !wide || !visible) return;
    let timer: number;
    const schedule = () => {
      const jitter = 2600 + ((step.current * 977) % 1200); // organic, but deterministic
      timer = window.setTimeout(() => {
        const n = step.current++;
        const next = NEXT[n % NEXT.length];
        const id = `live-${n}`;
        const label = next.customer ? `${next.customer} · udhaar` : `INV-${2042 + n} · ${next.via}`;

        runningTotal.current += next.amount;
        setTotals((t) => ({ ...t, [next.method]: t[next.method] + next.amount }));
        setRows((r) => [{ id, label, amount: next.amount, kind: "sale" as const, method: next.method, live: true }, ...r].slice(0, FEED_LENGTH));
        setDelta({ id, amount: next.amount, method: next.method });

        if (reduce) total.jump(runningTotal.current);
        else animate(total, runningTotal.current, { duration: ROLL_MS / 1000, ease: [0.25, 1, 0.5, 1] });
        schedule();
      }, jitter);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [landed, wide, visible, reduce, total]);

  // The delta chip floats away on its own.
  useEffect(() => {
    if (!delta) return;
    const t = window.setTimeout(() => setDelta(null), 1500);
    return () => window.clearTimeout(t);
  }, [delta]);

  return (
    <>
      <div className={s.story}>
        <div className={s.storyHead}>
          <div className={s.storyEyebrow}>
            <span className={s.liveDot} />
            Today at the counter
          </div>
          <AnimatePresence>
            {delta && (
              <motion.span
                key={delta.id}
                className={s.delta}
                style={{ color: delta.method === "udhaar" ? "#E5A85A" : "#3CCB9A" }}
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.sheet, ease: EASE } }}
                exit={{ opacity: 0, y: -12, transition: { duration: 0.42, ease: EASE_EXIT } }}
              >
                + {formatRs(delta.amount)}
                <small>{LEGEND[delta.method].toLowerCase()}</small>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className={s.figure}>
          <span className={s.figureCur}>Rs</span>
          <motion.span>{figure}</motion.span>
        </div>

        <div className={s.storyBar}>
          {METHODS.map((m) => (
            <i key={m} style={{ flexGrow: totals[m], background: COLOR[m] }} />
          ))}
        </div>
        <div className={s.storyLegend}>
          {METHODS.map((m) => (
            <span key={m}>
              <i style={{ background: COLOR[m] }} />
              {LEGEND[m]}
            </span>
          ))}
        </div>
      </div>

      <div className={s.ticker}>
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((row) => (
            <motion.div
              key={row.id}
              layout="position"
              className={`${s.tickerRow} ${row.live ? s.tickerFresh : ""}`}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: DUR.pop, ease: EASE_EXIT } }}
              transition={{ duration: 0.42, ease: EASE, layout: { duration: 0.42, ease: EASE } }}
            >
              <span>{row.label}</span>
              <b className={amountTone(row)}>{amountText(row)}</b>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
   Sign up (SignUp board): what happens next, three steps, the first one lit.
   ------------------------------------------------------------------------------------------------ */

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  { title: "Create your account", body: "Name, email and a password." },
  { title: "Name your shop", body: "Logo, address and receipt footer." },
  {
    title: "Pick your workspace",
    body: (
      <>
        <b>POS</b> for fast selling · <b>Financial</b> adds khata, cash books and closing.
      </>
    ),
  },
];

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function SignupStory() {
  return (
    <motion.div
      className={s.signup}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }}
    >
      <motion.div variants={rise}>
        <div className={s.storyEyebrow}>Three minutes to your first sale</div>
        <div className={s.signupTitle}>One system for the counter and the khata.</div>
      </motion.div>
      <ol className={s.steps}>
        {STEPS.map((step, i) => (
          <motion.li key={step.title} className={s.stepRow} variants={rise} aria-current={i === 0 ? "step" : undefined}>
            <span className={`${s.stepNo} ${i === 0 ? s.stepNoOn : ""}`}>{i + 1}</span>
            <div>
              <div className={s.stepTitle}>{step.title}</div>
              <div className={s.stepBody}>{step.body}</div>
            </div>
          </motion.li>
        ))}
      </ol>
      <div className={s.signupProgress} aria-hidden>
        <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.45, ease: EASE }} />
        <i />
      </div>
    </motion.div>
  );
}
