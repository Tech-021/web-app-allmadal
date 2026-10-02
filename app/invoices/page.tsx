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
import { Icon } from "@/app/components/icons";
import { PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";

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
      <PageHeader
        eyebrow={language === "ur" ? "Bikri o Raseedein" : "Sales & receipts"}
        title={t("invoices.title")}
        description={
          language === "ur"
            ? "Tamam pichli bikri ki raseedein, print aur mukammal customer records."
            : `Customer sales receipts and invoice records for ${activeBusiness?.name || "Active Store"}.`
        }
        actions={
          <button className={ui.secondary} onClick={() => void loadInvoices()}>
            <Icon name="refresh" size={14} className={loading ? "[animation:almadelSpin_800ms_linear_infinite]" : ""} />
            {t("action.refresh")}
          </button>
        }
      />

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.panelHead}>
          <input
            className={`${ui.input} ${ui.search} max-w-[440px]`}
            placeholder={t("invoices.search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search invoices"
          />
          <span className={`${ui.chip} hidden sm:inline-flex`}>
            <span className="font-mono">{filteredRows.length}</span> invoices
          </span>
        </div>
        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>{t("table.invoice_number")}</th>
                <th>{t("table.date")}</th>
                <th>{t("table.customer")}</th>
                <th className="text-right">{t("table.total_amount")}</th>
                <th>{t("table.payment_mode")}</th>
                <th className="text-right">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeletonRows cols={6} />
              ) : filteredRows.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  icon="invoice"
                  title={query.trim() ? "No matching invoices" : t("table.no_records")}
                  body={query.trim() ? "Try another invoice number or customer name." : "Receipts appear here as soon as a sale is completed at the counter."}
                />
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
                  const isCash = String(r.paymentMethod || "cash").toLowerCase() === "cash";

                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => openReceipt(r)} title="Preview printable invoice">
                      <td className="font-mono text-[12.5px] text-[var(--brand-ink)]">{invoiceDisplay}</td>
                      <td className="font-mono text-[12px] text-[var(--muted)]">{dateDisplay}</td>
                      <td className="font-medium">{customerDisplay}</td>
                      <td className="text-right font-mono font-medium">{money(r.totalAmount)}</td>
                      <td>
                        <span className={`${ui.chip} ${isCash ? ui.chipPos : ui.chipInfo} capitalize`}>{r.paymentMethod || "Cash"}</span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className={`${ui.secondary} ${ui.btnSm}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openReceipt(r);
                          }}
                        >
                          <Icon name="eye" size={13} />
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
