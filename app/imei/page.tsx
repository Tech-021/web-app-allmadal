"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { Icon } from "@/app/components/icons";
import { PageHeader } from "@/app/components/page-layout";
import ui from "@/app/components/workspace-ui.module.css";

const PLANNED = [
  { icon: "scan", title: "Scan IMEI at the counter", body: "Attach serial numbers to every phone you sell." },
  { icon: "search", title: "Look up any handset", body: "See purchase, sale and warranty history in one place." },
  { icon: "shield", title: "Warranty & returns", body: "Verify a device belongs to your store before accepting it back." },
] as const;

export default function ImeiPage() {
  const router = useRouter();

  return (
    <WorkspaceShell>
      <PageHeader eyebrow="Store" title="IMEI management" description="Track serial numbers for phones and electronics from purchase to sale." />

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.emptyState}>
          <span className={ui.emptyIcon} aria-hidden>
            <Icon name="phone" size={19} />
          </span>
          <span className={`${ui.chip} ${ui.chipInfo} mb-2`}>
            <Icon name="clock" size={11} />
            In progress
          </span>
          <p className={ui.emptyTitle}>IMEI tracking is on its way</p>
          <p className={ui.emptyBody}>We&apos;re finishing this module. Until then, you can keep selling and managing stock as usual.</p>
          <div className={ui.emptyAction}>
            <button type="button" className={ui.secondary} onClick={() => router.back()}>
              <Icon name="left" size={14} />
              Go back
            </button>
            <Link className={ui.primary} href="/dashboard">
              Go to dashboard
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </div>
        <ul className="m-0 grid list-none grid-cols-1 border-t border-[var(--border)] p-0 md:grid-cols-3">
          {PLANNED.map((f, i) => (
            <li key={f.title} className={`flex gap-3 p-5 ${i > 0 ? "border-t border-[var(--border)] md:border-l md:border-t-0" : ""}`}>
              <span className={ui.metricIcon} aria-hidden>
                <Icon name={f.icon} size={14} />
              </span>
              <span>
                <span className="block text-[13px] font-medium">{f.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--muted)]">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </WorkspaceShell>
  );
}
