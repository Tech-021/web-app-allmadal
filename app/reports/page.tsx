"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ReceiptModal, ReceiptSale } from "@/app/components/receipt-modal";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";
import { Icon } from "@/app/components/icons";
import { Skeleton } from "@/app/components/motion";
import { Metric, MetricStrip, PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { CompositionBar, Money, formatRs, shortRs } from "@/app/components/figures";
import { BarChart } from "@/app/components/charts";
import rp from "./reports.module.css";

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

const money = (v: number = 0) => `Rs ${formatRs(v)}`;

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

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(25);
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(25);
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(25);

  // Data states
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [productData, setProductData] = useState<ProductReportData | null>(null);
  const [stockData, setStockData] = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset page when sub-tabs change
  useEffect(() => { setSalesPage(1); }, [salesPeriod]);
  useEffect(() => { setProductPage(1); }, [productType]);
  useEffect(() => { setStockPage(1); }, [stockFilter]);

  const paginatedSales = useMemo(() => {
    const list = salesData?.sales || [];
    const start = (salesPage - 1) * salesPageSize;
    return list.slice(start, start + salesPageSize);
  }, [salesData?.sales, salesPage, salesPageSize]);

  const currentProductList = useMemo(() => {
    return productType === "best"
      ? productData?.bestSelling || []
      : productData?.leastSelling || [];
  }, [productType, productData]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * productPageSize;
    return currentProductList.slice(start, start + productPageSize);
  }, [currentProductList, productPage, productPageSize]);

  const currentStockList = useMemo(() => {
    return stockFilter === "low"
      ? stockData?.lowStock || []
      : stockFilter === "out"
      ? stockData?.outOfStock || []
      : stockData?.inventory || [];
  }, [stockFilter, stockData]);

  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return currentStockList.slice(start, start + stockPageSize);
  }, [currentStockList, stockPage, stockPageSize]);

  // ---- Derived overview figures (all computed from the report payload) ----
  const summary = salesData?.summary;
  const periodLabel = salesPeriod === "daily" ? "Today's live sales" : salesPeriod === "weekly" ? "Past 7 calendar days" : "Past 30 calendar days";
  const periodShort = salesPeriod === "daily" ? "today" : salesPeriod === "weekly" ? "7 days" : "30 days";

  const chart = useMemo(() => {
    if (salesPeriod === "daily") {
      const sales = salesData?.sales || [];
      const hours = sales.map((x) => new Date(x.createdAt).getHours());
      const nowHour = new Date().getHours();
      const from = Math.min(9, ...hours);
      const to = Math.max(Math.min(nowHour, 23), from + 1, ...hours);
      const values = Array.from({ length: to - from + 1 }, () => 0);
      sales.forEach((x) => {
        values[new Date(x.createdAt).getHours() - from] += Number(x.totalAmount || 0);
      });
      const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;
      const labels = values.map((_, i) => (i % 3 === 0 ? fmtHour(from + i) : ""));
      const whens = values.map((_, i) => `${fmtHour(from + i)}–${fmtHour(from + i + 1)} today`);
      const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
      return { values, labels, whens, avg };
    }
    const rows = salesData?.breakdown || [];
    const values = rows.map((b) => Number(b.totalAmount || 0));
    const step = rows.length > 10 ? 7 : 1;
    const labels = rows.map((b, i) => (i % step === 0 || i === rows.length - 1 ? b.displayDate : ""));
    const whens = rows.map((b) => `${b.dayName}, ${b.displayDate}`);
    const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    return { values, labels, whens, avg };
  }, [salesData, salesPeriod]);

  const payMix = useMemo(() => {
    const sales = salesData?.sales || [];
    if (salesPeriod === "daily" || !sales.length || !salesData?.startDate) return [];
    const start = new Date(salesData.startDate);
    start.setHours(0, 0, 0, 0);
    const bucketDays = salesPeriod === "weekly" ? 1 : 7;
    const count = salesPeriod === "weekly" ? 7 : 5;
    const rows = Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i * bucketDays);
      return { label: salesPeriod === "weekly" ? d.toLocaleDateString(undefined, { weekday: "short" }) : `W${i + 1}`, cash: 0, online: 0 };
    });
    sales.forEach((x) => {
      const days = Math.floor((new Date(x.createdAt).getTime() - start.getTime()) / 86400000);
      const idx = Math.min(count - 1, Math.max(0, Math.floor(days / bucketDays)));
      if ((x.paymentMethod || "cash").toLowerCase() === "cash") rows[idx].cash += Number(x.totalAmount || 0);
      else rows[idx].online += Number(x.totalAmount || 0);
    });
    return rows;
  }, [salesData, salesPeriod]);

  const topDays = useMemo(() => {
    if (salesPeriod === "daily") {
      return [...(salesData?.sales || [])]
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 6)
        .map((x) => ({ label: x.invoiceNumber, value: Number(x.totalAmount || 0) }));
    }
    return [...(salesData?.breakdown || [])]
      .filter((b) => b.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 6)
      .map((b) => ({ label: `${b.dayName.slice(0, 3)} ${b.displayDate}`, value: Number(b.totalAmount || 0) }));
  }, [salesData, salesPeriod]);

  const byCashier = useMemo(() => {
    const totals = new Map<string, number>();
    (salesData?.sales || []).forEach((x) => totals.set(x.cashier || "—", (totals.get(x.cashier || "—") || 0) + Number(x.totalAmount || 0)));
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [salesData]);

  const categoryRevenue = useMemo(() => {
    const seen = new Set<number>();
    const totals = new Map<string, number>();
    [...(productData?.bestSelling || []), ...(productData?.leastSelling || [])].forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const key = p.category || "Uncategorised";
      totals.set(key, (totals.get(key) || 0) + Number(p.totalRevenue || 0));
    });
    return [...totals.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [productData]);

  const categoryStockValue = useMemo(() => {
    const totals = new Map<string, number>();
    (stockData?.inventory || []).forEach((p) => totals.set(p.category || "Uncategorised", (totals.get(p.category || "Uncategorised") || 0) + Number(p.totalRetailValue || 0)));
    return [...totals.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [stockData]);

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

      <PageHeader
        title="Reports"
        description={
          <>
            {t("reports.subtitle", "Sales summaries, product performance, and inventory health for")}{" "}
            <strong className="font-medium text-[var(--text)]">{activeBusiness?.name || "Active Store"}</strong>.
          </>
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <button onClick={handleExportCsv} className={ui.secondary} title="Download CSV spreadsheet">
              <Icon name="download" size={14} />
              {t("reports.export_csv", "Export CSV")}
            </button>
            <button onClick={() => window.print()} className={ui.secondary} title="Print current report">
              <Icon name="printer" size={14} />
              {language === "ur" ? "PDF banayein" : "Export PDF"}
            </button>
          </div>
        }
      />

      <div className={`${ui.tabBar} no-print`} role="tablist" aria-label="Report type">
        {(
          [
            { id: "sales", icon: "cart", label: language === "ur" ? "Bikri" : "Sales" },
            { id: "products", icon: "box", label: "Products" },
            { id: "stock", icon: "layers", label: "Stock" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? ui.tabBarOn : ""}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======================== 1. SALES REPORT ======================== */}
      {activeTab === "sales" && (
        <div className={`${rp.stack} print-area`}>
          <div className={`${rp.subbar} no-print`}>
            <div className={ui.segmented} role="tablist" aria-label="Period">
              {(
                [
                  { id: "daily", label: t("reports.daily", "Today") },
                  { id: "weekly", label: t("reports.weekly", "7 days") },
                  { id: "monthly", label: t("reports.monthly", "30 days") },
                ] as const
              ).map((p) => (
                <button key={p.id} role="tab" aria-selected={salesPeriod === p.id} onClick={() => setSalesPeriod(p.id)} className={salesPeriod === p.id ? ui.segmentedOn : ""}>
                  {p.label}
                </button>
              ))}
            </div>
            <span className={rp.caption}>
              <Icon name="calendar" size={13} />
              {periodLabel}
            </span>
          </div>

          <div className={rp.topGrid}>
            <section className={rp.card} aria-label="Sales summary">
              <div className={rp.cardHead}>
                <h2 className={rp.cardTitle}>Sales summary · {periodShort}</h2>
                <span className={rp.cardSub}>{(summary?.totalOrders || 0).toLocaleString("en-IN")} bills</span>
              </div>
              {loading && !salesData ? (
                <div className="mt-4 flex flex-col gap-3" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-4" style={{ width: `${90 - i * 12}%` }} />
                  ))}
                  <Skeleton className="mt-2 h-7 w-40" />
                </div>
              ) : (
                <>
                  <div className="mt-2.5">
                    <div className={rp.pl}>
                      <span>Gross sales</span>
                      <span>{formatRs((summary?.totalRevenue || 0) + (summary?.totalDiscounts || 0))}</span>
                    </div>
                    <div className={`${rp.pl} ${rp.plNeg}`}>
                      <span>Discounts given</span>
                      <span>{summary?.totalDiscounts ? `− ${formatRs(summary.totalDiscounts)}` : "0"}</span>
                    </div>
                    <div className={`${rp.pl} ${rp.plStrong}`}>
                      <span>Cash received</span>
                      <span>{formatRs(summary?.cashTotal || 0)}</span>
                    </div>
                    <div className={rp.pl}>
                      <span>Online received</span>
                      <span>{formatRs(summary?.onlineTotal || 0)}</span>
                    </div>
                    <div className={`${rp.pl} ${rp.plTotal}`}>
                      <span>Net revenue</span>
                      <Money value={summary?.totalRevenue || 0} size="md" animate />
                    </div>
                  </div>
                  <div className={rp.badges}>
                    <span className={`${ui.chip} ${ui.chipPos}`}>Avg bill Rs {formatRs(summary?.averageOrder || 0)}</span>
                    <span className={rp.cardSub}>{(summary?.totalItems || 0).toLocaleString("en-IN")} items sold</span>
                  </div>
                </>
              )}
            </section>

            <section className={rp.card} aria-label="Revenue chart">
              <div className={rp.cardHead}>
                <div>
                  <h2 className={rp.cardTitle}>{salesPeriod === "daily" ? "Revenue by hour" : "Daily revenue"}</h2>
                  <p className={rp.cardSub}>{chart.values.some((v) => v > 0) ? "Dashed line is the average · hover a bar for detail" : "No revenue recorded in this period yet"}</p>
                </div>
                {chart.values.some((v) => v > 0) && <span className={rp.monoMuted}>avg Rs {formatRs(chart.avg)}</span>}
              </div>
              <div className="mt-4">
                {loading && !salesData ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <BarChart
                    key={`${salesPeriod}-${chart.values.length}`}
                    values={chart.values}
                    labels={chart.labels}
                    whens={chart.whens}
                    ariaLabel={`${salesPeriod === "daily" ? "Hourly" : "Daily"} revenue, ${chart.values.length} bars`}
                  />
                )}
              </div>
            </section>
          </div>

          <div className={rp.triGrid}>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>How customers paid</h2>
              <div className="mt-4">
                <CompositionBar
                  segments={[
                    { label: t("payment.cash", "Cash"), value: summary?.cashTotal || 0, color: "var(--c-cash)" },
                    { label: t("payment.online", "Online"), value: summary?.onlineTotal || 0, color: "var(--c-online)" },
                  ]}
                />
              </div>
              {payMix.length > 1 && (
                <div className={rp.mixRows}>
                  {payMix.map((row, i) => (
                    <div key={row.label} className={rp.mixRow}>
                      <span>{row.label}</span>
                      <div className={rp.mixBar} role="img" aria-label={`${row.label}: cash Rs ${formatRs(row.cash)}, online Rs ${formatRs(row.online)}`}>
                        {row.cash + row.online === 0 ? (
                          <i style={{ flex: 1, background: "var(--sunken)" }} />
                        ) : (
                          <>
                            {row.cash > 0 && <i style={{ flex: row.cash, background: "var(--c-cash)", animationDelay: `${i * 40}ms` }} />}
                            {row.online > 0 && <i style={{ flex: row.online, background: "var(--c-online)", animationDelay: `${i * 40}ms` }} />}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={rp.card}>
              <h2 className={rp.cardTitle}>{salesPeriod === "daily" ? "Largest bills today" : "Busiest days"}</h2>
              <RankList
                rows={topDays}
                color="var(--brand)"
                empty="Your best days will rank here once sales come in."
              />
            </section>

            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Sales by cashier</h2>
              <RankList rows={byCashier} color="var(--text-2)" empty="Each staff member's sales will appear here." />
            </section>
          </div>

          {(salesPeriod === "weekly" || salesPeriod === "monthly") && (
            <section className={`${ui.panel} ${ui.panelFlush}`}>
              <div className={ui.panelHead}>
                <div>
                  <h2>Day-by-day breakdown</h2>
                  <p>Orders, units and revenue per day</p>
                </div>
              </div>
              <div className={`${ui.tableWrap} ${ui.tableBare}`}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Units sold</th>
                      <th className="text-right">Discounts</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !salesData ? (
                      <TableSkeletonRows cols={6} />
                    ) : (salesData?.breakdown || []).length === 0 ? (
                      <TableEmptyRow colSpan={6} icon="chart" title="No sales in this period" body="Completed sales appear here day by day. Try a longer range." />
                    ) : (
                      (salesData?.breakdown || []).map((b) => (
                        <tr key={b.date}>
                          <td className="font-mono text-[12.5px]">{b.displayDate}</td>
                          <td className="text-[var(--muted)]">{b.dayName}</td>
                          <td className="text-right font-mono">{b.orders}</td>
                          <td className="text-right font-mono">{b.totalItems}</td>
                          <td className="text-right font-mono text-[var(--neg)]">{b.discounts > 0 ? `− ${formatRs(b.discounts)}` : <span className="text-[var(--faint)]">—</span>}</td>
                          <td className="text-right font-mono font-medium">{formatRs(b.totalAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {salesPeriod === "daily" && (
            <section className={`${ui.panel} ${ui.panelFlush}`}>
              <div className={ui.panelHead}>
                <div>
                  <h2>Today&apos;s transactions</h2>
                  <p>Select a row to preview its receipt</p>
                </div>
                <span className={ui.chip}>
                  <span className="font-mono">{salesData?.sales.length || 0}</span> invoices
                </span>
              </div>
              <div className={`${ui.tableWrap} ${ui.tableBare}`}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Time</th>
                      <th>Customer</th>
                      <th>Cashier</th>
                      <th className="text-right">Items</th>
                      <th>Payment</th>
                      <th className="text-right">Discount</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !salesData ? (
                      <TableSkeletonRows cols={8} />
                    ) : (salesData?.sales || []).length === 0 ? (
                      <TableEmptyRow
                        colSpan={8}
                        icon="receipt"
                        title="No sales recorded today"
                        body="Your first sale will show up here and on the dashboard instantly."
                        action={
                          <button type="button" className={ui.primary} onClick={() => window.dispatchEvent(new CustomEvent("almadel:open-new-sale"))}>
                            <Icon name="plus" size={15} strokeWidth={2.2} />
                            Create new sale
                          </button>
                        }
                      />
                    ) : (
                      paginatedSales.map((s) => {
                        const cash = (s.paymentMethod || "cash").toLowerCase() === "cash";
                        return (
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
                            className="cursor-pointer"
                            title="View printable receipt"
                          >
                            <td className="font-mono text-[12.5px] text-[var(--text)]">{s.invoiceNumber}</td>
                            <td className="font-mono text-[12.5px] text-[var(--muted)]">
                              {new Date(s.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </td>
                            <td>
                              <span className="font-medium text-[var(--text)]">{s.customerName}</span>
                              {s.customerMobile && <small className="block font-mono text-[11.5px] text-[var(--faint)]">{s.customerMobile}</small>}
                            </td>
                            <td className="text-[var(--text-2)]">{s.cashier}</td>
                            <td className="text-right font-mono">{s.totalItems}</td>
                            <td>
                              <span className={ui.chip}>
                                <i className="inline-block size-1.5 rounded-full" style={{ background: cash ? "var(--c-cash)" : "var(--c-online)" }} />
                                {s.paymentMethod || "Cash"}
                              </span>
                            </td>
                            <td className="text-right font-mono text-[var(--neg)]">{s.discountAmount > 0 ? `− ${formatRs(s.discountAmount)}` : <span className="text-[var(--faint)]">—</span>}</td>
                            <td className="text-right font-mono font-medium">{formatRs(s.totalAmount)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {(salesData?.sales.length || 0) > 0 && (
                <PaginationControls
                  currentPage={salesPage}
                  totalItems={salesData?.sales.length || 0}
                  pageSize={salesPageSize}
                  onPageChange={setSalesPage}
                  onPageSizeChange={(newSize) => {
                    setSalesPageSize(newSize);
                    setSalesPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                  itemLabel="invoices"
                  className="no-print"
                />
              )}
            </section>
          )}
        </div>
      )}

      {/* ======================== 2. PRODUCT REPORT ======================== */}
      {activeTab === "products" && (
        <div className={`${rp.stack} print-area`}>
          <div className={`${rp.subbar} no-print`}>
            <div className={ui.segmented} role="tablist" aria-label="Product ranking">
              <button role="tab" aria-selected={productType === "best"} onClick={() => setProductType("best")} className={productType === "best" ? ui.segmentedOn : ""}>
                <Icon name="upright" size={13} />
                {t("reports.best_selling", "Best Selling Products")}
              </button>
              <button role="tab" aria-selected={productType === "least"} onClick={() => setProductType("least")} className={productType === "least" ? ui.segmentedOn : ""}>
                <Icon name="downright" size={13} />
                {t("reports.least_selling", "Least Selling Products")}
              </button>
            </div>
            <span className={rp.caption}>{productType === "best" ? "Highest volume & revenue performers" : "Slow-moving and idle stock"}</span>
          </div>

          <MetricStrip>
            <Metric label="Catalogue products" icon="box" value={(productData?.summary.totalCatalogProducts || 0).toLocaleString()} hint="Active retail products" />
            <Metric label="Active sellers" icon="upright" tone="pos" value={(productData?.summary.productsWithSales || 0).toLocaleString()} hint="Products with recorded sales" />
            <Metric
              label="Dead stock"
              icon="alert"
              tone={(productData?.summary.zeroSalesProducts || 0) > 0 ? "neg" : undefined}
              value={(productData?.summary.zeroSalesProducts || 0).toLocaleString()}
              hint="Zero sales, idle on shelves"
            />
            <Metric
              label="Units sold"
              icon="cart"
              value={(productData?.summary.totalUnitsSold || 0).toLocaleString()}
              hint={`${money(productData?.summary.totalSalesRevenue)} gross`}
            />
          </MetricStrip>

          <div className={rp.triGrid}>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Revenue by product</h2>
              <RankList
                rows={[...(productData?.bestSelling || [])].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6).map((p) => ({ label: p.name, value: p.totalRevenue }))}
                color="var(--brand)"
                empty="Products rank here once they start selling."
              />
            </section>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Revenue by category</h2>
              <RankList rows={categoryRevenue} color="var(--text-2)" empty="Assign categories to products to compare them here." />
            </section>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Capital tied in slow stock</h2>
              <RankList
                rows={[...(productData?.leastSelling || [])].filter((p) => p.tiedUpCapital > 0).sort((a, b) => b.tiedUpCapital - a.tiedUpCapital).slice(0, 6).map((p) => ({ label: p.name, value: p.tiedUpCapital }))}
                color="var(--c-udhaar)"
                empty="No money is sitting in slow-moving stock."
              />
            </section>
          </div>

          <section className={`${ui.panel} ${ui.panelFlush}`}>
            <div className={ui.panelHead}>
              <div>
                <h2>{productType === "best" ? "Top performing products" : "Slow-moving & idle inventory"}</h2>
                <p>{productType === "best" ? "Ranked by units sold" : "Products with the fewest sales"}</p>
              </div>
              <span className={ui.chip}>
                <span className="font-mono">{productType === "best" ? productData?.bestSelling.length || 0 : productData?.leastSelling.length || 0}</span>
                products
              </span>
            </div>
            <div className={`${ui.tableWrap} ${ui.tableBare}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className="w-14">Rank</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-right">Price</th>
                    <th>Volume sold</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">In stock</th>
                    <th className="text-right">Tied capital</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows cols={9} />
                  ) : paginatedProducts.length === 0 ? (
                    <TableEmptyRow colSpan={9} icon="box" title="No product sales yet" body="Rankings appear once products start selling." />
                  ) : (
                    paginatedProducts.map((prod, idx) => {
                      const globalRank = (productPage - 1) * productPageSize + idx + 1;
                      const maxUnits = Math.max(...(productData?.bestSelling.map((x) => x.quantitySold) || [1]), 1);
                      const barWidth = Math.min(100, Math.round((prod.quantitySold / maxUnits) * 100));
                      return (
                        <tr key={prod.id}>
                          <td>
                            <span className={`${rp.rank} ${productType === "best" && globalRank <= 3 ? rp.rankTop : ""}`}>{globalRank}</span>
                          </td>
                          <td>
                            <span className="block font-medium">{prod.name}</span>
                            <small className="font-mono text-[11.5px] text-[var(--faint)]">{prod.barcode}</small>
                          </td>
                          <td className="text-[var(--text-2)]">{prod.category}</td>
                          <td className="text-right font-mono">{money(prod.sellingPrice)}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span className="w-10 font-mono">{prod.quantitySold}</span>
                              <span className={rp.miniTrack}>
                                <span style={{ width: `${barWidth}%` }} />
                              </span>
                            </div>
                          </td>
                          <td className="text-right font-mono font-medium">{money(prod.totalRevenue)}</td>
                          <td className="text-right">
                            <span className={`font-mono ${prod.stock <= 0 ? "text-[var(--neg)]" : prod.stock <= 5 ? "text-[var(--warn)]" : ""}`}>{prod.stock}</span>
                          </td>
                          <td className="text-right font-mono text-[var(--muted)]">{money(prod.tiedUpCapital)}</td>
                          <td>
                            <span className={`${ui.chip} ${prod.status.includes("Dead") ? ui.chipNeg : prod.status.includes("Slow") ? ui.chipWarn : ui.chipPos}`}>
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
            {currentProductList.length > 0 && (
              <PaginationControls
                currentPage={productPage}
                totalItems={currentProductList.length}
                pageSize={productPageSize}
                onPageChange={setProductPage}
                onPageSizeChange={(newSize) => {
                  setProductPageSize(newSize);
                  setProductPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel={productType === "best" ? "top sellers" : "slow sellers"}
                className="no-print"
              />
            )}
          </section>
        </div>
      )}

      {/* ======================== 3. STOCK REPORT ======================== */}
      {activeTab === "stock" && (
        <div className={`${rp.stack} print-area`}>
          <div className={`${rp.subbar} no-print`}>
            <div className={ui.segmented} role="tablist" aria-label="Stock filter">
              <button role="tab" aria-selected={stockFilter === "all"} onClick={() => setStockFilter("all")} className={stockFilter === "all" ? ui.segmentedOn : ""}>
                {t("reports.current_inventory", "Current Inventory")}
                <span className="font-mono text-[var(--faint)]">{stockData?.inventory.length || 0}</span>
              </button>
              <button role="tab" aria-selected={stockFilter === "low"} onClick={() => setStockFilter("low")} className={stockFilter === "low" ? ui.segmentedOn : ""}>
                <span className="size-1.5 rounded-full bg-[var(--warn)]" />
                {t("reports.low_stock", "Low Stock")}
                <span className="font-mono text-[var(--faint)]">{stockData?.lowStock.length || 0}</span>
              </button>
              <button role="tab" aria-selected={stockFilter === "out"} onClick={() => setStockFilter("out")} className={stockFilter === "out" ? ui.segmentedOn : ""}>
                <span className="size-1.5 rounded-full bg-[var(--neg)]" />
                {t("reports.out_of_stock", "Out of Stock")}
                <span className="font-mono text-[var(--faint)]">{stockData?.outOfStock.length || 0}</span>
              </button>
            </div>
            <span className={rp.caption}>
              {stockFilter === "all" ? "Full catalogue inventory & valuation" : stockFilter === "low" ? "Items approaching their reorder threshold" : "Items depleted to zero"}
            </span>
          </div>

          <MetricStrip>
            <Metric
              label="Stock units"
              icon="layers"
              value={(stockData?.summary.totalUnits || 0).toLocaleString()}
              hint={`Across ${stockData?.summary.totalProducts || 0} items`}
            />
            <Metric label="Retail valuation" icon="pkr" tone="pos" value={money(stockData?.summary.totalRetailValue)} hint="At customer selling price" />
            <Metric label="Cost valuation" icon="wallet" value={money(stockData?.summary.totalCostValue)} hint="Capital invested in stock" />
            {(() => {
              const alerts = (stockData?.summary.lowStockCount || 0) + (stockData?.summary.outOfStockCount || 0);
              return (
                <Metric
                  label="Inventory alerts"
                  icon="alert"
                  tone={alerts > 0 ? "neg" : "pos"}
                  value={alerts.toLocaleString()}
                  hint={`${stockData?.summary.outOfStockCount || 0} out · ${stockData?.summary.lowStockCount || 0} low`}
                />
              );
            })()}
          </MetricStrip>

          <div className={rp.triGrid}>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Stock value by category</h2>
              <RankList rows={categoryStockValue} color="var(--brand)" empty="Add stock to see where your money sits." />
            </section>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Furthest below reorder level</h2>
              <RankList
                rows={[...(stockData?.lowStock || [])].sort((a, b) => b.deficit - a.deficit).slice(0, 6).map((p) => ({ label: p.name, value: p.deficit }))}
                color="var(--warn)"
                empty="Nothing is below its reorder level."
              />
            </section>
            <section className={rp.card}>
              <h2 className={rp.cardTitle}>Inventory health</h2>
              <div className="mt-4">
                <CompositionBar
                  segments={[
                    { label: "Healthy", value: stockData?.summary.healthyCount || 0, color: "var(--brand)" },
                    { label: "Low", value: stockData?.summary.lowStockCount || 0, color: "var(--c-udhaar)" },
                    { label: "Out", value: stockData?.summary.outOfStockCount || 0, color: "var(--neg)" },
                  ]}
                  showLegend={false}
                />
              </div>
              <div className={rp.legend}>
                <span><i style={{ background: "var(--brand)" }} />Healthy <b className="font-mono font-medium">{stockData?.summary.healthyCount || 0}</b></span>
                <span><i style={{ background: "var(--c-udhaar)" }} />Low <b className="font-mono font-medium">{stockData?.summary.lowStockCount || 0}</b></span>
                <span><i style={{ background: "var(--neg)" }} />Out <b className="font-mono font-medium">{stockData?.summary.outOfStockCount || 0}</b></span>
              </div>
            </section>
          </div>

          <section className={`${ui.panel} ${ui.panelFlush}`}>
            <div className={ui.panelHead}>
              <div>
                <h2>{stockFilter === "all" ? "Inventory ledger" : stockFilter === "low" ? "Low stock reorder list" : "Out of stock — restock now"}</h2>
                <p>Stock levels, thresholds and valuation</p>
              </div>
              <span className={ui.chip}>
                <span className="font-mono">{currentStockList.length}</span> items
              </span>
            </div>
            <div className={`${ui.tableWrap} ${ui.tableBare}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Threshold</th>
                    <th className="text-right">Valuation</th>
                    <th>Status</th>
                    <th className="no-print text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows cols={9} />
                  ) : paginatedStock.length === 0 ? (
                    <TableEmptyRow
                      colSpan={9}
                      icon={stockFilter === "all" ? "box" : "check"}
                      title={stockFilter === "all" ? "No inventory yet" : stockFilter === "low" ? "Nothing running low" : "Nothing out of stock"}
                      body={stockFilter === "all" ? "Add products to start tracking stock and valuation." : "All stock levels are healthy."}
                    />
                  ) : (
                    paginatedStock.map((prod) => (
                      <tr key={prod.id}>
                        <td>
                          <span className="block font-medium">{prod.name}</span>
                          <small className="font-mono text-[11.5px] text-[var(--faint)]">{prod.barcode}</small>
                        </td>
                        <td className="text-[var(--text-2)]">{prod.category}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{money(prod.costPrice)}</td>
                        <td className="text-right font-mono">{money(prod.sellingPrice)}</td>
                        <td className="text-right">
                          <span
                            className={`font-mono font-medium ${
                              prod.stock <= 0 ? "text-[var(--neg)]" : prod.stock <= prod.lowStockThreshold ? "text-[var(--warn)]" : "text-[var(--pos)]"
                            }`}
                          >
                            {prod.stock}
                          </span>
                        </td>
                        <td className="text-right font-mono text-[var(--muted)]">≤ {prod.lowStockThreshold}</td>
                        <td className="text-right font-mono font-medium">{money(prod.totalRetailValue)}</td>
                        <td>
                          <span
                            className={
                              prod.stockStatus === "Out of Stock" ? ui.outOfStock : prod.stockStatus === "Low Stock" ? ui.lowStock : ui.healthy
                            }
                          >
                            {prod.stockStatus}
                          </span>
                        </td>
                        <td className="no-print text-right">
                          <Link href={`/products?search=${encodeURIComponent(prod.name)}`} className={`${ui.secondary} ${ui.btnSm}`}>
                            Restock
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {currentStockList.length > 0 && (
              <PaginationControls
                currentPage={stockPage}
                totalItems={currentStockList.length}
                pageSize={stockPageSize}
                onPageChange={setStockPage}
                onPageSizeChange={(newSize) => {
                  setStockPageSize(newSize);
                  setStockPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="inventory items"
                className="no-print"
              />
            )}
          </section>
        </div>
      )}

      {/* Receipt Preview Modal */}
      <ReceiptModal sale={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </WorkspaceShell>
  );
}

/** Horizontal ranking bars (Reports board: "Revenue by category", "Where expenses went"). */
function RankList({ rows, color, empty }: { rows: Array<{ label: string; value: number }>; color: string; empty: string }) {
  if (!rows.length) return <p className={rp.cardNote}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={rp.rankList}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className={rp.rankRow}>
          <span title={r.label}>{r.label}</span>
          <i style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color, animationDelay: `${i * 40}ms` }} />
          <span>{r.value >= 100000 ? shortRs(r.value) : formatRs(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
