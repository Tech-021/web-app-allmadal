"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { PosTerminal } from "@/app/components/pos-terminal";
import { AddSaleModal } from "@/app/components/add-sale-modal";
import { PosReceiptModal, ReceiptSale } from "@/app/components/pos-receipt-modal";
import { PaginationControls } from "@/app/components/pagination-controls";

interface SaleListItem {
  id: number;
  invoiceNumber: string;
  customerName?: string | null;
  customerMobile?: string | null;
  subtotal: number;
  discountAmount: number;
  discountType?: string | null;
  discountValue?: number | null;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  customer?: { name: string; mobile: string } | null;
  user?: { fullName: string; email: string } | null;
  itemCount: number;
}

export default function SalesPage() {
  const { activeBusiness } = useBusiness();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<"pos" | "history">("pos");
  const [addSaleModalOpen, setAddSaleModalOpen] = useState(false);

  // Sales History State
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [filterPayment, setFilterPayment] = useState<"ALL" | "CASH" | "ONLINE">("ALL");

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptSale | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [loadingReceiptId, setLoadingReceiptId] = useState<number | null>(null);

  // Load Sales History
  const loadSalesHistory = useCallback(async () => {
    if (!activeBusiness) return;
    setLoadingHistory(true);
    try {
      const data = await api<{
        sales: SaleListItem[];
        total: number;
        page: number;
        limit: number;
      }>(`/sales?page=${currentPage}&limit=${pageSize}`);

      setSales(data.sales || []);
      setTotalSalesCount(data.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load sales history.";
      showToast(msg, "error");
    } finally {
      setLoadingHistory(false);
    }
  }, [activeBusiness, currentPage, pageSize, showToast]);

  useEffect(() => {
    loadSalesHistory();
  }, [loadSalesHistory]);

  // Handle completed sale from POS or AddSaleModal
  const handleSaleCompleted = (invoice?: ReceiptSale) => {
    loadSalesHistory();
    if (invoice) {
      setSelectedReceipt(invoice);
      setReceiptModalOpen(true);
    }
  };

  // Open receipt for existing invoice in history
  const handleViewReceipt = async (sale: SaleListItem) => {
    setLoadingReceiptId(sale.id);
    try {
      const fullInvoice = await api<ReceiptSale>(`/sales/${sale.id}`);
      setSelectedReceipt(fullInvoice);
      setReceiptModalOpen(true);
    } catch {
      // Fallback with available summary data
      setSelectedReceipt({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        createdAt: sale.createdAt,
        customerName: sale.customer?.name || sale.customerName || "Walk-in Customer",
        customerMobile: sale.customer?.mobile || sale.customerMobile || "",
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        cashierName: sale.user?.fullName || sale.user?.email || "Staff",
        items: [],
      });
      setReceiptModalOpen(true);
    } finally {
      setLoadingReceiptId(null);
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todaySales = sales.filter((s) => s.createdAt.startsWith(today));
    const todayRevenue = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const todayInvoices = todaySales.length;
    const todayItems = todaySales.reduce((acc, s) => acc + (s.itemCount || 0), 0);

    return {
      todayRevenue,
      todayInvoices,
      todayItems,
      allTimeCount: totalSalesCount,
    };
  }, [sales, totalSalesCount]);

  // Client-side filtered list for search & payment method
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const query = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        !query ||
        sale.invoiceNumber.toLowerCase().includes(query) ||
        (sale.customer?.name && sale.customer.name.toLowerCase().includes(query)) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(query)) ||
        (sale.customerMobile && sale.customerMobile.includes(query));

      const matchesPayment =
        filterPayment === "ALL" ||
        sale.paymentMethod?.toUpperCase() === filterPayment;

      return matchesSearch && matchesPayment;
    });
  }, [sales, debouncedSearch, filterPayment]);

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-5 pb-6">
        {/* Top Header & Action Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center h-[22px] text-[11.5px] font-medium px-2 rounded-full bg-[var(--brand-soft)] text-[var(--brand-ink)]">
                Point of Sale
              </span>
              <span className="text-[12.5px] text-[var(--muted)]">
                {activeBusiness?.name || "Retail Counter"}
              </span>
            </div>
            <h1 className="m-0 mt-2 text-[24px] md:text-[26px] font-semibold tracking-[-0.025em] text-[var(--text)]">
              Sales & Billing Counter
            </h1>
            <p className="m-0 mt-1.5 text-[13.5px] text-[var(--muted)]">
              Create instant retail bills, scan barcodes, print customer receipts, and track sales history.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Switcher Toggle */}
            <div className="inline-flex rounded-[10px] border border-[var(--border)] bg-[var(--sunken)] p-[3px] gap-0.5 text-[12.5px] font-medium" role="tablist">
              <button
                type="button"
                onClick={() => setViewMode("pos")}
                className={`h-8 px-3 rounded-[7px] transition-colors flex items-center gap-1.5 ${
                  viewMode === "pos"
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                    : "text-slate-600 hover:text-slate-900 "
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6.2M9 20.5h.01M18 20.5h.01" /></svg>
                <span>POS Counter</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("history")}
                className={`h-8 px-3 rounded-[7px] transition-colors flex items-center gap-1.5 ${
                  viewMode === "history"
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                    : "text-slate-600 hover:text-slate-900 "
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2.5H6.5v19h11V6zM14 2.5V6h3.5M9.5 11h5M9.5 15h5" /></svg>
                <span>Sales History ({totalSalesCount})</span>
              </button>
            </div>

            {/* Quick Add Sale Button */}
            <button
              type="button"
              onClick={() => setAddSaleModalOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] text-[var(--text)] font-medium text-[13px] shadow-[var(--shadow-xs)] transition active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Sale</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: POS COUNTER TERMINAL */}
        {viewMode === "pos" && (
          <div className="al-page-enter">
            <PosTerminal onSaleCompleted={handleSaleCompleted} />
          </div>
        )}

        {/* VIEW 2: SALES HISTORY & INVOICES */}
        {viewMode === "history" && (
          <div className="flex flex-col gap-5 al-page-enter">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] overflow-hidden [&>div]:border-[var(--border)] [&>div:nth-child(n+2)]:lg:border-l [&>div:nth-child(even)]:border-l [&>div:nth-child(n+3)]:max-lg:border-t">
              <div className="p-4">
                <div className="text-[12.5px] text-[var(--text-2)]">
                  Today&apos;s Revenue
                </div>
                <div className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--text)] mt-1.5">
                  Rs {metrics.todayRevenue.toLocaleString()}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-1">Cash & Online collections today</div>
              </div>

              <div className="p-4">
                <div className="text-[12.5px] text-[var(--text-2)]">
                  Today&apos;s Invoices
                </div>
                <div className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--text)] mt-1.5">
                  {metrics.todayInvoices}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-1">Orders processed today</div>
              </div>

              <div className="p-4">
                <div className="text-[12.5px] text-[var(--text-2)]">
                  Items Sold Today
                </div>
                <div className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--text)] mt-1.5">
                  {metrics.todayItems}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-1">Total product units dispensed</div>
              </div>

              <div className="p-4">
                <div className="text-[12.5px] text-[var(--text-2)]">
                  Total Recorded Invoices
                </div>
                <div className="text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--text)] mt-1.5">
                  {metrics.allTimeCount}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-1">Across all dates</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search invoice # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-[13.5px] rounded-[9px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--ring)]"
                />
                <svg
                  className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setFilterPayment("ALL")}
                    className={`h-7 px-2.5 rounded-md transition ${
                      filterPayment === "ALL"
                        ? "bg-[var(--surface)] text-[var(--text)] font-medium shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                        : "text-slate-500 hover:text-slate-800 "
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPayment("CASH")}
                    className={`h-7 px-2.5 rounded-md transition ${
                      filterPayment === "CASH"
                        ? "bg-[var(--surface)] text-[var(--text)] font-medium shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                        : "text-slate-500 hover:text-slate-800 "
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPayment("ONLINE")}
                    className={`h-7 px-2.5 rounded-md transition ${
                      filterPayment === "ONLINE"
                        ? "bg-[var(--surface)] text-[var(--text)] font-medium shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                        : "text-slate-500 hover:text-slate-800 "
                    }`}
                  >
                    Online
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => loadSalesHistory()}
                  disabled={loadingHistory}
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                  title="Refresh Sales"
                >
                  <svg
                    className={`w-4 h-4 ${loadingHistory ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sales Table / Empty State */}
            <div className="bg-[var(--surface)] rounded-[14px] border border-[var(--border)] shadow-[var(--shadow-xs)] overflow-hidden">
              {loadingHistory && sales.length === 0 ? (
                <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading sales history">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="al-skeleton block h-3.5 w-24" />
                      <span className="al-skeleton block h-3.5 flex-1" />
                      <span className="al-skeleton block h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="py-16 text-center px-4">
                  <div className="size-11 rounded-xl bg-[var(--surface-2)] text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--border)] grid place-items-center mx-auto mb-3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2.5H6.5v19h11V6zM14 2.5V6h3.5M9.5 11h5M9.5 15h5" /></svg></div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {searchQuery ? "No matching invoices found" : "No sales recorded yet"}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                    {searchQuery
                      ? "Try searching with a different invoice number or customer name."
                      : "Start processing retail orders at your counter to see invoices and print receipts."}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewMode("pos")}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-[var(--shadow-xs)] cursor-pointer"
                    >
                      Open POS Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddSaleModalOpen(true)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition cursor-pointer"
                    >
                      + Quick Add Sale
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] text-[11.5px] font-medium">
                        <th className="px-4 py-2.5">Invoice #</th>
                        <th className="px-4 py-2.5">Date & Time</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5 text-center">Items</th>
                        <th className="px-4 py-2.5">Payment</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSales.map((sale) => {
                        const dateFormatted = new Date(sale.createdAt).toLocaleString("en-PK", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        });
                        const customerDisplay =
                          sale.customer?.name || sale.customerName || "Walk-in Customer";
                        const customerMobile =
                          sale.customer?.mobile || sale.customerMobile || "";

                        return (
                          <tr
                            key={sale.id}
                            className="hover:bg-[var(--hl)] transition-colors"
                          >
                            <td className="px-4 py-3 font-mono text-[12.5px] text-[var(--text)]">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">
                                {customerDisplay}
                              </div>
                              {customerMobile && (
                                <div className="font-mono text-[11.5px] text-[var(--faint)]">
                                  {customerMobile}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-[12.5px] text-[var(--text-2)]">{sale.itemCount || 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex h-[22px] items-center rounded-[6px] px-2 text-[11.5px] font-medium capitalize ${
                                  sale.paymentMethod?.toUpperCase() === "CASH"
                                    ? "bg-[var(--brand-soft)] text-[var(--pos)] shadow-[inset_0_0_0_1px_var(--brand-line)]"
                                    : "bg-[var(--info-soft)] text-[var(--info)]"
                                }`}
                              >
                                {sale.paymentMethod || "CASH"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--text)]">
                              Rs {sale.totalAmount.toLocaleString()}
                              {sale.discountAmount > 0 && (
                                <span className="block font-mono text-[11px] font-normal text-[var(--pos)]">
                                  -Rs {sale.discountAmount.toLocaleString()} off
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleViewReceipt(sale)}
                                disabled={loadingReceiptId === sale.id}
                                className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] cursor-pointer"
                              >
                                {loadingReceiptId === sale.id ? (
                                  <span className="size-3 rounded-full border-2 border-[var(--brand)] border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                                ) : (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                    />
                                  </svg>
                                )}
                                <span>Receipt</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              {totalSalesCount > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={totalSalesCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                  itemLabel="sales"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Sale Modal */}
      <AddSaleModal
        isOpen={addSaleModalOpen}
        onClose={() => setAddSaleModalOpen(false)}
        onSaleCompleted={handleSaleCompleted}
      />

      {/* POS Thermal & A4 Receipt Modal */}
      <PosReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setSelectedReceipt(null);
        }}
        sale={selectedReceipt}
      />
    </WorkspaceShell>
  );
}
