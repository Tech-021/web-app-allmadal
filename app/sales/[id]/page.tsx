"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { Icon } from "@/app/components/icons";
import { Skeleton } from "@/app/components/motion";
import { EmptyState, PageHeader, TableSkeletonRows } from "@/app/components/page-layout";
import ui from "@/app/components/workspace-ui.module.css";

type Sale = {
  id: number;
  invoiceNumber?: string;
  createdAt?: string;
  customer?: { name?: string; mobile?: string } | null;
  customerName?: string;
  customerMobile?: string;
  items?: Array<{ barcode?: string; name?: string; quantity: number; price?: number; total?: number }>;
  totalAmount?: number;
  paymentMethod?: string;
};

const money = (value: unknown) => `Rs ${Number(value || 0).toLocaleString()}`;

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Sale>(`/sales/${params.id}`).then(setSale).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load invoice."));
  }, [params.id]);

  const items = sale?.items || [];
  const units = items.reduce((n, it) => n + Number(it.quantity || 0), 0);
  const customerName = sale?.customer?.name || sale?.customerName || "Walk-in customer";
  const customerMobile = sale?.customer?.mobile || sale?.customerMobile;
  const isCash = String(sale?.paymentMethod || "cash").toLowerCase() === "cash";

  return (
    <WorkspaceShell>
      <PageHeader
        eyebrow="Sales document"
        title={sale?.invoiceNumber || (error ? "Invoice" : "Loading invoice…")}
        description={sale?.createdAt ? new Date(sale.createdAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : undefined}
        actions={
          <Link className={ui.secondary} href="/invoices">
            <Icon name="left" size={14} />
            Back to invoices
          </Link>
        }
      />

      {error ? (
        <section className={ui.panel}>
          <EmptyState
            icon="alert"
            title="We couldn't load this invoice"
            body={error}
            action={
              <Link className={ui.secondary} href="/invoices">
                Back to invoices
              </Link>
            }
          />
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${ui.panel} ${ui.panelFlush}`}>
            <div className={ui.panelHead}>
              <div>
                <h2>Items</h2>
                <p>{sale ? `${items.length} line${items.length === 1 ? "" : "s"} · ${units} unit${units === 1 ? "" : "s"}` : "Loading…"}</p>
              </div>
            </div>
            <div className={`${ui.tableWrap} ${ui.tableBare}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!sale ? (
                    <TableSkeletonRows cols={4} rows={3} />
                  ) : (
                    items.map((item, index) => (
                      <tr key={`${item.barcode || item.name || "item"}-${index}`}>
                        <td>
                          <span className="block font-medium">{item.name || "Product"}</span>
                          {item.barcode && <span className="font-mono text-[11.5px] text-[var(--faint)]">{item.barcode}</span>}
                        </td>
                        <td className="text-right font-mono">{item.quantity}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{money(item.price)}</td>
                        <td className="text-right font-mono font-medium">{money(item.total ?? Number(item.price || 0) * item.quantity)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className={`${ui.panel} ${ui.panelFlush}`}>
            <div className={ui.panelHead}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={ui.productThumbPlaceholder}>
                  <Icon name="user" size={15} />
                </span>
                <div className="min-w-0">
                  {sale ? <h2 className="truncate">{customerName}</h2> : <Skeleton className="h-4 w-32" />}
                  {customerMobile && <p className="font-mono">{customerMobile}</p>}
                </div>
              </div>
            </div>
            <dl className={`${ui.kv} ${ui.panelBody}`}>
              <div>
                <dt>Payment</dt>
                <dd>{sale ? <span className={`${ui.chip} ${isCash ? ui.chipPos : ui.chipInfo} capitalize`}>{sale.paymentMethod || "Not specified"}</span> : "…"}</dd>
              </div>
              <div>
                <dt>Units</dt>
                <dd className="font-mono">{sale ? units : "…"}</dd>
              </div>
              <div className={ui.kvTotal}>
                <dt>Total</dt>
                <dd className="font-mono text-[18px]">{sale ? money(sale.totalAmount) : "…"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </WorkspaceShell>
  );
}
