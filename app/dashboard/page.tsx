"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ReceiptModal, ReceiptSale } from "@/app/components/receipt-modal";
import { api } from "@/app/lib/api";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { useLanguage } from "@/app/components/language-context";
import styles from "./dashboard.module.css";

type Sale = { id: number | string; total_amount?: number; total_items?: number; created_at?: string };

type Product = {
  id?: number;
  name?: string;
  barcode?: string;
  category?: string;
  price?: number;
  sellingPrice?: number;
  selling_price?: number;
  stock?: number;
  lowStockThreshold?: number;
  low_stock_threshold?: number;
  imageUrl?: string | null;
};

type TopSellingProduct = {
  productId: number;
  name: string;
  quantitySold: number;
  totalRevenue: number;
  currentStock: number;
  price: number;
  category: string;
  imageUrl?: string | null;
};

type LowStockProduct = {
  id: number;
  name: string;
  barcode: string;
  stock: number;
  lowStockThreshold: number;
  price: number;
  category: string;
};

type AdminPayload = {
  productBreakdown?: { myProducts?: number; staffProducts?: number; unassignedProducts?: number };
  products?: Product[];
  sales?: Sale[];
  staffCount?: number;
  todaySales?: number;
  todayBills?: number;
  topSellingProducts?: TopSellingProduct[];
  lowStockProducts?: LowStockProduct[];
};

function Icon({ name }: { name: "chart" | "cash" | "cube" | "logout" | "people" | "receipt" | "refresh" | "trend" | "warning" | "fire" | "check" }) {
  const paths = {
    cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M17 14h.01" /><circle cx="12" cy="12" r="2" /></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1-8 0" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    cube: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="m3 8 9 5v9M21 8l-9 5M21 8v8l-9 6" /></>,
    warning: <><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></>,
    receipt: <><path d="M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2Z" /><path d="M9 9h6M9 13h6" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.34 5.66" /><path d="M20 4v7h-7" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 16 4-5 4 3 5-7" /></>,
    fire: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
    check: <path d="M20 6 9 17l-5-5" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g></svg>;
}

function money(value: number) { return `Rs ${Math.round(value).toLocaleString()}`; }

function MetricCard({
  icon,
  label,
  tone,
  value,
  sublabel,
  badge,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  tone: string;
  value: string;
  sublabel?: string;
  badge?: string;
}) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={styles.metricIcon}>
          <Icon name={icon} />
        </span>
        {badge && <span className={styles.metricBadge}>{badge}</span>}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {sublabel && <small className={styles.metricSub}>{sublabel}</small>}
      </div>
    </article>
  );
}

function SalesChart({ sales }: { sales: Sale[] }) {
  const { t } = useLanguage();
  const series = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const total = sales.reduce((sum, sale) => {
      if (!sale.created_at) return sum;
      const sold = new Date(sale.created_at); sold.setHours(0, 0, 0, 0);
      return sold.toDateString() === date.toDateString() ? sum + Number(sale.total_amount || 0) : sum;
    }, 0);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), total };
  }), [sales]);
  const max = Math.max(...series.map(day => day.total), 1);
  const points = series.map((day, i) => `${8 + i * 15.33},${82 - (day.total / max) * 62}`).join(" ");
  const area = `8,82 ${points} 100,82`;
  return <section className={styles.panel}>
    <div className={styles.panelHeading}>
      <div>
        <h2>{t("dashboard.sales_overview", "Sales overview")}</h2>
        <p>{t("dashboard.last_7_days", "Last 7 days")}</p>
      </div>
      <span>{t("dashboard.weekly", "Weekly")}</span>
    </div>
    <div className={styles.chartWrap}>
      <svg className={styles.chart} viewBox="0 0 108 90" preserveAspectRatio="none" role="img" aria-label="Sales over the last seven days">
        <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f766e" stopOpacity=".22" /><stop offset="1" stopColor="#0f766e" stopOpacity="0" /></linearGradient></defs>
        {[20, 40, 60, 82].map(y => <line key={y} x1="8" y1={y} x2="100" y2={y} className={styles.gridLine} />)}
        <polygon points={area} fill="url(#salesFill)" /><polyline points={points} className={styles.salesLine} />
        {series.map((day, i) => <circle key={day.label} cx={8 + i * 15.33} cy={82 - (day.total / max) * 62} r="1.4" className={styles.dot} />)}
      </svg>
      <div className={styles.chartLabels}>{series.map(day => <span key={day.label}>{day.label}</span>)}</div>
    </div>
  </section>;
}

function DashboardContent() {
  const { user, isLoading } = useAuth();
  const { activeBusiness, workspaceMode } = useBusiness();
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";

  const [data, setData] = useState<AdminPayload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeReceipt, setActiveReceipt] = useState<ReceiptSale | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = user.role === "admin" || user.role === "accountant" ? "/dashboard" : "/dashboard/me";
      const payload = await api<AdminPayload>(endpoint);
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user, activeBusiness?.id]);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (paymentSuccess && sessionId) {
      api("/billing/verify-session", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      }).catch((err) => {
        console.warn("Session auto-verification notice:", err);
      });
    }
  }, [paymentSuccess, sessionId]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      void fetchDashboard();
    }
  }, [fetchDashboard, user]);

  const products = data.products ?? [];
  const sales = data.sales ?? [];

  const { totalSales, totalItems, stockValue } = useMemo(() => {
    const sTotal = sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const iTotal = sales.reduce((sum, sale) => sum + Number(sale.total_items || 0), 0);
    const sValue = products.reduce(
      (sum, product) =>
        sum +
        Number(product.sellingPrice ?? product.selling_price ?? product.price ?? 0) *
          Number(product.stock ?? 0),
      0
    );

    return { totalSales: sTotal, totalItems: iTotal, stockValue: sValue };
  }, [sales, products]);

  // Section 16 Core Requirements:
  // 1. Today's Sales
  const todaySalesAmount = useMemo(() => {
    if (typeof data.todaySales === "number") return data.todaySales;
    const todayStr = new Date().toDateString();
    return sales.reduce((sum, s) => {
      if (!s.created_at) return sum;
      return new Date(s.created_at).toDateString() === todayStr
        ? sum + Number(s.total_amount || 0)
        : sum;
    }, 0);
  }, [data.todaySales, sales]);

  // 2. Number of Orders
  const todayOrdersCount = useMemo(() => {
    if (typeof data.todayBills === "number") return data.todayBills;
    const todayStr = new Date().toDateString();
    return sales.filter((s) => s.created_at && new Date(s.created_at).toDateString() === todayStr).length;
  }, [data.todayBills, sales]);

  // 3. Low Stock Products
  const lowStockProductsList = useMemo(() => {
    if (data.lowStockProducts && data.lowStockProducts.length > 0) {
      return data.lowStockProducts;
    }
    return products
      .filter((p) => Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? p.low_stock_threshold ?? 5))
      .map((p) => ({
        id: Number(p.id || 0),
        name: p.name || "Product",
        barcode: p.barcode || "",
        stock: Number(p.stock || 0),
        lowStockThreshold: Number(p.lowStockThreshold ?? p.low_stock_threshold ?? 5),
        price: Number(p.sellingPrice ?? p.selling_price ?? p.price ?? 0),
        category: p.category || "General",
      }));
  }, [data.lowStockProducts, products]);

  // 4. Top Selling Products
  const topSellingList = useMemo(() => {
    return data.topSellingProducts || [];
  }, [data.topSellingProducts]);

  // Financial Workspace Metrics
  const { cashInHand, bankBalance, customerReceivable, supplierPayable } = useMemo(() => ({
    cashInHand: Number(activeBusiness?.openingCashBalance || 0),
    bankBalance: Number(activeBusiness?.openingBankBalance || 0),
    customerReceivable: Number(activeBusiness?.customerReceivable || 0),
    supplierPayable: Number(activeBusiness?.supplierPayable || 0),
  }), [activeBusiness]);

  if (isLoading || !user) {
    return (
      <main className={styles.loadingPage}>
        <span className={styles.spinner} />
        Loading Almadel workspace…
      </main>
    );
  }

  return (
    <WorkspaceShell>
      {paymentSuccess && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-sm">Payment Successful! Subscription Activated</p>
              <p className="text-xs text-emerald-800">
                Thank you for subscribing to Almadel Pro. All POS and Financial features are fully active.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.replace("/dashboard")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.topbar}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={styles.eyebrow}>
              {user.role === "admin" ? t("role.owner", "Store Owner") : user.role === "accountant" ? t("role.accountant", "Accountant") : t("role.staff", "Staff Member")}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700">
              {workspaceMode === "financial" ? `📊 ${t("nav.dashboard", "Financial Workspace")}` : `🛒 ${t("nav.sales", "POS Workspace")}`}
            </span>
          </div>
          <h1>{t("auth.welcome_back", "Hello")}, {user.name}</h1>
          <p>
            {workspaceMode === "financial"
              ? (language === "ur" ? "Dukaan ka mukammal hisab kitab, rokarr, grahak udhaar aur stock valuation." : "Comprehensive financial standing, accounts, receivables, and inventory valuation.")
              : user.role === "admin"
              ? (language === "ur" ? "Aaj ki bikri, orders, kam stock aur ziyada bikne wala samaan ek jagah." : "Today's sales, order volume, low stock alerts, and top selling products at a glance.")
              : (language === "ur" ? "Aapke account ki zati bikri ki karkardagi." : "Your private sales performance for this account.")}
          </p>
        </div>
        <button className={styles.refresh} disabled={loading} onClick={() => void fetchDashboard()}>
          <Icon name="refresh" />{loading ? t("action.refresh", "Refreshing…") : t("action.refresh", "Refresh")}
        </button>
      </div>

      {error && <div className={styles.error} role="alert"><span>{error}</span><button onClick={() => void fetchDashboard()}>Try again</button></div>}

      {/* METRIC GRID: Section 16 Core Requirements */}
      {user.role === "admin" && workspaceMode === "financial" ? (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("dashboard.cash_in_hand", "Cash in Hand")}</span>
            <p className="text-base font-black text-emerald-800">₨ {cashInHand.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("nav.accounts", "Bank Accounts")}</span>
            <p className="text-base font-black text-blue-700">₨ {bankBalance.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("dashboard.customer_receivable", "Customer Khata")}</span>
            <p className="text-base font-black text-teal-700">₨ {customerReceivable.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("dashboard.supplier_payable", "Supplier Payables")}</span>
            <p className="text-base font-black text-amber-700">₨ {supplierPayable.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("nav.stock", "Stock Value")}</span>
            <p className="text-base font-black text-slate-900">{money(stockValue)}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t("dashboard.total_sales", "Recorded Sales")}</span>
            <p className="text-base font-black text-[#00875a]">{money(totalSales)}</p>
          </article>
        </section>
      ) : (
        <section className={styles.metricGrid} aria-label="Dashboard metrics">
          {/* Card 1: Today's Sales */}
          <MetricCard
            icon="cash"
            label={t("dashboard.today_sales", "Today's Sales")}
            tone="green"
            value={money(todaySalesAmount)}
            badge="TODAY"
            sublabel={`${t("dashboard.total_sales", "All-time")}: ${money(totalSales)}`}
          />
          {/* Card 2: Number of Orders */}
          <MetricCard
            icon="receipt"
            label={t("dashboard.today_orders", "Orders Today")}
            tone="blue"
            value={`${todayOrdersCount} Orders`}
            badge="LIVE"
            sublabel={`${sales.length} ${t("dashboard.total_orders", "total orders")}`}
          />
          {/* Card 3: Low Stock Products */}
          <MetricCard
            icon="warning"
            label={t("dashboard.low_stock", "Low Stock Products")}
            tone={lowStockProductsList.length > 0 ? "red" : "green"}
            value={`${lowStockProductsList.length} Items`}
            badge={lowStockProductsList.length > 0 ? "ATTENTION" : "HEALTHY"}
            sublabel={lowStockProductsList.length > 0 ? `${lowStockProductsList.length} below threshold` : "All inventory stocked"}
          />
          {/* Card 4: Top Inventory Valuation */}
          <MetricCard
            icon="cube"
            label={t("nav.stock", "Inventory Valuation")}
            tone="teal"
            value={money(stockValue)}
            badge="CATALOG"
            sublabel={`${products.length} products listed`}
          />
        </section>
      )}

      {/* DASHBOARD CONTENT GRID: Visual, Simple, and Actionable */}
      <div className={styles.dashboardGrid}>
        {/* Left Column: Trend Chart & Top Selling Products */}
        <div className={styles.mainColumn}>
          <SalesChart sales={sales} />

          {/* 4. Top Selling Products Widget */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>🔥 {t("dashboard.top_selling_products", "Top Selling Products")}</h2>
                <p>Best performing inventory ranked by units sold and generated revenue</p>
              </div>
              <span>Top Sellers</span>
            </div>

            {topSellingList.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="cube" />
                <p>No product sales recorded yet. Completed orders will rank items here automatically.</p>
              </div>
            ) : (
              <div className={styles.topSellerList}>
                {topSellingList.map((item, index) => {
                  const maxQty = Math.max(...topSellingList.map((i) => i.quantitySold), 1);
                  const pct = Math.min(100, Math.round((item.quantitySold / maxQty) * 100));
                  const rankClass =
                    index === 0
                      ? styles.rank1
                      : index === 1
                      ? styles.rank2
                      : index === 2
                      ? styles.rank3
                      : styles.rankOther;

                  return (
                    <article key={item.productId || index} className={styles.topSellerItem}>
                      <div className={styles.topSellerLeft}>
                        <span className={`${styles.rankBadge} ${rankClass}`}>#{index + 1}</span>
                        <div className={styles.sellerDetails}>
                          <strong>{item.name}</strong>
                          <div className={styles.sellerMeta}>
                            <small>{item.category || "General"}</small>
                            <span>•</span>
                            <div className={styles.volumeBarWrap} title={`${pct}% relative volume`}>
                              <div className={styles.volumeBar} style={{ width: `${pct}%` }} />
                            </div>
                            <small className="font-bold text-slate-800">{item.quantitySold} sold</small>
                          </div>
                        </div>
                      </div>
                      <div className={styles.sellerRevenue}>
                        <strong>{money(item.totalRevenue)}</strong>
                        <small>{item.currentStock > 0 ? `${item.currentStock} in stock` : "Out of stock"}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Low Stock Alerts & Recent Invoices */}
        <div className="flex flex-col gap-5">
          {/* 3. Low Stock Products Widget */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>⚠️ {t("dashboard.low_stock_products", "Low Stock Products")}</h2>
                <p>Items at or below reorder threshold</p>
              </div>
              <span
                style={{
                  background: lowStockProductsList.length > 0 ? "#fee2e2" : "#e6f4ed",
                  color: lowStockProductsList.length > 0 ? "#b91c1c" : "#006b3f",
                }}
              >
                {lowStockProductsList.length} {lowStockProductsList.length === 1 ? "Alert" : "Alerts"}
              </span>
            </div>

            {lowStockProductsList.length === 0 ? (
              <div className={styles.healthyBox}>
                <span>✨</span>
                <p>{t("dashboard.all_healthy_stock", "All stock levels healthy!")}</p>
                <small>No inventory is currently below the minimum reorder threshold.</small>
              </div>
            ) : (
              <div className={styles.lowStockList}>
                {lowStockProductsList.slice(0, 5).map((prod) => {
                  const isOut = prod.stock <= 0;
                  const isCritical = prod.stock > 0 && prod.stock <= 2;
                  return (
                    <article key={prod.id} className={styles.lowStockItem}>
                      <div className={styles.lowStockLeft}>
                        <strong>{prod.name}</strong>
                        <div className={styles.lowStockMeta}>
                          <small>{prod.barcode ? `Barcode: ${prod.barcode}` : (prod.category || "General")}</small>
                          <span>•</span>
                          <small>Min: ≤{prod.lowStockThreshold}</small>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`${styles.stockBadge} ${
                            isOut ? styles.stockBadgeOut : isCritical ? styles.stockBadgeCritical : styles.stockBadgeLow
                          }`}
                        >
                          {isOut ? "Out of Stock" : `${prod.stock} Left`}
                        </span>
                        <Link href={`/products?search=${encodeURIComponent(prod.name)}`} className={styles.restockBtn}>
                          + Restock
                        </Link>
                      </div>
                    </article>
                  );
                })}
                {lowStockProductsList.length > 5 && (
                  <Link
                    href="/products"
                    className="block text-center text-xs font-bold text-emerald-700 hover:underline pt-1"
                  >
                    View all {lowStockProductsList.length} low stock products →
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Recent Invoices Widget */}
          <section className={`${styles.panel} ${styles.recent}`}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{t("dashboard.recent_sales", user.role === "admin" ? "Recent sales" : "My recent sales")}</h2>
                <p>{t("dashboard.last_7_days", "Latest activity")}</p>
              </div>
              <span className="text-[11px] font-bold text-slate-500">Invoices</span>
            </div>
            <div className={styles.saleList}>
              {sales.length === 0 ? (
                <div className={styles.empty}>
                  <Icon name="receipt" />
                  <p>{t("dashboard.no_sales", "No sales recorded yet.")}</p>
                </div>
              ) : (
                sales.slice(0, 5).map((sale) => (
                  <article
                    className={styles.saleRow}
                    key={sale.id}
                    onClick={() =>
                      setActiveReceipt({
                        id: String(sale.id),
                        total: Number(sale.total_amount || 0),
                        itemsCount: Number(sale.total_items || 1),
                        createdByName: user.name,
                        createdAt: sale.created_at || new Date().toISOString(),
                      })
                    }
                    style={{ cursor: "pointer" }}
                    title="Click to view printable invoice receipt"
                  >
                    <span>
                      <strong>Sale #{sale.id}</strong>
                      <small>{sale.total_items ?? 1} items</small>
                    </span>
                    <strong>{money(Number(sale.total_amount || 0))}</strong>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <ReceiptModal sale={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </WorkspaceShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className={styles.loadingPage}><span className={styles.spinner} />Loading Almadel workspace…</main>}>
      <DashboardContent />
    </Suspense>
  );
}
