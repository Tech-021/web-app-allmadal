"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import { WorkspaceShell } from "@/app/components/workspace-shell";
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

  return <WorkspaceShell><div className={ui.head}><div><label>Sales document</label><h1>{sale?.invoiceNumber || "Invoice"}</h1><p>{sale?.createdAt ? new Date(sale.createdAt).toLocaleString() : "Loading invoice details..."}</p></div><Link className={ui.secondary} href="/invoices">Back to invoices</Link></div>
    {error ? <div className={ui.error}>{error}</div> : !sale ? <section className={ui.panel}><p className={ui.empty}>Loading invoice...</p></section> : <section className={ui.panel}><div className="mb-5"><strong>{sale.customer?.name || sale.customerName || "Walk-in customer"}</strong>{(sale.customer?.mobile || sale.customerMobile) && <p className={ui.muted}>{sale.customer?.mobile || sale.customerMobile}</p>}</div><div className={ui.tableWrap}><table className={ui.table}><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{(sale.items || []).map((item, index) => <tr key={`${item.barcode || item.name || "item"}-${index}`}><td>{item.name || "Product"}</td><td>{item.quantity}</td><td>{money(item.price)}</td><td>{money(item.total ?? Number(item.price || 0) * item.quantity)}</td></tr>)}</tbody></table></div><div className="flex justify-end pt-5 text-lg"><strong>Total: {money(sale.totalAmount)}</strong></div><p className={ui.muted}>Payment: {sale.paymentMethod || "Not specified"}</p></section>}
  </WorkspaceShell>;
}
