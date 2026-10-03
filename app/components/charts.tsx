"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatRs, shortRs } from "@/app/components/figures";
import viz from "./viz.module.css";

/** Width of a container, tracked with ResizeObserver (charts draw in real pixels, never stretched). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(raw: number) {
  if (raw <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.ceil(raw / (step / 2)) * (step / 2);
}

function smoothPath(points: Array<[number, number]>) {
  if (!points.length) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const cx = (x - px) / 2;
    d += ` C${px + cx},${py} ${x - cx},${y} ${x},${y}`;
  }
  return d;
}

export type RunningChartProps = {
  /** x-axis labels, one per slot (e.g. "10a" or "Thu") */
  labels: string[];
  /** long form for the tooltip ("By 6 PM · Wed 2 Oct", "Thu 26 Sep") */
  whens: string[];
  /** current-period values; may be shorter than labels (period still running) */
  values: number[];
  /** per-slot increment shown in the tooltip ("+ Rs 15,200 this hour") */
  steps?: number[];
  stepSuffix?: string;
  comparison?: number[];
  comparisonLabel?: string;
  height?: number;
  ariaLabel: string;
  /** changing this replays the draw animation */
  animationKey?: string;
};

/** Area line with an optional dashed comparison series, crosshair and tooltip. */
export function RunningChart({
  labels,
  whens,
  values,
  steps,
  stepSuffix = "",
  comparison,
  comparisonLabel = "Comparison",
  height = 172,
  ariaLabel,
  animationKey,
}: RunningChartProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const W = Math.max(width, 120);
  const H = height;
  const n = Math.max(labels.length, 2);
  const padR = 40;

  const geo = useMemo(() => {
    const max = niceMax(Math.max(1, ...values, ...(comparison ?? [])) * 1.08);
    const X = (i: number) => 6 + i * ((W - padR - 6) / (n - 1));
    const Y = (v: number) => H - 4 - (v / max) * (H - 16);
    const curPts = values.map((v, i) => [X(i), Y(v)] as [number, number]);
    const cmpPts = (comparison ?? []).map((v, i) => [X(i), Y(v)] as [number, number]);
    const line = smoothPath(curPts);
    const area = curPts.length ? `${line} L${curPts[curPts.length - 1][0]},${H} L${curPts[0][0]},${H} Z` : "";
    return { max, X, Y, line, area, cmp: smoothPath(cmpPts) };
  }, [values, comparison, W, H, n]);

  const colW = (W - padR - 6) / (n - 1);
  const idx = hi == null ? null : Math.min(hi, n - 1);
  const has = idx != null && idx < values.length;
  const cur = has ? values[idx] : null;
  const cmp = idx != null ? comparison?.[idx] : undefined;
  const diff = cur != null && cmp != null ? cur - cmp : null;
  const tipX = idx != null ? geo.X(idx) : 0;

  return (
    <div className={viz.chart} ref={wrapRef} style={{ height: H + 26 }} onMouseLeave={() => setHi(null)}>
      {width > 0 && (
        <>
          {[geo.max, geo.max / 2].map((v) => (
            <span key={v} className={viz.tick} style={{ top: geo.Y(v) }}>
              {shortRs(v)}
            </span>
          ))}
          <svg width={W} height={H} className={viz.svg} role="img" aria-label={ariaLabel} key={animationKey}>
            {[geo.max, geo.max / 2].map((v) => (
              <line key={v} x1={0} x2={W} y1={geo.Y(v)} y2={geo.Y(v)} className={viz.grid} />
            ))}
            {comparison && comparison.length > 0 && <path d={geo.cmp} className={`${viz.cmpLine} ${viz.fadeIn}`} />}
            {geo.area && <path d={geo.area} className={`${viz.area} ${viz.fadeIn}`} />}
            {geo.line && <path d={geo.line} className={`${viz.line} ${viz.draw}`} />}
            {idx != null && <line x1={tipX} x2={tipX} y1={0} y2={H} className={viz.crosshair} />}
            {hi == null && values.length > 0 && (
              <circle cx={geo.X(values.length - 1)} cy={geo.Y(values[values.length - 1])} r={4.5} className={viz.endDot} />
            )}
          </svg>
          {idx != null && cmp != null && <span className={`${viz.marker} ${viz.markerCmp}`} style={{ left: tipX, top: geo.Y(cmp) }} />}
          {idx != null && has && cur != null && <span className={viz.marker} style={{ left: tipX, top: geo.Y(cur) }} />}
          {idx != null && (
            <div className={viz.tooltip} style={{ left: Math.min(Math.max(tipX - 92, 0), W - 190) }} role="status">
              <small>{whens[idx]}</small>
              <strong className={viz.num}>{has ? `Rs ${formatRs(cur ?? 0)}` : "—"}</strong>
              {has && steps?.[idx] != null && (
                <span>
                  + Rs {formatRs(steps[idx])} {stepSuffix}
                </span>
              )}
              {!has && <span>Not reached yet</span>}
              {cmp != null && (
                <>
                  <i className={viz.tipRule} />
                  <span className={viz.tipCmp}>
                    <span>
                      <svg width="14" height="2" aria-hidden>
                        <line x1="0" x2="14" y1="1" y2="1" className={viz.cmpLine} />
                      </svg>
                      {comparisonLabel}
                    </span>
                    <span className={viz.num}>Rs {formatRs(cmp)}</span>
                  </span>
                  {diff != null && (
                    <span className={`${viz.num} ${diff >= 0 ? viz.tone_pos : viz.tone_neg}`}>
                      {diff >= 0 ? "▲" : "▼"} Rs {formatRs(Math.abs(diff))} {diff >= 0 ? "ahead" : "behind"}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {labels.map((_, i) => (
            <button
              key={i}
              type="button"
              className={viz.hit}
              style={{ left: Math.max(0, geo.X(i) - colW / 2), width: colW, height: H }}
              onMouseEnter={() => setHi(i)}
              onFocus={() => setHi(i)}
              onBlur={() => setHi(null)}
              aria-label={`${whens[i]}: ${i < values.length ? `Rs ${formatRs(values[i])}` : "no sales yet"}`}
            />
          ))}
          <div className={viz.xLabels} style={{ top: H + 8 }}>
            {labels.map((l, i) =>
              l ? (
                <span key={i} style={{ left: geo.X(i), color: idx === i ? "var(--text)" : undefined }}>
                  {l}
                </span>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Vertical bars with an average line and per-bar tooltip (reports). */
export function BarChart({
  values,
  labels,
  whens,
  height = 200,
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  whens: string[];
  height?: number;
  ariaLabel: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const W = Math.max(width, 120);
  const H = height;
  const n = Math.max(values.length, 1);
  const gap = n > 20 ? 4 : 8;
  const bw = (W - gap * (n - 1)) / n;
  const max = niceMax(Math.max(1, ...values) * 1.05);
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const Y = (v: number) => H - (v / max) * (H - 8);
  const d = hi != null ? values[hi] - avg : 0;

  return (
    <div className={viz.chart} ref={wrapRef} style={{ height: H + 24 }} onMouseLeave={() => setHi(null)}>
      {width > 0 && (
        <>
          <svg width={W} height={H} className={viz.svg} role="img" aria-label={ariaLabel}>
            <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className={viz.baseline} />
            {values.map((v, i) => (
              <rect
                key={i}
                x={i * (bw + gap)}
                y={Y(v)}
                width={bw}
                height={Math.max(0, H - Y(v))}
                rx={2}
                className={viz.bar}
                style={{
                  fill: hi === i ? "var(--brand)" : v >= avg ? "var(--text-2)" : "var(--faint)",
                  animationDelay: `${i * 12}ms`,
                }}
              />
            ))}
            {values.some((v) => v > 0) && <line x1={0} x2={W} y1={Y(avg)} y2={Y(avg)} className={viz.avgLine} />}
          </svg>
          {values.map((v, i) => (
            <button
              key={i}
              type="button"
              className={viz.hit}
              style={{ left: i * (bw + gap) - gap / 2, width: bw + gap, height: H }}
              onMouseEnter={() => setHi(i)}
              onFocus={() => setHi(i)}
              onBlur={() => setHi(null)}
              aria-label={`${whens[i]}: Rs ${formatRs(v)}`}
            />
          ))}
          {hi != null && (
            <div className={viz.tooltip} style={{ left: Math.min(Math.max(hi * (bw + gap) - 70, 0), W - 170), minWidth: 150 }} role="status">
              <small>{whens[hi]}</small>
              <strong className={viz.num}>Rs {formatRs(values[hi])}</strong>
              <span className={`${viz.num} ${d >= 0 ? viz.tone_pos : viz.tone_neg}`}>
                {d >= 0 ? "▲" : "▼"} {formatRs(Math.abs(d))} vs average
              </span>
            </div>
          )}
          <div className={viz.xLabels} style={{ top: H + 8 }}>
            {labels.map((l, i) =>
              l ? (
                <span key={i} style={{ left: i * (bw + gap) + bw / 2 }}>
                  {l}
                </span>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Tiny trend line for compact contexts (mobile hero, khata collections). */
export function Sparkline({
  values,
  comparison,
  height = 64,
  ariaLabel,
}: {
  values: number[];
  comparison?: number[];
  height?: number;
  ariaLabel: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const W = Math.max(width, 60);
  const H = height;
  const n = Math.max(values.length, comparison?.length ?? 0, 2);
  const max = Math.max(1, ...values, ...(comparison ?? []));
  const X = (i: number) => i * (W / (n - 1));
  const Y = (v: number) => H - 2 - (v / max) * (H - 6);
  const line = smoothPath(values.map((v, i) => [X(i), Y(v)]));
  const area = values.length ? `${line} L${X(values.length - 1)},${H} L0,${H} Z` : "";
  return (
    <div ref={wrapRef} style={{ height: H }}>
      {width > 0 && (
        <svg width={W} height={H} className={viz.svg} role="img" aria-label={ariaLabel}>
          {comparison && <path d={smoothPath(comparison.map((v, i) => [X(i), Y(v)]))} className={viz.cmpLine} />}
          {area && <path d={area} className={viz.area} />}
          {line && <path d={line} className={`${viz.line} ${viz.draw}`} />}
          {values.length > 0 && <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r={4} className={viz.endDot} />}
        </svg>
      )}
    </div>
  );
}
