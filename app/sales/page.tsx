"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { useLanguage } from "@/app/components/language-context";
import { api } from "@/app/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavRole } from "@/hooks/useNavRole";
import { PosReceiptModal, ReceiptSale } from "@/app/components/pos-receipt-modal";
import { PaginationControls } from "@/app/components/pagination-controls";
import { PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { CompositionBar, Money, formatRs } from "@/app/components/figures";
import { Icon } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";
import s from "./sales.module.css";

type Range = "today" | "yesterday" | "week" | "month" | "all";

/** One row in the table, normalised from either /reports/sales or /sales */
type Row = {
  id: number;
  invoiceNumber: string;
  createdAt: string;
  customer: string;
  customerMobile?: string | null;
  items: number;
  paymentMethod: string;
  staff: string;
  total: number;
  discount: number;
};

type ReportResponse = {
  summary: { totalRevenue: number; totalOrders: number; totalItems: number; totalDiscounts: number; averageOrder: number; cashTotal: number; onlineTotal: number };
  sales: Array<{ id: number; invoiceNumber: string; totalAmount: number | string; totalItems: number; discountAmount: number | string; paymentMethod: string; customerName: string; customerMobile?: string | null; cashier: string; createdAt: string }>;
  pagination?: { total?: number };
};

type ListResponse = {
  sales: Array<{
    id: number;
    invoiceNumber: string;
    customerName?: string | null;
    customerMobile?: string | null;
    totalAmount: number | string;
    discountAmount: number | string;
    paymentMethod: string;
    createdAt: string;
    customer?: { name: string; mobile: string } | null;
    user?: { fullName: string; email: string } | null;
    itemCount: number;
  }>;
  total: number;
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isCash = (m?: string) => String(m || "cash").toLowerCase() === "cash";

export default function SalesPage() {
  const { activeBusiness } = useBusiness();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const navRole = useNavRole();
  const canReport = navRole === "admin" || navRole === "accountant";
  const canSell = navRole === "admin" || navRole === "staff";

  const [chosenRange, setRange] = useState<Range | null>(null);
  const range: Range = chosenRange ?? (canReport ? "today" : "all");
  const [payment, setPayment] = useState<"all" | "cash" | "online">("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ReportResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptSale | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<number | null>(null);

  // Staff can't open reports — they always see the full list
  const effectiveRange: Range = canReport ? range : "all";

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setFailed(false);
    try {
      if (effectiveRange === "all") {
        const data = await api<ListResponse>(`/sales?page=${page}&limit=${pageSize}`);
        setRows(
          (data.sales || []).map((x) => ({
            id: x.id,
            invoiceNumber: x.invoiceNumber,
            createdAt: x.createdAt,
            customer: x.customer?.name || x.customerName || "Walk-in Customer",
            customerMobile: x.customer?.mobile || x.customerMobile,
            items: x.itemCount || 1,
            paymentMethod: x.paymentMethod,
            staff: x.user?.fullName || x.user?.email || "Staff",
            total: Number(x.totalAmount || 0),
            discount: Number(x.discountAmount || 0),
          })),
        );
        setTotal(data.total || 0);
        setSummary(null);
      } else {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const qs =
          effectiveRange === "today"
            ? `period=daily&date=${ymd(today)}`
            : effectiveRange === "yesterday"
            ? `period=daily&date=${ymd(yesterday)}`
            : effectiveRange === "week"
            ? "period=weekly"
            : "period=monthly";
        const data = await api<ReportResponse>(`/reports/sales?${qs}&page=${page}&limit=${pageSize}`);
        setRows(
          (data.sales || []).map((x) => ({
            id: x.id,
            invoiceNumber: x.invoiceNumber,
            createdAt: x.createdAt,
            customer: x.customerName || "Walk-in Customer",
            customerMobile: x.customerMobile,
            items: x.totalItems || 1,
            paymentMethod: x.paymentMethod,
            staff: x.cashier || "Staff",
            total: Number(x.totalAmount || 0),
            discount: Number(x.discountAmount || 0),
          })),
        );
        setTotal(data.pagination?.total ?? data.summary.totalOrders ?? 0);
        setSummary(data.summary);
      }
    } catch (err) {
      setFailed(true);
      showToast(err instanceof Error ? err.message : "Failed to load sales.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeBusiness, effectiveRange, page, pageSize, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sales completed from the New Sale drawer
  useEffect(() => {
    const onSale = () => void load();
    window.addEventListener("almadel:sale-completed", onSale);
    return () => window.removeEventListener("almadel:sale-completed", onSale);
  }, [load]);

  const visible = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return rows.filter((r) => {
      if (payment === "cash" && !isCash(r.paymentMethod)) return false;
      if (payment === "online" && isCash(r.paymentMethod)) return false;
      if (!q) return true;
      return [r.invoiceNumber, r.customer, r.customerMobile || "", r.staff].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, debounced, payment]);

  const openReceipt = async (row: Row) => {
    setLoadingReceiptId(row.id);
    try {
      setReceipt(await api<ReceiptSale>(`/sales/${row.id}`));
    } catch {
      setReceipt({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        createdAt: row.createdAt,
        customerName: row.customer,
        customerMobile: row.customerMobile || "",
        subtotal: row.total + row.discount,
        discountAmount: row.discount,
        totalAmount: row.total,
        paymentMethod: row.paymentMethod,
        cashierName: row.staff,
        items: [],
      });
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const exportCsv = () => {
    const header = ["Invoice", "Date", "Customer", "Items", "Payment", "Staff", "Discount", "Amount"];
    const lines = visible.map((r) =>
      [r.invoiceNumber, new Date(r.createdAt).toLocaleString("en-PK"), r.customer, r.items, r.paymentMethod, r.staff, r.discount, r.total]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `almadel-sales-${effectiveRange}-${ymd(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const multiDay = effectiveRange === "week" || effectiveRange === "month" || effectiveRange === "all";
  const ranges: Array<[Range, string]> = [
    ["today", t("sales.today", "Today")],
    ["yesterday", t("sales.yesterday", "Yesterday")],
    ["week", "7D"],
    ["month", "30D"],
    ["all", t("sales.all", "All")],
  ];

  return (
    <WorkspaceShell>
      <PageHeader
        title={t("nav.sales", "Sales")}
        actions={
          <>
            <button type="button" className={ui.secondary} onClick={exportCsv} disabled={!visible.length}>
              <Icon name="download" size={15} />
              {t("sales.export", "Export")}
            </button>
            {canSell && (
              <button type="button" className={ui.primary} onClick={() => window.dispatchEvent(new CustomEvent("almadel:open-new-sale"))}>
                <Icon name="plus" size={15} strokeWidth={2.2} />
                {t("bar.new_sale", "New sale")}
              </button>
            )}
          </>
        }
      />

      <div className={s.filters}>
        <label className={s.search}>
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("sales.search_placeholder", "Invoice, customer or staff")}
            aria-label={t("sales.search", "Search sales")}
          />
        </label>
        {canReport && (
          <div className={ui.segmented} role="tablist" aria-label={t("sales.range", "Date range")}>
            {ranges.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={range === id}
                className={range === id ? ui.segmentedOn : ""}
                onClick={() => {
                  setRange(id);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className={ui.segmented} role="tablist" aria-label={t("sales.payment", "Payment method")}>
          {(
            [
              ["all", t("sales.all_methods", "All methods"), null],
              ["cash", t("payment.cash", "Cash"), "var(--c-cash)"],
              ["online", t("payment.online", "Online"), "var(--c-online)"],
            ] as const
          ).map(([id, label, color]) => (
            <button key={id} type="button" role="tab" aria-selected={payment === id} className={payment === id ? ui.segmentedOn : ""} onClick={() => setPayment(id)}>
              {color && <i className={s.dot} style={{ background: color }} />}
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={`${ui.iconButton} ${s.refresh}`} onClick={() => void load()} disabled={loading} aria-label={t("action.refresh", "Refresh")}>
          <Icon name="refresh" size={15} className={loading ? s.spinning : undefined} />
        </button>
      </div>

      {summary && (
        <section className={s.strip} aria-label={t("sales.summary", "Summary")}>
          <div className={s.stat}>
            <span className={s.eyebrow}>{t("sales.net_sales", "Net sales")}</span>
            <Money value={summary.totalRevenue} size="lg" />
          </div>
          <div className={s.stat}>
            <small>{t("sales.bills", "Bills")}</small>
            <b className={s.mono}>{summary.totalOrders}</b>
          </div>
          <div className={s.stat}>
            <small>{t("sales.average_bill", "Average bill")}</small>
            <b className={s.mono}>{formatRs(summary.averageOrder)}</b>
          </div>
          <div className={s.stat}>
            <small>{t("sales.gross", "Gross")}</small>
            <b className={s.mono}>{formatRs(summary.totalRevenue + summary.totalDiscounts)}</b>
          </div>
          <div className={s.stat}>
            <small>{t("sales.discounts", "Discounts")}</small>
            <b className={`${s.mono} ${summary.totalDiscounts ? s.neg : ""}`}>{summary.totalDiscounts ? `− ${formatRs(summary.totalDiscounts)}` : "0"}</b>
          </div>
          <div className={s.stat}>
            <small>{t("sales.items_sold", "Items sold")}</small>
            <b className={s.mono}>{summary.totalItems}</b>
          </div>
          <div className={s.comp}>
            <CompositionBar
              segments={[
                { label: t("payment.cash", "Cash"), value: summary.cashTotal, color: "var(--c-cash)" },
                { label: t("payment.online", "Online"), value: summary.onlineTotal, color: "var(--c-online)" },
              ]}
            />
          </div>
        </section>
      )}

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>{t("sales.invoice", "Invoice")}</th>
                <th style={{ width: multiDay ? 150 : 100 }}>{multiDay ? t("sales.date", "Date") : t("sales.time", "Time")}</th>
                <th>{t("sales.customer", "Customer")}</th>
                <th style={{ width: 80 }}>{t("sales.items", "Items")}</th>
                <th style={{ width: 120 }}>{t("sales.payment", "Payment")}</th>
                <th style={{ width: 130 }}>{t("sales.staff", "Staff")}</th>
                <th className="text-right" style={{ width: 140 }}>
                  {t("sales.amount", "Amount")}
                </th>
                <th style={{ width: 56 }} aria-label={t("sales.receipt", "Receipt")} />
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <TableSkeletonRows cols={8} rows={6} />
              ) : failed ? (
                <TableEmptyRow
                  colSpan={8}
                  icon="alert"
                  title={t("sales.load_failed", "Sales couldn't be loaded")}
                  body={t("sales.load_failed_body", "Check your connection and try again. Nothing was changed.")}
                  action={
                    <button type="button" className={ui.primary} onClick={() => void load()}>
                      <Icon name="refresh" size={15} />
                      {t("action.try_again", "Try again")}
                    </button>
                  }
                />
              ) : visible.length === 0 ? (
                <TableEmptyRow
                  colSpan={8}
                  icon="invoice"
                  title={query ? t("sales.no_match", "No sales match your search") : t("sales.none", "No sales recorded in this period.")}
                  body={query ? t("sales.no_match_body", "Try an invoice number, customer name or staff member.") : t("sales.none_body", "Your next sale will appear here instantly.")}
                  action={
                    !query && canSell ? (
                      <button type="button" className={ui.primary} onClick={() => window.dispatchEvent(new CustomEvent("almadel:open-new-sale"))}>
                        <Icon name="plus" size={15} strokeWidth={2.2} />
                        {t("sales.create", "Create new sale")}
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                visible.map((r) => (
                  <tr key={r.id}>
                    <td className={`${s.mono} ${s.ink}`}>{r.invoiceNumber}</td>
                    <td className={s.mono}>
                      {multiDay
                        ? new Date(r.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                        : new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td>
                      <span className={r.customer === "Walk-in Customer" ? undefined : s.ink}>{r.customer === "Walk-in Customer" ? t("sales.walk_in", "Walk-in") : r.customer}</span>
                      {r.customerMobile ? <span className={s.subMono}>{r.customerMobile}</span> : null}
                    </td>
                    <td className={s.mono}>{r.items}</td>
                    <td>
                      <span className={ui.chip}>
                        <i className={s.dot} style={{ background: isCash(r.paymentMethod) ? "var(--c-cash)" : "var(--c-online)" }} />
                        {isCash(r.paymentMethod) ? t("payment.cash", "Cash") : t("payment.online", "Online")}
                      </span>
                    </td>
                    <td>{r.staff}</td>
                    <td className={s.amount}>
                      {formatRs(r.total)}
                      {r.discount > 0 && <span className={s.off}>−{formatRs(r.discount)}</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${ui.iconButton} ${s.rowBtn}`}
                        onClick={() => void openReceipt(r)}
                        disabled={loadingReceiptId === r.id}
                        aria-label={`${t("sales.receipt", "Receipt")} ${r.invoiceNumber}`}
                        title={t("sales.receipt", "Receipt")}
                      >
                        {loadingReceiptId === r.id ? <span className={s.spin} /> : <Icon name="printer" size={15} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <PaginationControls
            currentPage={page}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="sales"
          />
        )}
      </section>

      <PosReceiptModal isOpen={Boolean(receipt)} onClose={() => setReceipt(null)} sale={receipt} />
    </WorkspaceShell>
  );
}
