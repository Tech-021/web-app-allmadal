"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/app/components/language-context";
import ui from "@/app/components/workspace-ui.module.css";

interface InvoiceRecord {
  id: number | string;
  invoiceNumber?: string;
  createdAt: string;
  customerName?: string;
  customer?: { name: string; mobile?: string };
  totalAmount: number;
  paymentMethod?: string;
  itemCount?: number;
  user?: { fullName: string };
}

const money = (v: number = 0) => `Rs ${Math.round(v).toLocaleString()}`;

export default function InvoicesPage() {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [activeReceipt, setActiveReceipt] = useState<DetailedSaleReceipt | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ sales: InvoiceRecord[] }>("/sales?limit=100");
      setRows(res.sales || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load invoices.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const filteredRows = useMemo(() => {
    if (!debouncedQuery.trim()) return rows;
    const q = debouncedQuery.toLowerCase().trim();
    return rows.filter((r) => {
      const invoiceNo = String(r.invoiceNumber || `#${String(r.id).slice(-4)}`).toLowerCase();
      const customer = String(r.customer?.name || r.customerName || "Walk-in").toLowerCase();
      return invoiceNo.includes(q) || customer.includes(q);
    });
  }, [rows, debouncedQuery]);

  const openReceipt = async (record: InvoiceRecord) => {
    try {
      const full = await api<DetailedSaleReceipt>(`/sales/${record.id}`);
      setActiveReceipt(full);
    } catch {
      setActiveReceipt({
        id: record.id,
        invoiceNumber: record.invoiceNumber || `INV-${String(record.id).padStart(4, "0")}`,
        createdAt: record.createdAt || new Date().toISOString(),
        customerName: record.customer?.name || record.customerName || "Walk-in Customer",
        customerMobile: record.customer?.mobile || null,
        subtotal: Number(record.totalAmount || 0),
        totalAmount: Number(record.totalAmount || 0),
        paymentMethod: record.paymentMethod || "cash",
        items: [],
      });
    }
  };

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>{language === "ur" ? "Bikri o Raseedein" : "Sales & Receipts"}</label>
          <h1>{t("invoices.title")}</h1>
          <p>
            {language === "ur"
              ? "Tamam pichli bikri ki raseedein, print aur mukammal customer records."
              : `Generated customer sales receipts and invoice records for ${activeBusiness?.name || "Active Store"}.`}
          </p>
        </div>

        <button className={ui.secondary} onClick={() => void loadInvoices()}>
          🔄 {t("action.refresh")}
        </button>
      </div>

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder={t("invoices.search_placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>{t("table.invoice_number")}</th>
                <th>{t("table.date")}</th>
                <th>{t("table.customer")}</th>
                <th>{t("table.total_amount")}</th>
                <th>{t("table.payment_mode")}</th>
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-24 my-1.5" /></td>
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-32 my-1.5" /></td>
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-28 my-1.5" /></td>
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-20 my-1.5" /></td>
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-16 my-1.5" /></td>
                    <td><div className="h-4 bg-slate-200/80 rounded-md w-14 my-1.5" /></td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={ui.empty}>
                    {t("table.no_records")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const invoiceDisplay = r.invoiceNumber || `INV-${String(r.id).padStart(4, "0")}`;
                  const customerDisplay = r.customer?.name || r.customerName || "Walk-in";
                  const dateDisplay = new Date(r.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer hover:bg-slate-50 transition"
                      onClick={() => openReceipt(r)}
                      title="Click to preview printable thermal invoice"
                    >
                      <td>
                        <strong className="text-slate-900 font-extrabold">{invoiceDisplay}</strong>
                      </td>
                      <td className="text-xs text-slate-500 font-medium">{dateDisplay}</td>
                      <td className="font-semibold text-slate-800">{customerDisplay}</td>
                      <td>
                        <strong className="text-[#00875a] font-bold">{money(r.totalAmount)}</strong>
                      </td>
                      <td>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize bg-slate-100 text-slate-700">
                          {r.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={ui.secondary}
                          style={{ padding: "4px 12px", fontSize: 11 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openReceipt(r);
                          }}
                        >
                          {t("table.view")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invoice / Receipt Modal */}
      <PosReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </WorkspaceShell>
  );
}
