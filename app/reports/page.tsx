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
        eyebrow="Analytics"
        title={t("reports.title", "Reports & Analytics")}
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
              {t("reports.print", "Print Report")}
            </button>
          </div>
        }
      />

      <div className={`${ui.tabBar} no-print`} role="tablist" aria-label="Report type">
        {(
          [
            { id: "sales", icon: "cart", label: t("reports.sales_report", "Sales Report") },
            { id: "products", icon: "box", label: t("reports.product_report", "Product Report") },
            { id: "stock", icon: "layers", label: t("reports.stock_report", "Stock Report") },
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
                  { id: "daily", label: t("reports.daily", "Daily (Today)") },
                  { id: "weekly", label: t("reports.weekly", "Weekly (7 Days)") },
                  { id: "monthly", label: t("reports.monthly", "Monthly (30 Days)") },
                ] as const
              ).map((p) => (
                <button key={p.id} role="tab" aria-selected={salesPeriod === p.id} onClick={() => setSalesPeriod(p.id)} className={salesPeriod === p.id ? ui.segmentedOn : ""}>
                  {p.label}
                </button>
              ))}
            </div>
            <span className={rp.caption}>
              <Icon name="calendar" size={13} />
              {salesPeriod === "daily" ? "Today's live sales" : salesPeriod === "weekly" ? "Past 7 calendar days" : "Past 30 calendar days"}
            </span>
          </div>

          <MetricStrip>
            <Metric
              label="Total revenue"
              icon="pkr"
              tone="pos"
              value={loading ? <Skeleton className="h-6 w-24" /> : money(salesData?.summary.totalRevenue)}
              hint={`Cash ${money(salesData?.summary.cashTotal)} · Online ${money(salesData?.summary.onlineTotal)}`}
            />
            <Metric
              label="Orders / invoices"
              icon="invoice"
              value={loading ? <Skeleton className="h-6 w-16" /> : (salesData?.summary.totalOrders || 0).toLocaleString()}
              hint={`Average order ${money(salesData?.summary.averageOrder)}`}
            />
            <Metric
              label="Items sold"
              icon="box"
              value={loading ? <Skeleton className="h-6 w-16" /> : (salesData?.summary.totalItems || 0).toLocaleString()}
              hint="Units sold through POS"
            />
            <Metric
              label="Discounts given"
              icon="tag"
              value={loading ? <Skeleton className="h-6 w-20" /> : money(salesData?.summary.totalDiscounts)}
              hint="Customer bill discounts"
            />
          </MetricStrip>

          {(salesPeriod === "weekly" || salesPeriod === "monthly") && (
            <>
              <section className={`${ui.panel} ${ui.panelFlush}`}>
                <div className={ui.panelHead}>
                  <div>
                    <h2>Revenue trend</h2>
                    <p>{salesPeriod === "weekly" ? "Last 7 days" : "Last 30 days"} · hover a bar for detail</p>
                  </div>
                  <span className={ui.chip}>
                    Peak <span className="font-mono">{money(Math.max(...(salesData?.breakdown.map((b) => b.totalAmount) || [0]), 0))}</span>
                  </span>
                </div>
                <div className={ui.panelBody}>
                  {(() => {
                    const rows = salesData?.breakdown || [];
                    const maxVal = Math.max(...rows.map((x) => x.totalAmount), 1);
                    return (
                      <div className={rp.chart} data-dense={rows.length > 14 ? "" : undefined}>
                        <div className={rp.gridLines} aria-hidden>
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className={rp.bars}>
                          {rows.map((b, i) => {
                            const heightPct = b.totalAmount > 0 ? Math.max(4, Math.round((b.totalAmount / maxVal) * 100)) : 0;
                            return (
                              <div key={b.date} className={rp.barCol} tabIndex={0} aria-label={`${b.displayDate}: ${money(b.totalAmount)}, ${b.orders} orders`}>
                                <div className={rp.tip}>
                                  <strong>{money(b.totalAmount)}</strong>
                                  <span>
                                    {b.displayDate} · {b.orders} orders
                                  </span>
                                </div>
                                <div
                                  className={`${rp.bar} ${b.totalAmount > 0 ? "" : rp.barEmpty}`}
                                  style={{ height: heightPct ? `${heightPct}%` : undefined, animationDelay: `${Math.min(i * 18, 400)}ms` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div className={rp.axis}>
                    <span>{salesData?.breakdown[0]?.displayDate}</span>
                    <span>{salesData?.breakdown[Math.floor((salesData?.breakdown.length || 0) / 2)]?.displayDate}</span>
                    <span>{salesData?.breakdown[(salesData?.breakdown.length || 1) - 1]?.displayDate}</span>
                  </div>
                </div>
              </section>

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
                      {loading ? (
                        <TableSkeletonRows cols={6} />
                      ) : (salesData?.breakdown || []).length === 0 ? (
                        <TableEmptyRow colSpan={6} icon="chart" title="No sales in this period" body="Completed sales will appear here day by day." />
                      ) : (
                        (salesData?.breakdown || []).map((b) => (
                          <tr key={b.date}>
                            <td className="font-medium">{b.displayDate}</td>
                            <td className="text-[var(--muted)]">{b.dayName}</td>
                            <td className="text-right font-mono">{b.orders}</td>
                            <td className="text-right font-mono">{b.totalItems}</td>
                            <td className="text-right font-mono text-[var(--muted)]">{b.discounts > 0 ? money(b.discounts) : "—"}</td>
                            <td className="text-right font-mono font-medium">{money(b.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
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
                      <th>Invoice #</th>
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
                    {loading ? (
                      <TableSkeletonRows cols={8} />
                    ) : (salesData?.sales || []).length === 0 ? (
                      <TableEmptyRow colSpan={8} icon="receipt" title="No sales recorded today" body="Completed POS sales show up here in real time." />
                    ) : (
                      paginatedSales.map((s) => (
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
                          <td className="font-mono text-[12.5px] text-[var(--brand-ink)]">{s.invoiceNumber}</td>
                          <td className="font-mono text-[12.5px] text-[var(--muted)]">
                            {new Date(s.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td>
                            <span className="font-medium">{s.customerName}</span>
                            {s.customerMobile && <small className="block font-mono text-[11.5px] text-[var(--faint)]">{s.customerMobile}</small>}
                          </td>
                          <td className="text-[var(--text-2)]">{s.cashier}</td>
                          <td className="text-right font-mono">{s.totalItems}</td>
                          <td>
                            <span className={`${ui.chip} ${(s.paymentMethod || "").toLowerCase() === "cash" ? ui.chipPos : ui.chipInfo}`}>
                              {s.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="text-right font-mono text-[var(--muted)]">{s.discountAmount > 0 ? money(s.discountAmount) : "—"}</td>
                          <td className="text-right font-mono font-medium">{money(s.totalAmount)}</td>
                        </tr>
                      ))
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
