"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ReceiptModal, ReceiptSale } from "@/app/components/receipt-modal";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
import ui from "@/app/components/workspace-ui.module.css";

// --- TYPES ---
interface SalesReportData {
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalItems: number;
    totalDiscounts: number;
    averageOrder: number;
    cashTotal: number;
    onlineTotal: number;
  };
  breakdown: Array<{
    date: string;
    dayName: string;
    displayDate: string;
    orders: number;
    totalAmount: number;
    totalItems: number;
    discounts: number;
  }>;
  sales: Array<{
    id: number | string;
    invoiceNumber: string;
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
    totalItems: number;
    paymentMethod: string;
    customerName: string;
    customerMobile: string | null;
    cashier: string;
    createdAt: string;
  }>;
}

interface ProductReportData {
  summary: {
    totalCatalogProducts: number;
    productsWithSales: number;
    zeroSalesProducts: number;
    totalUnitsSold: number;
    totalSalesRevenue: number;
  };
  bestSelling: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    quantitySold: number;
    totalRevenue: number;
    tiedUpCapital: number;
    status: string;
  }>;
  leastSelling: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    quantitySold: number;
    totalRevenue: number;
    tiedUpCapital: number;
    status: string;
  }>;
}

interface StockReportData {
  summary: {
    totalProducts: number;
    totalUnits: number;
    totalRetailValue: number;
    totalCostValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    healthyCount: number;
  };
  inventory: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    stock: number;
    lowStockThreshold: number;
    sellingPrice: number;
    costPrice: number;
    totalRetailValue: number;
    totalCostValue: number;
    stockStatus: string;
    deficit: number;
  }>;
  lowStock: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    stock: number;
    lowStockThreshold: number;
    sellingPrice: number;
    costPrice: number;
    totalRetailValue: number;
    stockStatus: string;
    deficit: number;
  }>;
  outOfStock: Array<{
    id: number;
    name: string;
    barcode: string;
    category: string;
    stock: number;
    lowStockThreshold: number;
    sellingPrice: number;
    costPrice: number;
    totalRetailValue: number;
    stockStatus: string;
  }>;
}

const money = (v: number = 0) => `₨ ${Math.round(v).toLocaleString()}`;

export default function ReportsPage() {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const { t, language } = useLanguage();

  // Main Tabs: sales | products | stock
  const [activeTab, setActiveTab] = useState<"sales" | "products" | "stock">("sales");

  // Sub-tabs
  const [salesPeriod, setSalesPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [productType, setProductType] = useState<"best" | "least">("best");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  // Data states
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [productData, setProductData] = useState<ProductReportData | null>(null);
  const [stockData, setStockData] = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Active receipt modal preview
  const [activeReceipt, setActiveReceipt] = useState<ReceiptSale | null>(null);

  // Load Sales Report
  const loadSalesReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<SalesReportData>(`/reports/sales?period=${salesPeriod}`);
      setSalesData(res);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load sales report.", "error");
    } finally {
      setLoading(false);
    }
  }, [salesPeriod, showToast, activeBusiness?.id]);

  // Load Product Report
  const loadProductReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<ProductReportData>("/reports/products");
      setProductData(res);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load product report.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  // Load Stock Report
  const loadStockReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<StockReportData>("/reports/stock");
      setStockData(res);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load stock report.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    if (activeTab === "sales") {
      void loadSalesReport();
    } else if (activeTab === "products") {
      void loadProductReport();
    } else if (activeTab === "stock") {
      void loadStockReport();
    }
  }, [activeTab, salesPeriod, loadSalesReport, loadProductReport, loadStockReport]);

  // Export CSV Handler
  const handleExportCsv = () => {
    let filename = "";
    let csvContent = "";

    if (activeTab === "sales") {
      filename = `sales-report-${salesPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
      if (salesPeriod === "daily") {
        csvContent = "Invoice #,Date,Customer,Cashier,Items,Payment Method,Discount,Total\n";
        (salesData?.sales || []).forEach((s) => {
          csvContent += `"${s.invoiceNumber}","${s.createdAt}","${s.customerName}","${s.cashier}",${s.totalItems},"${s.paymentMethod}",${s.discountAmount},${s.totalAmount}\n`;
        });
      } else {
        csvContent = "Date,Day,Orders,Units Sold,Discounts,Total Amount\n";
        (salesData?.breakdown || []).forEach((b) => {
          csvContent += `"${b.date}","${b.dayName}",${b.orders},${b.totalItems},${b.discounts},${b.totalAmount}\n`;
        });
      }
    } else if (activeTab === "products") {
      filename = `product-report-${productType}-${new Date().toISOString().slice(0, 10)}.csv`;
      const list = productType === "best" ? productData?.bestSelling || [] : productData?.leastSelling || [];
      csvContent = "Rank,Product Name,Barcode,Category,Units Sold,Total Revenue,Selling Price,Stock,Status\n";
      list.forEach((p, idx) => {
        csvContent += `${idx + 1},"${p.name}","${p.barcode}","${p.category}",${p.quantitySold},${p.totalRevenue},${p.sellingPrice},${p.stock},"${p.status}"\n`;
      });
    } else {
      filename = `stock-report-${stockFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      const list =
        stockFilter === "low"
          ? stockData?.lowStock || []
          : stockFilter === "out"
          ? stockData?.outOfStock || []
          : stockData?.inventory || [];
      csvContent = "Product Name,Barcode,Category,Stock,Threshold,Selling Price,Cost Price,Total Retail Value,Status\n";
      list.forEach((p) => {
        csvContent += `"${p.name}","${p.barcode}","${p.category}",${p.stock},${p.lowStockThreshold},${p.sellingPrice},${p.costPrice || 0},${p.totalRetailValue},"${p.stockStatus}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <WorkspaceShell>
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { background: white !important; color: black !important; }
          header, nav, button, .no-print { display: none !important; }
          .print-area { display: block !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>

      {/* Header & Main Nav Tabs */}
      <div className={ui.head}>
        <div>
          <label>{t("reports.title", "Reports & Analytics")}</label>
          <h1>{t("reports.title", "Reports & Analytics")}</h1>
          <p>
            {t("reports.subtitle", "Sales summaries, product performance, and inventory health for")}{" "}
            <strong>{activeBusiness?.name || "Active Store"}</strong>.
          </p>
        </div>

        {/* Global Export & Print Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            onClick={handleExportCsv}
            className={ui.secondary}
            title="Download CSV Spreadsheet"
          >
            📥 {t("reports.export_csv", "Export CSV")}
          </button>
          <button
            onClick={() => window.print()}
            className={ui.secondary}
            title="Print Current Report"
          >
            🖨️ {t("reports.print", "Print Report")}
          </button>
        </div>
      </div>

      {/* 3 CORE PRD SECTION 17 TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2 no-print overflow-x-auto">
        <button
          onClick={() => setActiveTab("sales")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === "sales"
              ? "bg-[#00875a] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>🛒</span> {t("reports.sales_report", "Sales Report")}
        </button>

        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === "products"
              ? "bg-[#00875a] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>📦</span> {t("reports.product_report", "Product Report")}
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === "stock"
              ? "bg-[#00875a] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>📊</span> {t("reports.stock_report", "Stock Report")}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. SALES REPORT (Daily, Weekly, Monthly)                 */}
      {/* ======================================================== */}
      {activeTab === "sales" && (
        <div className="space-y-6 print-area">
          {/* Sub-Tabs: Daily | Weekly | Monthly */}
          <div className="flex items-center justify-between flex-wrap gap-3 no-print">
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-xs">
              {(
                [
                  { id: "daily", label: t("reports.daily", "Daily (Today)") },
                  { id: "weekly", label: t("reports.weekly", "Weekly (7 Days)") },
                  { id: "monthly", label: t("reports.monthly", "Monthly (30 Days)") },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSalesPeriod(p.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    salesPeriod === p.id
                      ? "bg-[#00875a] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {salesPeriod === "daily"
                ? "Today's Live Sales"
                : salesPeriod === "weekly"
                ? "Past 7 Calendar Days"
                : "Past 30 Calendar Days"}
            </span>
          </div>

          {/* KPI Stat Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Revenue
              </span>
              <p className="text-2xl font-black text-[#00875a]">
                {loading ? "..." : money(salesData?.summary.totalRevenue)}
              </p>
              <small className="block text-[11px] text-slate-500">
                Cash: {money(salesData?.summary.cashTotal)} • Online: {money(salesData?.summary.onlineTotal)}
              </small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Orders / Invoices
              </span>
              <p className="text-2xl font-black text-blue-700">
                {loading ? "..." : `${salesData?.summary.totalOrders || 0} Orders`}
              </p>
              <small className="block text-[11px] text-slate-500">
                Average order: {money(salesData?.summary.averageOrder)}
              </small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Items Sold
              </span>
              <p className="text-2xl font-black text-purple-700">
                {loading ? "..." : `${salesData?.summary.totalItems || 0} Units`}
              </p>
              <small className="block text-[11px] text-slate-500">Products sold through POS</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Discounts Awarded
              </span>
              <p className="text-2xl font-black text-amber-700">
                {loading ? "..." : money(salesData?.summary.totalDiscounts)}
              </p>
              <small className="block text-[11px] text-slate-500">Customer bill discounts</small>
            </article>
          </section>

          {/* Weekly / Monthly Chart & Breakdown Table */}
          {(salesPeriod === "weekly" || salesPeriod === "monthly") && (
            <div className="space-y-4">
              {/* Visual Daily Sales Bar Graph */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Sales Revenue Trend ({salesPeriod === "weekly" ? "7 Days" : "30 Days"})
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    Max: {money(Math.max(...(salesData?.breakdown.map((b) => b.totalAmount) || [0]), 1))}
                  </span>
                </div>

                <div className="h-40 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-slate-200">
                  {(salesData?.breakdown || []).map((b) => {
                    const maxVal = Math.max(...(salesData?.breakdown.map((x) => x.totalAmount) || [0]), 1);
                    const heightPct = Math.max(6, Math.round((b.totalAmount / maxVal) * 100));
                    return (
                      <div
                        key={b.date}
                        className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                      >
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow pointer-events-none whitespace-nowrap z-10">
                          {b.displayDate}: {money(b.totalAmount)} ({b.orders} orders)
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            b.totalAmount > 0
                              ? "bg-gradient-to-t from-[#00875a] to-emerald-400 group-hover:brightness-110"
                              : "bg-slate-100"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Day labels below */}
                <div className="flex justify-between text-[10px] text-slate-500 font-bold pt-2 px-1">
                  <span>{salesData?.breakdown[0]?.displayDate}</span>
                  <span>{salesData?.breakdown[Math.floor((salesData?.breakdown.length || 0) / 2)]?.displayDate}</span>
                  <span>{salesData?.breakdown[salesData?.breakdown.length - 1]?.displayDate}</span>
                </div>
              </div>

              {/* Day-by-Day Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-extrabold text-slate-900">Day-by-Day Sales Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Day</th>
                        <th className="py-3 px-4 text-center">Orders</th>
                        <th className="py-3 px-4 text-center">Units Sold</th>
                        <th className="py-3 px-4 text-right">Discounts</th>
                        <th className="py-3 px-4 text-right font-black text-slate-900">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(salesData?.breakdown || []).map((b) => (
                        <tr key={b.date} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-bold text-slate-800">{b.displayDate}</td>
                          <td className="py-3 px-4 text-slate-500 font-semibold">{b.dayName}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-700">{b.orders}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{b.totalItems}</td>
                          <td className="py-3 px-4 text-right text-amber-700">{money(b.discounts)}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-800">
                            {money(b.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Daily Detailed Invoices Table */}
          {salesPeriod === "daily" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Today's Transactions</h3>
                  <p className="text-xs text-slate-500">Click any row to open receipt preview</p>
                </div>
                <span className="text-xs font-bold text-[#00875a] bg-emerald-50 px-2.5 py-1 rounded-full">
                  {salesData?.sales.length || 0} Invoices
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Cashier</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-center">Payment</th>
                      <th className="py-3 px-4 text-right">Discount</th>
                      <th className="py-3 px-4 text-right font-black text-slate-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Loading sales transactions...
                        </td>
                      </tr>
                    ) : (salesData?.sales || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No sales recorded for today yet.
                        </td>
                      </tr>
                    ) : (
                      salesData?.sales.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() =>
                            setActiveReceipt({
                              id: String(s.id),
                              total: Number(s.totalAmount || 0),
                              itemsCount: Number(s.totalItems || 1),
                              createdByName: s.cashier,
                              createdAt: s.createdAt,
                            })
                          }
                          className="hover:bg-emerald-50/40 cursor-pointer transition"
                          title="Click to view full printable receipt"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-emerald-800">{s.invoiceNumber}</td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(s.createdAt).toLocaleTimeString("en-PK", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {s.customerName}
                            {s.customerMobile && (
                              <small className="block text-[10px] text-slate-400 font-normal">
                                {s.customerMobile}
                              </small>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s.cashier}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{s.totalItems}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                (s.paymentMethod || "").toLowerCase() === "cash"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {s.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-amber-700">
                            {s.discountAmount > 0 ? money(s.discountAmount) : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                            {money(s.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PRODUCT REPORT (Best Selling & Least Selling)         */}
      {/* ======================================================== */}
      {activeTab === "products" && (
        <div className="space-y-6 print-area">
          {/* Sub-Switch: Best Selling vs Least Selling */}
          <div className="flex items-center justify-between flex-wrap gap-3 no-print">
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setProductType("best")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  productType === "best"
                    ? "bg-[#00875a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🔥</span> {t("reports.best_selling", "Best Selling Products")}
              </button>

              <button
                onClick={() => setProductType("least")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  productType === "least"
                    ? "bg-[#00875a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>❄️</span> {t("reports.least_selling", "Least Selling Products")}
              </button>
            </div>

            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {productType === "best"
                ? "Highest Volume & Revenue Performers"
                : "Slow Moving & Dead Stock (Zero Sales)"}
            </span>
          </div>

          {/* KPI Summary Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Catalog Products
              </span>
              <p className="text-2xl font-black text-slate-900">
                {productData?.summary.totalCatalogProducts || 0}
              </p>
              <small className="block text-[11px] text-slate-500">Total active retail products</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Active Sellers
              </span>
              <p className="text-2xl font-black text-emerald-700">
                {productData?.summary.productsWithSales || 0}
              </p>
              <small className="block text-[11px] text-slate-500">Products with recorded sales</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Dead Stock (0 Sales)
              </span>
              <p className="text-2xl font-black text-rose-600">
                {productData?.summary.zeroSalesProducts || 0}
              </p>
              <small className="block text-[11px] text-slate-500">Products sitting idle on shelves</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Volume Sold
              </span>
              <p className="text-2xl font-black text-purple-700">
                {productData?.summary.totalUnitsSold || 0} Units
              </p>
              <small className="block text-[11px] text-slate-500">
                {money(productData?.summary.totalSalesRevenue)} gross
              </small>
            </article>
          </section>

          {/* Product Performance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {productType === "best" ? "🔥 Top Performing Products" : "❄️ Slow-Moving & Idle Inventory"}
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {productType === "best"
                  ? `${productData?.bestSelling.length || 0} Sellers`
                  : `${productData?.leastSelling.length || 0} Products`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-center">Volume Sold</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-center">In Stock</th>
                    <th className="py-3 px-4 text-right">Tied Capital</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Analyzing product sales...
                      </td>
                    </tr>
                  ) : (
                    (productType === "best"
                      ? productData?.bestSelling || []
                      : productData?.leastSelling || []
                    ).map((prod, idx) => {
                      const maxUnits = Math.max(
                        ...(productData?.bestSelling.map((x) => x.quantitySold) || [1]),
                        1
                      );
                      const barWidth = Math.min(100, Math.round((prod.quantitySold / maxUnits) * 100));

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-center font-black">
                            {productType === "best" ? (
                              <span
                                className={`inline-block size-6 leading-6 rounded-md text-[11px] font-black ${
                                  idx === 0
                                    ? "bg-amber-100 text-amber-800"
                                    : idx === 1
                                    ? "bg-slate-200 text-slate-800"
                                    : idx === 2
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <strong className="block text-slate-900 text-sm font-bold">{prod.name}</strong>
                            <small className="text-[10px] text-slate-400 font-mono">
                              Barcode: {prod.barcode}
                            </small>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">{prod.category}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">
                            {money(prod.sellingPrice)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-extrabold text-slate-800">
                                {prod.quantitySold} units
                              </span>
                              {prod.quantitySold > 0 && (
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${barWidth}%` }}
                                    className="h-full bg-emerald-600 rounded-full"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                            {money(prod.totalRevenue)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] ${
                                prod.stock <= 0
                                  ? "bg-rose-100 text-rose-800"
                                  : prod.stock <= 5
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {prod.stock} units
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 font-bold">
                            {money(prod.tiedUpCapital)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                prod.status.includes("Dead")
                                  ? "bg-rose-100 text-rose-800"
                                  : prod.status.includes("Slow")
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {prod.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. STOCK REPORT (Current Inventory, Low Stock, Out of Stock) */}
      {/* ======================================================== */}
      {activeTab === "stock" && (
        <div className="space-y-6 print-area">
          {/* Sub-Filters: Current Inventory | Low Stock | Out of Stock */}
          <div className="flex items-center justify-between flex-wrap gap-3 no-print">
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setStockFilter("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  stockFilter === "all"
                    ? "bg-[#00875a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📋</span> {t("reports.current_inventory", "Current Inventory")} (
                {stockData?.inventory.length || 0})
              </button>

              <button
                onClick={() => setStockFilter("low")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  stockFilter === "low"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⚠️</span> {t("reports.low_stock", "Low Stock")} ({stockData?.lowStock.length || 0})
              </button>

              <button
                onClick={() => setStockFilter("out")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  stockFilter === "out"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⛔</span> {t("reports.out_of_stock", "Out of Stock")} (
                {stockData?.outOfStock.length || 0})
              </button>
            </div>

            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {stockFilter === "all"
                ? "Full Catalog Inventory & Valuation"
                : stockFilter === "low"
                ? "Items Approaching Stockout Threshold"
                : "Items Depleted to Zero"}
            </span>
          </div>

          {/* Stock KPI Summary Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Stock Units
              </span>
              <p className="text-2xl font-black text-slate-900">
                {stockData?.summary.totalUnits || 0} Units
              </p>
              <small className="block text-[11px] text-slate-500">
                Across {stockData?.summary.totalProducts || 0} items
              </small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Retail Valuation
              </span>
              <p className="text-2xl font-black text-[#00875a]">
                {money(stockData?.summary.totalRetailValue)}
              </p>
              <small className="block text-[11px] text-slate-500">Stock at customer selling price</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Cost Valuation (Investment)
              </span>
              <p className="text-2xl font-black text-blue-700">
                {money(stockData?.summary.totalCostValue)}
              </p>
              <small className="block text-[11px] text-slate-500">Capital invested in stock</small>
            </article>

            <article className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Inventory Alerts
              </span>
              <p
                className={`text-2xl font-black ${
                  (stockData?.summary.lowStockCount || 0) + (stockData?.summary.outOfStockCount || 0) > 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {(stockData?.summary.lowStockCount || 0) + (stockData?.summary.outOfStockCount || 0)} Alerts
              </p>
              <small className="block text-[11px] text-slate-500">
                {stockData?.summary.outOfStockCount || 0} out of stock • {stockData?.summary.lowStockCount || 0} low
              </small>
            </article>
          </section>

          {/* Stock Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {stockFilter === "all"
                  ? "Full Inventory Stock Ledger"
                  : stockFilter === "low"
                  ? "⚠️ Low Stock Reorder List"
                  : "⛔ Out of Stock Urgent Restock"}
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {stockFilter === "low"
                  ? `${stockData?.lowStock.length || 0} items low`
                  : stockFilter === "out"
                  ? `${stockData?.outOfStock.length || 0} items depleted`
                  : `${stockData?.inventory.length || 0} items listed`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Alert Threshold</th>
                    <th className="py-3 px-4 text-right">Stock Valuation</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Loading inventory records...
                      </td>
                    </tr>
                  ) : (
                    (stockFilter === "low"
                      ? stockData?.lowStock || []
                      : stockFilter === "out"
                      ? stockData?.outOfStock || []
                      : stockData?.inventory || []
                    ).map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <strong className="block text-slate-900 text-sm font-bold">{prod.name}</strong>
                          <small className="text-[10px] text-slate-400 font-mono">
                            Barcode: {prod.barcode}
                          </small>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{prod.category}</td>
                        <td className="py-3 px-4 text-right text-slate-500 font-semibold">
                          {money(prod.costPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {money(prod.sellingPrice)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black text-sm ${
                              prod.stock <= 0
                                ? "text-rose-600"
                                : prod.stock <= prod.lowStockThreshold
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {prod.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">
                          ≤ {prod.lowStockThreshold}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                          {money(prod.totalRetailValue)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              prod.stockStatus === "Out of Stock"
                                ? "bg-rose-100 text-rose-800"
                                : prod.stockStatus === "Low Stock"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {prod.stockStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center no-print">
                          <Link
                            href={`/products?search=${encodeURIComponent(prod.name)}`}
                            className="inline-block px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-[#00875a] hover:border-[#00875a] hover:text-white transition"
                          >
                            Restock
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      <ReceiptModal sale={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </WorkspaceShell>
  );
}
