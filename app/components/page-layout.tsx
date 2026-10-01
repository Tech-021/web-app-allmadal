"use client";

import type { ReactNode } from "react";
import ui from "@/app/components/workspace-ui.module.css";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
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
