"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { PaginationControls } from "@/app/components/pagination-controls";

type InvoiceItem = {
  id: number;
  name: string;
  barcode: string;
  quantity: number;
  refundedQuantity: number;
  total: number;
};

type InvoiceDetail = {
  id: number;
  invoiceNumber: string;
  customerName?: string | null;
  customerMobile?: string | null;
  totalAmount: number;
  refundedAmount: number;
  paymentMethod: string;
  createdAt: string;
  items: InvoiceItem[];
};

type RefundRow = {
  id: number;
  refundNumber: string;
  invoiceNumber: string | null;
  customerName: string | null;
  totalAmount: number;
  reason: string | null;
  paymentMethod: string;
  createdAt: string;
  processedBy: string;
  itemCount: number;
};

export default function RefundsPage() {
  const { activeBusiness } = useBusiness();
  const { showToast, confirmDialog } = useToast();

  const [viewMode, setViewMode] = useState<"process" | "history">("process");

  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [refundQty, setRefundQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!activeBusiness) return;
    setLoadingHistory(true);
    try {
      const data = await api<{
        refunds: RefundRow[];
        total: number;
      }>(`/refunds?page=${page}&limit=${pageSize}`);
      setRefunds(data.refunds ?? []);
      setTotalRefunds(data.total ?? 0);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load refund history.", "error");
    } finally {
      setLoadingHistory(false);
    }
  }, [activeBusiness, page, pageSize, showToast]);

  useEffect(() => {
    if (viewMode === "history") {
      void loadHistory();
    }
  }, [viewMode, loadHistory]);

  async function lookupInvoice() {
    const q = invoiceQuery.trim();
    if (!q) {
      showToast("Enter an invoice number.", "error");
      return;
    }
    setLoadingInvoice(true);
    setInvoice(null);
    setRefundQty({});
    try {
      const list = await api<{ sales: { id: number; invoiceNumber: string }[] }>(
        `/sales?invoiceNumber=${encodeURIComponent(q)}&limit=1`,
      );
      const sale = list.sales?.[0];
      if (!sale) {
        showToast("No invoice found with that number.", "error");
        return;
      }
      const detail = await api<InvoiceDetail>(`/sales/${sale.id}`);
      setInvoice(detail);
      const initial: Record<number, number> = {};
      for (const item of detail.items) {
        const remaining = Math.max(0, item.quantity - (item.refundedQuantity ?? 0));
        if (remaining > 0) initial[item.id] = 0;
      }
      setRefundQty(initial);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load invoice.", "error");
    } finally {
      setLoadingInvoice(false);
    }
  }

  const refundLines = useMemo(() => {
    if (!invoice) return [];
    return invoice.items
      .map((item) => {
        const remaining = Math.max(0, item.quantity - (item.refundedQuantity ?? 0));
        const qty = Math.min(remaining, Math.max(0, refundQty[item.id] ?? 0));
        const unit = item.quantity > 0 ? item.total / item.quantity : 0;
        return { item, remaining, qty, lineTotal: unit * qty };
      })
      .filter((row) => row.qty > 0);
  }, [invoice, refundQty]);

  const refundTotal = useMemo(
    () => refundLines.reduce((sum, row) => sum + row.lineTotal, 0),
    [refundLines],
  );

  async function submitRefund() {
    if (!invoice) return;
    if (refundLines.length === 0) {
      showToast("Set refund quantity for at least one item.", "error");
      return;
    }

    const ok = await confirmDialog({
      title: "Confirm refund?",
      message: `Refund Rs ${refundTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} to the customer and return items to stock?`,
      confirmLabel: "Process refund",
      danger: true,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api<{ refund: { refundNumber: string } }>("/refunds", {
        method: "POST",
        body: JSON.stringify({
          saleId: invoice.id,
          reason: reason.trim() || undefined,
          items: refundLines.map((row) => ({
            saleItemId: row.item.id,
            quantity: row.qty,
          })),
        }),
      });
      showToast(`Refund ${res.refund.refundNumber} recorded.`, "success");
      setInvoice(null);
      setInvoiceQuery("");
      setReason("");
      setRefundQty({});
      setViewMode("history");
      void loadHistory();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Refund failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Refunds
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Return items from a past sale, put stock back, and keep a full refund history.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("process")}
              className={`px-3 py-1.5 rounded-md transition ${
                viewMode === "process"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Process refund
            </button>
            <button
              type="button"
              onClick={() => setViewMode("history")}
              className={`px-3 py-1.5 rounded-md transition ${
                viewMode === "history"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              History ({totalRefunds})
            </button>
          </div>
        </div>

        {viewMode === "process" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Find invoice
              </label>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="text"
                  placeholder="e.g. ALM-20261002-ABC123"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <button
                  type="button"
                  disabled={loadingInvoice}
                  onClick={() => void lookupInvoice()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {loadingInvoice ? "Loading…" : "Load invoice"}
                </button>
              </div>
            </div>

            {invoice && (
              <div className="p-4 md:p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-sm text-slate-500">
                      {invoice.customerName || "Walk-in"} ·{" "}
                      {new Date(invoice.createdAt).toLocaleString()} · {invoice.paymentMethod}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      Invoice total:{" "}
                      <strong>Rs {invoice.totalAmount.toLocaleString()}</strong>
                    </div>
                    <div className="text-amber-700 dark:text-amber-400">
                      Already refunded: Rs {(invoice.refundedAmount ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-2">Product</th>
                      <th className="py-2 pr-2">Sold</th>
                      <th className="py-2 pr-2">Refunded</th>
                      <th className="py-2 pr-2">Refund now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => {
                      const remaining = Math.max(0, item.quantity - (item.refundedQuantity ?? 0));
                      return (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-2">
                            <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                            <div className="text-xs text-slate-400">{item.barcode}</div>
                          </td>
                          <td className="py-2 pr-2">{item.quantity}</td>
                          <td className="py-2 pr-2">{item.refundedQuantity ?? 0}</td>
                          <td className="py-2 pr-2">
                            {remaining === 0 ? (
                              <span className="text-xs text-slate-400">Fully refunded</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={remaining}
                                value={refundQty[item.id] ?? 0}
                                onChange={(e) => {
                                  const v = Math.min(
                                    remaining,
                                    Math.max(0, Number(e.target.value) || 0),
                                  );
                                  setRefundQty((prev) => ({ ...prev, [item.id]: v }));
                                }}
                                className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Reason (optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Damaged, wrong item, customer return…"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-sm">
                    Refund total:{" "}
                    <span className="text-lg font-bold text-rose-600">
                      Rs {refundTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={submitting || refundTotal <= 0}
                    onClick={() => void submitRefund()}
                    className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {submitting ? "Processing…" : "Complete refund"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "history" && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-4 py-3">Refund #</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : refunds.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No refunds yet.
                      </td>
                    </tr>
                  ) : (
                    refunds.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3 font-medium">{row.refundNumber}</td>
                        <td className="px-4 py-3">{row.invoiceNumber}</td>
                        <td className="px-4 py-3">{row.customerName || "—"}</td>
                        <td className="px-4 py-3 text-rose-600 font-semibold">
                          Rs {row.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{row.itemCount}</td>
                        <td className="px-4 py-3">{row.processedBy}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalRefunds > 0 && (
              <PaginationControls
                currentPage={page}
                totalItems={totalRefunds}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="refunds"
              />
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
