"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

/** Consistent page title block used across workspace routes. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className={ui.head}>
      <div className={ui.headMain}>
        {eyebrow ? <label>{eyebrow}</label> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={ui.headActions}>{actions}</div> : null}
    </header>
  );
}

type PageSectionProps = {
  children: ReactNode;
  className?: string;
  /** Remove default panel chrome (padding/border) when nested panels are used inside. */
  bare?: boolean;
};

export function PageSection({ children, className = "", bare }: PageSectionProps) {
  return (
    <section className={`${bare ? ui.sectionBare : ui.panel} ${className}`.trim()}>{children}</section>
  );
}

type PageToolbarProps = {
  children: ReactNode;
  scrollable?: boolean;
};

export function PageToolbar({ children, scrollable }: PageToolbarProps) {
  return (
    <div className={`${ui.toolbar} ${scrollable ? ui.toolbarScroll : ""}`.trim()}>{children}</div>
  );
}

/** Vertical rhythm wrapper — place inside WorkspaceShell. */
export function PageStack({ children }: { children: ReactNode }) {
  return <div className={ui.pageStack}>{children}</div>;
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Icon + title + guidance, used for every "no records" / "nothing here yet" state. */
export function EmptyState({ icon = "box", title, body, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`${ui.emptyState} ${className}`.trim()} role="status">
      <span className={ui.emptyIcon} aria-hidden>
        <Icon name={icon} size={19} />
      </span>
      <p className={ui.emptyTitle}>{title}</p>
      {body ? <p className={ui.emptyBody}>{body}</p> : null}
      {action ? <div className={ui.emptyAction}>{action}</div> : null}
    </div>
  );
}

/** Full-width table row hosting an EmptyState. */
export function TableEmptyRow({ colSpan, ...props }: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td className={ui.emptyCell} colSpan={colSpan}>
        <EmptyState {...props} />
      </td>
    </tr>
  );
}

/** Skeleton rows while a table loads. */
export function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}>
              <span className="al-skeleton block h-3.5" style={{ width: c === 0 ? "70%" : `${40 + ((r + c) % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type Tone = "pos" | "neg" | "warn" | "info";
const TONE_CLASS: Record<Tone, string> = { pos: ui.tonePos, neg: ui.toneNeg, warn: ui.toneWarn, info: ui.toneInfo };

type MetricProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: Tone;
};

/** One figure in a `.metrics` strip. Tone colours the figure only. */
export function Metric({ label, value, hint, icon, tone }: MetricProps) {
  return (
    <div className={`${ui.metric} ${tone ? TONE_CLASS[tone] : ""}`.trim()}>
      <div className={ui.metricHead}>
        <span>{label}</span>
        {icon ? (
          <span className={ui.metricIcon} aria-hidden>
            <Icon name={icon} size={14} />
          </span>
        ) : null}
      </div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

/** Strip of metrics sharing one surface. */
export function MetricStrip({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return <div className={`${ui.metrics} ${columns === 4 ? ui.metrics4 : ""}`.trim()}>{children}</div>;
}
