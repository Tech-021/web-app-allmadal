"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatedNumber } from "@/app/components/motion";
import viz from "./viz.module.css";

/** Pakistani grouping (1,24,560) — used for every rupee figure in the app. */
export function formatRs(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0).toLocaleString("en-IN");
}

/** Compact axis label: 1.2L, 45k. */
export function shortRs(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(value >= 1000000 ? 0 : 1)}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

type FigureSize = "xl" | "lg" | "md" | "sm";

/**
 * A rupee figure: Geist Mono numerals with a small raised "Rs".
 * `animate` rolls the number when it changes (respects reduced motion).
 */
export function Money({
  value,
  size = "md",
  animate,
  tone,
  sign,
  className = "",
  style,
}: {
  value: number;
  size?: FigureSize;
  animate?: boolean;
  tone?: "pos" | "neg" | "warn";
  sign?: "+" | "−";
  className?: string;
  style?: CSSProperties;
}) {
  const toneClass = tone ? viz[`tone_${tone}`] : "";
  return (
    <span className={`${viz.money} ${viz[`money_${size}`]} ${toneClass} ${className}`.trim()} style={style}>
      <span className={viz.cur}>Rs</span>
      {sign ? `${sign} ` : null}
      {animate ? <AnimatedNumber value={value} format={(n) => formatRs(n)} /> : formatRs(value)}
    </span>
  );
}

/** Plain mono number (counts, quantities) */
export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`${viz.num} ${className}`.trim()}>{children}</span>;
}

/** Stacked share bar with a 2px surface gap between segments, plus its legend. */
export function CompositionBar({
  segments,
  showLegend = true,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  showLegend?: boolean;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div
        className={viz.compBar}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${total ? Math.round((s.value / total) * 100) : 0} percent`).join(", ")}
      >
        {total === 0 ? (
          <i style={{ flexGrow: 1, background: "var(--sunken)" }} />
        ) : (
          visible.map((s) => <i key={s.label} style={{ flexGrow: s.value, background: s.color }} />)
        )}
      </div>
      {showLegend && (
        <div className={viz.compLegend}>
          {segments.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
              <b className={viz.num}>Rs {formatRs(s.value)}</b>
              <em className={viz.num}>{total ? Math.round((s.value / total) * 100) : 0}%</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Thin progress meter */
export function Meter({ pct, color }: { pct: number; color: string }) {
  return (
    <span className={viz.meter} aria-hidden>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}

/** Ledger row: label left, mono figure right */
export function LedgerRow({
  label,
  value,
  swatch,
  tone,
  sign,
  strong,
  double,
}: {
  label: ReactNode;
  value: number;
  swatch?: string;
  tone?: "pos" | "neg" | "warn";
  sign?: "+" | "−";
  strong?: boolean;
  double?: boolean;
}) {
  return (
    <div className={`${viz.ledger} ${double ? viz.ledgerDouble : ""} ${strong ? viz.ledgerStrong : ""}`.trim()}>
      <span className={viz.ledgerLabel}>
        {swatch ? <i style={{ background: swatch }} /> : null}
        {label}
      </span>
      <span className={`${viz.num} ${tone ? viz[`tone_${tone}`] : ""}`.trim()}>
        {strong ? "Rs " : ""}
        {sign ? `${sign} ` : ""}
        {formatRs(value)}
      </span>
    </div>
  );
}
