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
import { PaginationControls } from "@/app/components/pagination-controls";
import styles from "./dashboard.module.css";
import { Icon, type IconName } from "@/app/components/icons";
import { AnimatedNumber, Skeleton } from "@/app/components/motion";
import { useNavRole } from "@/hooks/useNavRole";

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


function money(value: number) { return `Rs ${Math.round(value).toLocaleString()}`; }

function KpiCell({
  icon,
  label,
  value,
  format,
  tone = "neutral",
  badge,
  sublabel,
  loading,
}: {
  icon: IconName;
  label: string;
  value: number;
  format: (n: number, final: boolean) => string;
  tone?: "neutral" | "pos" | "warn" | "neg" | "info";
  badge?: string;
  sublabel?: string;
  loading?: boolean;
}) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <span className={styles.kpiIcon}>
          <Icon name={icon} size={15} />
        </span>
        <p>{label}</p>
        {badge && <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{badge}</span>}
      </div>
      {loading ? (
        <Skeleton className={styles.kpiSkeleton} />
      ) : (
        <strong className={tone === "warn" || tone === "neg" ? styles[`ink_${tone}`] : undefined}>
          <AnimatedNumber value={value} format={format} />
        </strong>
      )}
      {sublabel && <small>{sublabel}</small>}
    </article>
  );
}

function SalesChart({ sales }: { sales: Sale[] }) {
  const { t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const series = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const total = sales.reduce((sum, sale) => {
      if (!sale.created_at) return sum;
      const sold = new Date(sale.created_at); sold.setHours(0, 0, 0, 0);
      return sold.toDateString() === date.toDateString() ? sum + Number(sale.total_amount || 0) : sum;
    }, 0);
    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      full: date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }),
      total,
    };
  }), [sales]);

  const W = 700;
  const H = 200;
  const PAD_X = 12;
  const rawMax = Math.max(...series.map(day => day.total), 1);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const max = Math.ceil(rawMax / step) * step || 1;
  const x = (i: number) => PAD_X + i * ((W - PAD_X * 2) / 6);
  const y = (v: number) => H - (v / max) * (H - 12);
  const pts = series.map((d, i) => [x(i), y(d.total)] as const);
  let line = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x1 - x0) / 2;
    line += ` C${x0 + cx},${y0} ${x1 - cx},${y1} ${x1},${y1}`;
  }
  const area = `${line} L${pts[6][0]},${H} L${pts[0][0]},${H} Z`;
  const weekTotal = series.reduce((s, d) => s + d.total, 0);
  const active = hover ?? 6;
  const [ax, ay] = pts[active];
  const ticks = [max, max / 2, 0];

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{t("dashboard.sales_overview", "Sales overview")}</h2>
          <p>
            {t("dashboard.last_7_days", "Last 7 days")} · <span className={styles.figure}>{money(weekTotal)}</span>
          </p>
        </div>
        <span className={styles.chip}>{t("dashboard.weekly", "Weekly")}</span>
      </div>
      <div className={styles.chartWrap}>
        <div className={styles.chartAxis} aria-hidden>
          {ticks.map((v) => (
            <span key={v}>{v >= 1000 ? `${Math.round(v / 1000).toLocaleString()}k` : Math.round(v)}</span>
          ))}
        </div>
        <div className={styles.chartArea} onMouseLeave={() => setHover(null)}>
          <svg className={styles.chart} viewBox={`0 -2 ${W} ${H + 4}`} preserveAspectRatio="none" role="img" aria-label="Sales over the last seven days">
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--c1)" stopOpacity=".18" />
                <stop offset="1" stopColor="var(--c1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} className={styles.gridLine} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#salesFill)" className={styles.areaFill} />
            <path d={line} className={styles.salesLine} vectorEffect="non-scaling-stroke" />
            <line x1={ax} x2={ax} y1={0} y2={H} className={styles.crosshair} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className={styles.marker} style={{ left: `${(ax / W) * 100}%`, top: `${((ay + 2) / (H + 4)) * 100}%` }} />
          <div
            className={styles.tooltip}
            style={{
              left: `${(ax / W) * 100}%`,
              transform: `translateX(${active >= 5 ? "-100%" : active <= 1 ? "0" : "-50%"})`,
            }}
          >
            <small>{series[active].full}</small>
            <strong>{money(series[active].total)}</strong>
          </div>
          <div className={styles.hitRow}>
            {series.map((d, i) => (
              <button
                key={d.full}
                type="button"
                className={styles.hit}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.full}: ${money(d.total)}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.chartLabels}>
        {series.map((day, i) => (
          <span key={day.full} className={i === active ? styles.chartLabelOn : undefined}>{day.label}</span>
        ))}
      </div>
    </section>
  );
}

function DashboardContent() {
  const { user, isLoading, refreshUser } = useAuth();
  const { activeBusiness, workspaceMode, reloadBusinesses, switchBusiness } = useBusiness();
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";

  const [data, setData] = useState<AdminPayload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeReceipt, setActiveReceipt] = useState<ReceiptSale | null>(null);

  const navRole = useNavRole();

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = navRole === "admin" || navRole === "accountant" ? "/dashboard" : "/dashboard/me";
      const payload = await api<AdminPayload>(endpoint);
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user, navRole, activeBusiness?.id]);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!paymentSuccess || !sessionId) return;

    void (async () => {
      try {
        const result = await api<{
          verified?: boolean;
          onboarding?: boolean;
          workspaceMode?: string;
          business?: { id: number; workspaceMode?: string };
        }>("/billing/verify-session", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });

        if (!result.verified || !result.business?.id) return;

        await refreshUser();

        const list = await reloadBusinesses();
        switchBusiness(result.business.id);

        const mode =
          result.workspaceMode ||
          result.business.workspaceMode ||
          list.find((b) => b.id === result.business?.id)?.workspaceMode;

        if (mode === "financial") {
          router.replace(`/setup-business/financial?businessId=${result.business.id}`);
        } else {
          router.replace("/sales");
        }
      } catch (err) {
        console.warn("Session auto-verification notice:", err);
      }
    })();
  }, [paymentSuccess, sessionId, reloadBusinesses, switchBusiness, router, refreshUser]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (isLoading || !user) return;
    // Stripe return URL lands here first — verify-session must run before pending redirect.
    if (paymentSuccess && sessionId) return;
    if (user.role === "pending" && !activeBusiness) {
      router.replace("/setup-business");
    }
  }, [isLoading, user, activeBusiness, paymentSuccess, sessionId, router]);

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

  // Dashboard Widget Pagination
  const [topSellerPage, setTopSellerPage] = useState(1);
  const [topSellerPageSize, setTopSellerPageSize] = useState(5);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockPageSize, setLowStockPageSize] = useState(5);
  const [recentSalesPage, setRecentSalesPage] = useState(1);
  const [recentSalesPageSize, setRecentSalesPageSize] = useState(5);

  const paginatedTopSellers = useMemo(() => {
    const start = (topSellerPage - 1) * topSellerPageSize;
    return topSellingList.slice(start, start + topSellerPageSize);
  }, [topSellingList, topSellerPage, topSellerPageSize]);

  const paginatedLowStock = useMemo(() => {
    const start = (lowStockPage - 1) * lowStockPageSize;
    return lowStockProductsList.slice(start, start + lowStockPageSize);
  }, [lowStockProductsList, lowStockPage, lowStockPageSize]);

  const paginatedRecentSales = useMemo(() => {
    const start = (recentSalesPage - 1) * recentSalesPageSize;
    return sales.slice(start, start + recentSalesPageSize);
  }, [sales, recentSalesPage, recentSalesPageSize]);

  if (isLoading || !user) {
    return (
      <main className={styles.loadingPage}>
        <span className={styles.spinner} />
        Loading Almadel workspace…
      </main>
    );
  }


  const roleLabel =
    navRole === "admin" ? t("role.owner", "Store Owner") : navRole === "accountant" ? t("role.accountant", "Accountant") : t("role.staff", "Staff Member");
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const pkr = (n: number, final?: boolean) => `₨ ${(final ? n : Math.round(n)).toLocaleString()}`;
  const maxQty = Math.max(...topSellingList.map((i) => i.quantitySold), 1);
  const isFreshSale = (iso?: string) => (iso ? Date.now() - new Date(iso).getTime() < 3 * 60 * 1000 : false);

  return (
    <WorkspaceShell>
      {paymentSuccess && (
        <div className={styles.successBanner} role="status">
          <span className={styles.successIcon}>
            <Icon name="check" size={16} strokeWidth={2.2} />
          </span>
          <div>
            <p>Payment Successful! Subscription Activated</p>
            <small>Thank you for subscribing to Almadel Pro. All POS and Financial features are fully active.</small>
          </div>
          <button onClick={() => router.replace("/dashboard")} className={styles.ghostBtn}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>{todayLabel}</span>
            <span className={styles.dotSep} aria-hidden />
            <span className={styles.eyebrow}>{roleLabel}</span>
            <span className={styles.wsPill}>
              <Icon name={workspaceMode === "financial" ? "wallet" : "cart"} size={12} />
              {workspaceMode === "financial" ? t("shell.workspace_financial", "Financial") : t("shell.workspace_pos", "POS")}
            </span>
          </div>
          <h1>{t("auth.welcome_back", "Hello")}, {user.name}</h1>
          <p>
            {workspaceMode === "financial"
              ? (language === "ur" ? "Dukaan ka mukammal hisab kitab, rokarr, grahak udhaar aur stock valuation." : "Comprehensive financial standing, accounts, receivables, and inventory valuation.")
              : navRole === "admin"
              ? (language === "ur" ? "Aaj ki bikri, orders, kam stock aur ziyada bikne wala samaan ek jagah." : "Today's sales, order volume, low stock alerts, and top selling products at a glance.")
              : (language === "ur" ? "Aapke account ki zati bikri ki karkardagi." : "Your private sales performance for this account.")}
          </p>
        </div>
        <button className={styles.refresh} disabled={loading} onClick={() => void fetchDashboard()}>
          <Icon name="refresh" size={15} className={loading ? styles.spinning : undefined} />
          {loading ? t("action.refresh", "Refreshing…") : t("action.refresh", "Refresh")}
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button onClick={() => void fetchDashboard()}>Try again</button>
        </div>
      )}

      {/* KPI STRIP */}
      {navRole === "admin" && workspaceMode === "financial" ? (
        <section className={`${styles.kpiStrip} ${styles.kpiStrip6}`} aria-label="Financial metrics">
          <KpiCell icon="pkr" label={t("dashboard.cash_in_hand", "Cash in Hand")} value={cashInHand} format={pkr} loading={loading && !data.sales} />
          <KpiCell icon="wallet" label={t("nav.accounts", "Bank Accounts")} value={bankBalance} format={pkr} loading={loading && !data.sales} />
          <KpiCell icon="users" label={t("dashboard.customer_receivable", "Customer Khata")} value={customerReceivable} format={pkr} tone="info" loading={loading && !data.sales} />
          <KpiCell icon="truck" label={t("dashboard.supplier_payable", "Supplier Payables")} value={supplierPayable} format={pkr} tone="warn" loading={loading && !data.sales} />
          <KpiCell icon="box" label={t("nav.stock", "Stock Value")} value={stockValue} format={money} loading={loading && !data.sales} />
          <KpiCell icon="chart" label={t("dashboard.total_sales", "Recorded Sales")} value={totalSales} format={money} tone="pos" loading={loading && !data.sales} />
        </section>
      ) : (
        <section className={styles.kpiStrip} aria-label="Dashboard metrics">
          <KpiCell
            icon="pkr"
            label={t("dashboard.today_sales", "Today's Sales")}
            value={todaySalesAmount}
            format={money}
            tone="pos"
            badge="Today"
            sublabel={`${t("dashboard.total_sales", "All-time")}: ${money(totalSales)}`}
            loading={loading && !data.sales}
          />
          <KpiCell
            icon="invoice"
            label={t("dashboard.today_orders", "Orders Today")}
            value={todayOrdersCount}
            format={(n) => `${Math.round(n)} Orders`}
            tone="info"
            badge="Live"
            sublabel={`${sales.length} ${t("dashboard.total_orders", "total orders")}`}
            loading={loading && !data.sales}
          />
          <KpiCell
            icon="alert"
            label={t("dashboard.low_stock", "Low Stock Products")}
            value={lowStockProductsList.length}
            format={(n) => `${Math.round(n)} Items`}
            tone={lowStockProductsList.length > 0 ? "warn" : "pos"}
            badge={lowStockProductsList.length > 0 ? "Attention" : "Healthy"}
            sublabel={lowStockProductsList.length > 0 ? `${lowStockProductsList.length} below threshold` : "All inventory stocked"}
            loading={loading && !data.sales}
          />
          <KpiCell
            icon="box"
            label={t("nav.stock", "Inventory Valuation")}
            value={stockValue}
            format={money}
            badge="Catalog"
            sublabel={`${products.length} products listed`}
            loading={loading && !data.sales}
          />
        </section>
      )}

      <div className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <SalesChart sales={sales} />

          {/* Top selling products */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{t("dashboard.top_selling_products", "Top Selling Products")}</h2>
                <p>Best performing inventory ranked by units sold and generated revenue</p>
              </div>
              <span className={styles.chip}>Top Sellers</span>
            </div>

            {topSellingList.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}><Icon name="box" size={20} /></span>
                <p>No product sales recorded yet. Completed orders will rank items here automatically.</p>
              </div>
            ) : (
              <div className={`${styles.topSellerList} al-stagger`}>
                {paginatedTopSellers.map((item, index) => {
                  const globalRank = (topSellerPage - 1) * topSellerPageSize + index + 1;
                  const pct = Math.min(100, Math.round((item.quantitySold / maxQty) * 100));
                  return (
                    <article key={item.productId || index} className={styles.topSellerItem}>
                      <span className={`${styles.rankBadge} ${globalRank <= 3 ? styles.rankTop : ""}`}>{globalRank}</span>
                      <div className={styles.sellerDetails}>
                        <div className={styles.sellerLine}>
                          <strong>{item.name}</strong>
                          <span className={styles.figure}>{money(item.totalRevenue)}</span>
                        </div>
                        <div className={styles.sellerMeta}>
                          <small className={styles.sellerCat}>{item.category || "General"}</small>
                          <div className={styles.volumeBarWrap} title={`${pct}% relative volume`}>
                            <div className={styles.volumeBar} style={{ width: `${pct}%` }} />
                          </div>
                          <small className={styles.sold}>{item.quantitySold} sold</small>
                          <small className={item.currentStock > 0 ? undefined : styles.ink_neg}>
                            {item.currentStock > 0 ? `${item.currentStock} in stock` : "Out of stock"}
                          </small>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {topSellingList.length > 0 && (
              <PaginationControls
                currentPage={topSellerPage}
                totalItems={topSellingList.length}
                pageSize={topSellerPageSize}
                onPageChange={setTopSellerPage}
                onPageSizeChange={(newSize) => {
                  setTopSellerPageSize(newSize);
                  setTopSellerPage(1);
                }}
                pageSizeOptions={[2, 5, 10, 20]}
                itemLabel="items"
                compact
                className={styles.pager}
              />
            )}
          </section>
        </div>

        <div className={styles.sideColumn}>
          {/* Low stock */}
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{t("dashboard.low_stock_products", "Low Stock Products")}</h2>
                <p>Items at or below reorder threshold</p>
              </div>
              <span className={`${styles.tag} ${lowStockProductsList.length > 0 ? styles.tag_warn : styles.tag_pos}`}>
                {lowStockProductsList.length} {lowStockProductsList.length === 1 ? "Alert" : "Alerts"}
              </span>
            </div>

            {lowStockProductsList.length === 0 ? (
              <div className={styles.healthyBox}>
                <span className={styles.emptyIcon}><Icon name="check" size={18} strokeWidth={2} /></span>
                <p>{t("dashboard.all_healthy_stock", "All stock levels healthy!")}</p>
                <small>No inventory is currently below the minimum reorder threshold.</small>
              </div>
            ) : (
              <div className={`${styles.lowStockList} al-stagger`}>
                {paginatedLowStock.map((prod) => {
                  const isOut = prod.stock <= 0;
                  const isCritical = prod.stock > 0 && prod.stock <= 2;
                  const threshold = Math.max(prod.lowStockThreshold, 1);
                  const fill = Math.max(0, Math.min(100, (prod.stock / threshold) * 100));
                  return (
                    <article key={prod.id} className={styles.lowStockItem}>
                      <div className={styles.lowStockLeft}>
                        <strong>{prod.name}</strong>
                        <div className={styles.lowStockMeta}>
                          <small className={prod.barcode ? styles.mono : undefined}>{prod.barcode ? prod.barcode : (prod.category || "General")}</small>
                          <span aria-hidden>·</span>
                          <small>Min ≤{prod.lowStockThreshold}</small>
                        </div>
                      </div>
                      <div className={styles.lowStockRight}>
                        <span className={`${styles.stockCount} ${isOut || isCritical ? styles.ink_neg : styles.ink_warn}`}>
                          {isOut ? "Out of Stock" : `${prod.stock} Left`}
                        </span>
                        <span className={styles.stockMeter} aria-hidden>
                          <span style={{ width: `${fill}%` }} className={isOut || isCritical ? styles.meterNeg : styles.meterWarn} />
                        </span>
                      </div>
                      <Link href={`/products?search=${encodeURIComponent(prod.name)}`} className={styles.restockBtn}>
                        <Icon name="plus" size={13} strokeWidth={2} />
                        Restock
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
            {lowStockProductsList.length > 0 && (
              <PaginationControls
                currentPage={lowStockPage}
                totalItems={lowStockProductsList.length}
                pageSize={lowStockPageSize}
                onPageChange={setLowStockPage}
                onPageSizeChange={(newSize) => {
                  setLowStockPageSize(newSize);
                  setLowStockPage(1);
                }}
                pageSizeOptions={[2, 5, 10, 20]}
                itemLabel="alerts"
                compact
                className={styles.pager}
              />
            )}
          </section>

          {/* Recent sales */}
          <section className={`${styles.panel} ${styles.recent}`}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{t("dashboard.recent_sales", navRole === "admin" ? "Recent sales" : "My recent sales")}</h2>
                <p>{t("dashboard.last_7_days", "Latest activity")}</p>
              </div>
              <span className={styles.chip}>Invoices</span>
            </div>
            <div className={styles.saleList}>
              {sales.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}><Icon name="invoice" size={20} /></span>
                  <p>{t("dashboard.no_sales", "No sales recorded yet.")}</p>
                </div>
              ) : (
                <div className="al-stagger">
                  {paginatedRecentSales.map((sale) => (
                    <button
                      type="button"
                      className={`${styles.saleRow} ${isFreshSale(sale.created_at) ? "al-arrive" : ""}`}
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
                      title="Click to view printable invoice receipt"
                    >
                      <span className={styles.saleIcon}><Icon name="invoice" size={15} /></span>
                      <span className={styles.saleText}>
                        <strong>Sale #{sale.id}</strong>
                        <small>
                          {sale.total_items ?? 1} items
                          {sale.created_at
                            ? ` · ${new Date(sale.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </small>
                      </span>
                      <strong className={styles.figure}>{money(Number(sale.total_amount || 0))}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sales.length > 0 && (
              <PaginationControls
                currentPage={recentSalesPage}
                totalItems={sales.length}
                pageSize={recentSalesPageSize}
                onPageChange={setRecentSalesPage}
                onPageSizeChange={(newSize) => {
                  setRecentSalesPageSize(newSize);
                  setRecentSalesPage(1);
                }}
                pageSizeOptions={[2, 5, 10, 20]}
                itemLabel="invoices"
                compact
                className={styles.pager}
              />
            )}
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
