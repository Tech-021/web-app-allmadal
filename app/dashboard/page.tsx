"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ReceiptModal, ReceiptSale } from "@/app/components/receipt-modal";
import { api } from "@/app/lib/api";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import styles from "./dashboard.module.css";

type Sale = { id: number | string; total_amount?: number; total_items?: number; created_at?: string };
type Product = { price?: number; sellingPrice?: number; selling_price?: number; stock?: number; lowStockThreshold?: number; low_stock_threshold?: number };
type AdminPayload = {
  productBreakdown?: { myProducts?: number; staffProducts?: number; unassignedProducts?: number };
  products?: Product[];
  sales?: Sale[];
  staffCount?: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

function Icon({ name }: { name: "chart" | "cash" | "cube" | "logout" | "people" | "receipt" | "refresh" | "trend" | "warning" }) {
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
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g></svg>;
}

function money(value: number) { return `Rs ${Math.round(value).toLocaleString()}`; }

function MetricCard({ icon, label, tone, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; tone: string; value: string }) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <span className={styles.metricIcon}>
        <Icon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function SalesChart({ sales }: { sales: Sale[] }) {
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
    <div className={styles.panelHeading}><div><h2>Sales overview</h2><p>Last 7 days</p></div><span>Weekly</span></div>
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
  const { activeBusiness, workspaceMode, setWorkspaceMode } = useBusiness();
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
      const endpoint = user.role === "admin" ? "/dashboard" : "/dashboard/me";
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
    const timer = window.setTimeout(() => void fetchDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  if (isLoading || !user) return <main className={styles.loadingPage}><span className={styles.spinner} />Loading Almadel workspace…</main>;

  const products = data.products ?? [], sales = data.sales ?? [];
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const totalItems = sales.reduce((sum, sale) => sum + Number(sale.total_items || 0), 0);
  const stockValue = products.reduce((sum, product) => sum + Number(product.sellingPrice ?? product.selling_price ?? product.price ?? 0) * Number(product.stock ?? 0), 0);
  const lowStock = products.filter(product => Number(product.stock ?? 0) <= Number(product.lowStockThreshold ?? product.low_stock_threshold ?? 5)).length;
  const breakdown = data.productBreakdown ?? {};

  // Financial Workspace Metrics
  const cashInHand = Number(activeBusiness?.openingCashBalance || 0);
  const bankBalance = Number(activeBusiness?.openingBankBalance || 0);
  const customerReceivable = Number(activeBusiness?.customerReceivable || 0);
  const supplierPayable = Number(activeBusiness?.supplierPayable || 0);
  const totalLiquidCash = cashInHand + bankBalance;

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
            <span className={styles.eyebrow}>{user.role}</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700">
              {workspaceMode === "financial" ? "📊 Financial Workspace" : "🛒 POS Workspace"}
            </span>
          </div>
          <h1>Hello, {user.name}</h1>
          <p>
            {workspaceMode === "financial"
              ? "Comprehensive financial standing, accounts, receivables, and inventory valuation."
              : user.role === "admin"
              ? "Sales, stock value, products, and low stock signals in one place."
              : "Your private sales performance for this account."}
          </p>
        </div>
        <button className={styles.refresh} disabled={loading} onClick={() => void fetchDashboard()}>
          <Icon name="refresh" />{loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className={styles.error} role="alert"><span>{error}</span><button onClick={() => void fetchDashboard()}>Try again</button></div>}

      {/* METRIC GRID: Distinct based on role and workspaceMode */}
      {user.role === "admin" && workspaceMode === "financial" ? (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Cash in Hand</span>
            <p className="text-base font-black text-emerald-800">₨ {cashInHand.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Bank Accounts</span>
            <p className="text-base font-black text-blue-700">₨ {bankBalance.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Customer Khata</span>
            <p className="text-base font-black text-teal-700">₨ {customerReceivable.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Supplier Payables</span>
            <p className="text-base font-black text-amber-700">₨ {supplierPayable.toLocaleString()}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stock Value</span>
            <p className="text-base font-black text-slate-900">{money(stockValue)}</p>
          </article>
          <article className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Recorded Sales</span>
            <p className="text-base font-black text-[#00875a]">{money(totalSales)}</p>
          </article>
        </section>
      ) : (
        <section className={styles.metricGrid} aria-label="Dashboard metrics">
          {user.role === "admin" ? <>
            <MetricCard icon="cash" label="Total sales" tone="green" value={money(totalSales)} />
            <MetricCard icon="people" label="Staff" tone="blue" value={String(data.staffCount ?? 0)} />
            <MetricCard icon="cube" label="My products" tone="teal" value={String(breakdown.myProducts ?? 0)} />
            <MetricCard icon="warning" label="Low stock" tone="red" value={String(lowStock)} />
          </> : <>
            <MetricCard icon="cash" label="My sales" tone="green" value={money(totalSales)} />
            <MetricCard icon="receipt" label="My orders" tone="blue" value={String(sales.length)} />
            <MetricCard icon="cube" label="Items sold" tone="teal" value={String(totalItems)} />
            <MetricCard icon="trend" label="Average sale" tone="green" value={money(sales.length ? totalSales / sales.length : 0)} />
          </>}
        </section>
      )}

      <div className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          {user.role === "admin" ? (
            <section className={styles.valuePanel}>
              <div>
                <span>Inventory value</span>
                <strong>{money(stockValue)}</strong>
                <p>{totalItems} items sold from recorded sales. {breakdown.unassignedProducts ?? 0} older products have no owner yet.</p>
              </div>
              <span className={styles.valueIcon}><Icon name="cube" /></span>
            </section>
          ) : (
            <section className={styles.valuePanel}>
              <div>
                <span>Overall performance</span>
                <strong>{money(totalSales)}</strong>
                <p>Total sales completed from your own account.</p>
              </div>
              <span className={styles.valueIcon}><Icon name="trend" /></span>
            </section>
          )}
          <SalesChart sales={sales} />
        </div>

        <section className={`${styles.panel} ${styles.recent}`}>
          <div className={styles.panelHeading}>
            <div>
              <h2>{user.role === "admin" ? "Recent sales" : "My recent sales"}</h2>
              <p>Latest activity</p>
            </div>
          </div>
          <div className={styles.saleList}>
            {sales.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="receipt" />
                <p>No sales recorded yet.</p>
              </div>
            ) : (
              sales.slice(0, 6).map((sale) => (
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
