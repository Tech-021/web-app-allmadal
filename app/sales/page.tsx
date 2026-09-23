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
      }>(`/sales?page=${currentPage}&limit=25`);

      setSales(data.sales || []);
      setTotalSalesCount(data.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load sales history.";
      showToast(msg, "error");
    } finally {
      setLoadingHistory(false);
    }
  }, [activeBusiness, currentPage, showToast]);

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
      <div className="space-y-6 pb-12">
        {/* Top Header & Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Point of Sale
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeBusiness?.name || "Retail Counter"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Sales & Billing Counter
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create instant retail bills, scan barcodes, print customer receipts, and track sales history.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Switcher Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode("pos")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === "pos"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🛒</span>
                <span>POS Counter</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("history")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === "history"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>📋</span>
                <span>Sales History ({totalSalesCount})</span>
              </button>
            </div>

            {/* Quick Add Sale Button */}
            <button
              type="button"
              onClick={() => setAddSaleModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm transition active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Sale</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: POS COUNTER TERMINAL */}
        {viewMode === "pos" && (
          <div className="transition-all duration-300">
            <PosTerminal onSaleCompleted={handleSaleCompleted} />
          </div>
        )}

        {/* VIEW 2: SALES HISTORY & INVOICES */}
        {viewMode === "history" && (
          <div className="space-y-6">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Today&apos;s Revenue
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  Rs {metrics.todayRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-1">Cash & Online collections today</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Today&apos;s Invoices
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.todayInvoices}
                </div>
                <div className="text-xs text-slate-400 mt-1">Orders processed today</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Items Sold Today
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.todayItems}
                </div>
                <div className="text-xs text-slate-400 mt-1">Total product units dispensed</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Recorded Invoices
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.allTimeCount}
                </div>
                <div className="text-xs text-slate-400 mt-1">Across all dates</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search invoice # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs bg-slate-50 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setFilterPayment("ALL")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      filterPayment === "ALL"
                        ? "bg-white dark:bg-slate-700 font-semibold text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPayment("CASH")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      filterPayment === "CASH"
                        ? "bg-emerald-600 text-white font-semibold shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPayment("ONLINE")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      filterPayment === "ONLINE"
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Online
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => loadSalesHistory()}
                  disabled={loadingHistory}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {loadingHistory && sales.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="inline-block animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mb-3" />
                  <p className="text-sm">Loading sales history...</p>
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="py-16 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-2xl">
                    🧾
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {searchQuery ? "No matching invoices found" : "No sales recorded yet"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
                    {searchQuery
                      ? "Try searching with a different invoice number or customer name."
                      : "Start processing retail orders at your counter to see invoices and print receipts."}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewMode("pos")}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm cursor-pointer"
                    >
                      🛒 Open POS Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddSaleModalOpen(true)}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition cursor-pointer"
                    >
                      + Quick Add Sale
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                        <th className="px-4 py-3.5">Invoice #</th>
                        <th className="px-4 py-3.5">Date & Time</th>
                        <th className="px-4 py-3.5">Customer</th>
                        <th className="px-4 py-3.5 text-center">Items</th>
                        <th className="px-4 py-3.5">Payment</th>
                        <th className="px-4 py-3.5 text-right">Amount</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {customerDisplay}
                              </div>
                              {customerMobile && (
                                <div className="text-xs text-slate-400 font-mono">
                                  {customerMobile}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {sale.itemCount || 1} items
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  sale.paymentMethod?.toUpperCase() === "CASH"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                }`}
                              >
                                {sale.paymentMethod || "CASH"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                              Rs {sale.totalAmount.toLocaleString()}
                              {sale.discountAmount > 0 && (
                                <span className="block text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                                  -Rs {sale.discountAmount.toLocaleString()} off
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleViewReceipt(sale)}
                                disabled={loadingReceiptId === sale.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 text-slate-700 dark:text-slate-300 dark:hover:text-emerald-400 text-xs font-medium transition cursor-pointer"
                              >
                                {loadingReceiptId === sale.id ? (
                                  <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
              {totalSalesCount > 25 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <div>
                    Page {currentPage} of {Math.ceil(totalSalesCount / 25)} ({totalSalesCount} total sales)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= Math.ceil(totalSalesCount / 25)}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
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
