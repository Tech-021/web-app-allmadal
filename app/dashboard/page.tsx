"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { ReceiptModal, ReceiptSale } from "@/app/components/receipt-modal";
import { api } from "@/app/lib/api";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
import { PageHeader } from "@/app/components/page-layout";
import { Icon, type IconName } from "@/app/components/icons";
import { Skeleton } from "@/app/components/motion";
import { CompositionBar, LedgerRow, Meter, Money, formatRs } from "@/app/components/figures";
import { RunningChart, Sparkline } from "@/app/components/charts";
import { useNavRole } from "@/hooks/useNavRole";
import styles from "./dashboard.module.css";

/* ---------- API shapes (existing endpoints) ---------- */

type DashSale = {
  id: number | string;
  invoice_number?: string;
  payment_method?: string;
  customer_name?: string | null;
  total_amount?: number;
  total_items?: number;
  created_at?: string;
};

type TopSellingProduct = {
  productId: number;
  name: string;
  quantitySold: number;
  totalRevenue: number;
  currentStock: number;
  category: string;
};

type LowStockProduct = { id: number; name: string; stock: number; lowStockThreshold: number; category?: string };

type DashboardPayload = {
  sales?: DashSale[];
  todaySales?: number;
  todayBills?: number;
  topSellingProducts?: TopSellingProduct[];
  lowStockProducts?: LowStockProduct[];
};

type ReportSale = { id: number; invoiceNumber: string; totalAmount: number | string; totalItems: number; paymentMethod: string; customerName: string; createdAt: string };
type SalesReport = {
  summary: { totalRevenue: number; totalOrders: number; averageOrder: number; cashTotal: number; onlineTotal: number; totalDiscounts: number };
  breakdown: Array<{ date: string; dayName: string; displayDate: string; orders: number; totalAmount: number }>;
  sales: ReportSale[];
  pagination?: { totalPages?: number; page?: number };
};

type StockReport = {
  summary: { totalProducts: number; totalCostValue: number; totalRetailValue: number; lowStockCount: number; outOfStockCount: number; healthyCount: number };
  lowStock: Array<{ id: number; name: string; stock: number; lowStockThreshold: number }>;
  outOfStock: Array<{ id: number; name: string; stock: number; lowStockThreshold: number }>;
};

type ClosingPayload = {
  summary?: { openingCash?: number; cashMovement?: number; expectedCash?: number; netSales?: number; bills?: number };
  closing?: { status?: string; difference?: number | null } | null;
};

type FinanceSummary = { expenses: number; customers: { count: number; receivable: number } };
type CustomerRow = { id: number; name: string; mobile: string; currentBalance: number; lastVisit?: string | null };
type PaymentRow = { id: number; amount: number | string; type: string; method: string; occurredAt: string; customer?: { name: string } | null };

type Range = "today" | "week" | "month";

/* ---------- helpers ---------- */

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
const hourLong = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "");
const isCash = (m?: string) => String(m || "cash").toLowerCase() === "cash";
const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

/** Loads every page of a daily sales report (capped) so hourly totals are complete. */
async function fetchDayReport(date: string): Promise<SalesReport> {
  const first = await api<SalesReport>(`/reports/sales?period=daily&date=${date}&limit=100&page=1`);
  const pages = Math.min(first.pagination?.totalPages ?? 1, 10);
  if (pages <= 1) return first;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => api<SalesReport>(`/reports/sales?period=daily&date=${date}&limit=100&page=${i + 2}`)),
  );
  return { ...first, sales: [...first.sales, ...rest.flatMap((r) => r.sales)] };
}

/* ---------- small pieces ---------- */

function Panel({ title, aside, children, className = "", label }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <section className={`${styles.panel} ${className}`.trim()} aria-label={label}>
      <div className={styles.ph}>
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ActivityIcon({ kind }: { kind: "sale" | "pay" | "stock" }) {
  const map: Record<string, [string, string, IconName]> = {
    sale: ["var(--brand-soft)", "var(--brand)", "invoice"],
    pay: ["var(--info-soft)", "var(--info)", "downright"],
    stock: ["var(--warn-soft)", "var(--warn)", "layers"],
  };
  const [bg, fg, icon] = map[kind];
  return (
    <span className={styles.actIc} style={{ background: bg, color: fg }}>
      <Icon name={icon} size={14} />
    </span>
  );
}

/* ---------- page ---------- */

function DashboardContent() {
  const { user, isLoading, refreshUser } = useAuth();
  const { activeBusiness, workspaceMode, reloadBusinesses, switchBusiness } = useBusiness();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";
  const sessionId = searchParams.get("session_id");
  const navRole = useNavRole();
  const finance = navRole === "admin" || navRole === "accountant";
  const books = finance && workspaceMode === "financial";

  const [data, setData] = useState<DashboardPayload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("today");
  const [today, setToday] = useState<SalesReport | null>(null);
  const [lastWeekDay, setLastWeekDay] = useState<SalesReport | null>(null);
  const [week, setWeek] = useState<SalesReport | null>(null);
  const [month, setMonth] = useState<SalesReport | null>(null);
  const [priorTotals, setPriorTotals] = useState<Partial<Record<Range, number>>>({});
  const [stock, setStock] = useState<StockReport | null>(null);
  const [closing, setClosing] = useState<ClosingPayload | null>(null);
  const [yesterday, setYesterday] = useState<ClosingPayload | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [live, setLive] = useState<Array<{ id: string; title: string; meta: string; amount: number; at: string }>>([]);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptSale | null>(null);
  const [nowMs] = useState(() => Date.now());

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const todayStr = ymd(new Date());
    try {
      const base = api<DashboardPayload>(finance ? "/dashboard" : "/dashboard/me");
      if (!finance) {
        setData(await base);
        return;
      }
      const tasks: Array<Promise<unknown>> = [
        base.then(setData),
        fetchDayReport(todayStr).then(setToday),
        fetchDayReport(ymd(daysAgo(7))).then(setLastWeekDay),
        api<StockReport>("/reports/stock").then(setStock).catch(() => setStock(null)),
      ];
      if (workspaceMode === "financial") {
        tasks.push(
          api<ClosingPayload>(`/finance/daily-closings?date=${todayStr}`).then(setClosing).catch(() => setClosing(null)),
          api<ClosingPayload>(`/finance/daily-closings?date=${ymd(daysAgo(1))}`).then(setYesterday).catch(() => setYesterday(null)),
          api<FinanceSummary>(`/finance/reports/summary?from=${todayStr}&to=${todayStr}`).then(setSummary).catch(() => setSummary(null)),
          api<{ customers: CustomerRow[] }>("/customers?limit=100").then((r) => setCustomers(r.customers || [])).catch(() => setCustomers([])),
          api<{ payments: PaymentRow[] }>(`/finance/payments?from=${todayStr}&to=${todayStr}&limit=100`)
            .then((r) => setPayments(r.payments || []))
            .catch(() => setPayments([])),
        );
      }
      await Promise.all(tasks);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard data couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user, finance, workspaceMode, activeBusiness?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Longer ranges load on first use
  useEffect(() => {
    if (!finance || range === "today") return;
    const period = range === "week" ? "weekly" : "monthly";
    const days = range === "week" ? 7 : 30;
    if ((range === "week" && week) || (range === "month" && month)) return;
    void api<SalesReport>(`/reports/sales?period=${period}&limit=1`)
      .then((r) => (range === "week" ? setWeek(r) : setMonth(r)))
      .catch(() => undefined);
    void api<{ sales: { total: number } }>(`/finance/reports/summary?from=${ymd(daysAgo(days * 2 - 1))}&to=${ymd(daysAgo(days))}`)
      .then((r) => setPriorTotals((p) => ({ ...p, [range]: r.sales.total })))
      .catch(() => undefined);
  }, [range, finance, week, month]);

  // Stripe return: verify, then route into the right onboarding step
  useEffect(() => {
    if (!paymentSuccess || !sessionId) return;
    void (async () => {
      try {
        const result = await api<{ verified?: boolean; workspaceMode?: string; business?: { id: number; workspaceMode?: string } }>(
          "/billing/verify-session",
          { method: "POST", body: JSON.stringify({ sessionId }) },
        );
        if (!result.verified || !result.business?.id) return;
        await refreshUser();
        const list = await reloadBusinesses();
        switchBusiness(result.business.id);
        const mode = result.workspaceMode || result.business.workspaceMode || list.find((b) => b.id === result.business?.id)?.workspaceMode;
        router.replace(mode === "financial" ? `/setup-business/financial?businessId=${result.business.id}` : "/sales");
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
    if (paymentSuccess && sessionId) return; // verify-session must run before the pending redirect
    if (user.role === "pending" && !activeBusiness) router.replace("/setup-business");
  }, [isLoading, user, activeBusiness, paymentSuccess, sessionId, router]);

  useEffect(() => {
    if (user) void fetchDashboard();
  }, [fetchDashboard, user]);

  // Sales from the New Sale drawer, and live sales from other counters
  useEffect(() => {
    const onSale = () => void fetchDashboard();
    const onRealtime = (e: Event) => {
      const { event, payload } = (e as CustomEvent<{ event: string; payload: Record<string, unknown> }>).detail || {};
      if (event !== "sale.created" || !payload) return;
      setLive((prev) =>
        [
          {
            id: `rt-${String(payload.id ?? payload.invoiceNumber ?? Date.now())}`,
            title: `Sale ${String(payload.invoiceNumber ?? "")}`.trim(),
            meta: `${isCash(String(payload.paymentMethod)) ? "Cash" : "Online"} · ${String(payload.cashierName ?? "Staff")}`,
            amount: Number(payload.totalAmount || 0),
            at: String(payload.createdAt ?? new Date().toISOString()),
          },
          ...prev,
        ].slice(0, 5),
      );
      void fetchDashboard();
    };
    window.addEventListener("almadel:sale-completed", onSale);
    window.addEventListener("almadel_realtime_event", onRealtime);
    return () => {
      window.removeEventListener("almadel:sale-completed", onSale);
      window.removeEventListener("almadel_realtime_event", onRealtime);
    };
  }, [fetchDashboard]);

  /* ---------- derived figures ---------- */

  const sales = useMemo(() => data.sales ?? [], [data.sales]);
  const todayIso = new Date().toDateString();
  const staffTodaySales = sales.filter((s) => s.created_at && new Date(s.created_at).toDateString() === todayIso);

  const todayTotal = today?.summary.totalRevenue ?? data.todaySales ?? staffTodaySales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const todayOrders = today?.summary.totalOrders ?? data.todayBills ?? staffTodaySales.length;
  const cashToday = today?.summary.cashTotal ?? staffTodaySales.filter((s) => isCash(s.payment_method)).reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const onlineToday = today?.summary.onlineTotal ?? Math.max(0, todayTotal - cashToday);

  // Hourly running total for today vs the same weekday last week
  const hourly = useMemo(() => {
    const now = new Date();
    const bucket = (list: Array<{ createdAt: string; totalAmount: number | string }>) => {
      const m = new Map<number, number>();
      for (const s of list) {
        const h = new Date(s.createdAt).getHours();
        m.set(h, (m.get(h) || 0) + Number(s.totalAmount || 0));
      }
      return m;
    };
    const todayList: Array<{ createdAt: string; totalAmount: number | string }> = today
      ? today.sales
      : staffTodaySales.map((s) => ({ createdAt: s.created_at as string, totalAmount: Number(s.total_amount || 0) }));
    const cur = bucket(todayList);
    const prev = bucket(lastWeekDay?.sales ?? []);
    const hours = [...cur.keys(), ...prev.keys(), now.getHours()];
    const start = Math.min(9, ...hours);
    const end = Math.max(21, ...hours);
    const slots = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    let a = 0;
    let b = 0;
    const values: number[] = [];
    const steps: number[] = [];
    const comparison: number[] = [];
    slots.forEach((h) => {
      b += prev.get(h) || 0;
      comparison.push(b);
      if (h <= now.getHours()) {
        a += cur.get(h) || 0;
        values.push(a);
        steps.push(cur.get(h) || 0);
      }
    });
    const dayName = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    return {
      labels: slots.map(hourLabel),
      whens: slots.map((h) => `By ${hourLong(h)} · ${dayName}`),
      values,
      steps,
      comparison: lastWeekDay ? comparison : undefined,
      soFarLastWeek: lastWeekDay ? comparison[Math.min(values.length, comparison.length) - 1] ?? 0 : null,
    };
  }, [today, lastWeekDay, staffTodaySales]);

  const rangeReport = range === "week" ? week : range === "month" ? month : null;
  const series =
    range === "today"
      ? hourly
      : {
          labels: (rangeReport?.breakdown ?? []).map((d, i, arr) =>
            range === "week" ? d.dayName : i % 5 === 0 || i === arr.length - 1 ? d.displayDate : "",
          ),
          whens: (rangeReport?.breakdown ?? []).map((d) => `${d.dayName} ${d.displayDate}`),
          values: (rangeReport?.breakdown ?? []).map((d) => d.totalAmount),
          steps: undefined,
          comparison: undefined,
          soFarLastWeek: null,
        };

  const heroTotal = range === "today" ? todayTotal : rangeReport?.summary.totalRevenue ?? 0;
  const heroOrders = range === "today" ? todayOrders : rangeReport?.summary.totalOrders ?? 0;
  const heroCash = range === "today" ? cashToday : rangeReport?.summary.cashTotal ?? 0;
  const heroOnline = range === "today" ? onlineToday : rangeReport?.summary.onlineTotal ?? 0;
  const delta =
    range === "today"
      ? hourly.soFarLastWeek != null
        ? pct(todayTotal, hourly.soFarLastWeek)
        : null
      : priorTotals[range] != null
      ? pct(heroTotal, priorTotals[range] as number)
      : null;
  const weekdayName = daysAgo(7).toLocaleDateString(undefined, { weekday: "long" });
  const deltaLabel =
    range === "today"
      ? t("dashboard.vs_last_weekday", "vs last {day}").replace("{day}", weekdayName)
      : range === "week"
      ? t("dashboard.vs_prev_7", "vs previous 7 days")
      : t("dashboard.vs_prev_30", "vs previous 30 days");

  // Books
  const recoveredToday = payments.filter((p) => p.type === "customer").reduce((a, p) => a + Number(p.amount || 0), 0);
  const expensesToday = summary?.expenses ?? 0;
  const receivable = summary?.customers.receivable ?? customers.reduce((a, c) => a + Math.max(0, c.currentBalance), 0);
  const debtors = [...customers].filter((c) => c.currentBalance > 0).sort((a, b) => b.currentBalance - a.currentBalance);
  const sinceVisit = (iso?: string | null) => (iso ? Math.floor((nowMs - new Date(iso).getTime()) / 86400000) : null);

  // Inventory
  const lowList = stock
    ? [...stock.outOfStock, ...stock.lowStock]
    : (data.lowStockProducts ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, lowStockThreshold: p.lowStockThreshold }));
  const lowCount = stock ? stock.summary.lowStockCount : lowList.length;
  const outCount = stock?.summary.outOfStockCount ?? lowList.filter((p) => p.stock <= 0).length;

  // Attention strip
  const yDiff = yesterday?.closing?.status === "closed" ? Number(yesterday.closing.difference ?? 0) : 0;
  const oldest = debtors
    .map((c) => ({ c, d: sinceVisit(c.lastVisit) }))
    .filter((x) => x.d != null && (x.d as number) >= 30)
    .sort((a, b) => (b.d as number) - (a.d as number))[0];

  // Activity
  const activity = [
    ...live.map((x) => ({ ...x, kind: "sale" as const, fresh: true, sale: undefined as DashSale | undefined })),
    ...payments
      .filter((p) => p.type === "customer")
      .map((p) => ({
        id: `p-${p.id}`,
        kind: "pay" as const,
        title: t("dashboard.paid_khata", "{name} paid khata").replace("{name}", p.customer?.name || "Customer"),
        meta: p.method,
        amount: Number(p.amount || 0),
        at: p.occurredAt,
        fresh: false,
        sale: undefined as DashSale | undefined,
      })),
    ...sales.map((s) => ({
      id: `s-${s.id}`,
      kind: "sale" as const,
      title: `${t("dashboard.sale", "Sale")} ${s.invoice_number || `#${s.id}`} · ${s.total_items ?? 1} ${t("dashboard.items", "items")}`,
      meta: `${isCash(s.payment_method) ? "Cash" : "Online"}${s.customer_name ? ` · ${s.customer_name}` : ""}`,
      amount: Number(s.total_amount || 0),
      at: s.created_at || "",
      fresh: false,
      sale: s as DashSale | undefined,
    })),
  ]
    .filter((x, i, arr) => arr.findIndex((y) => y.title === x.title && y.amount === x.amount) === i)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  if (isLoading || !user) {
    return (
      <main className={styles.loadingPage}>
        <span className={styles.spinner} />
        Loading Almadel workspace…
      </main>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.good_morning", "Good morning") : hour < 17 ? t("dashboard.good_afternoon", "Good afternoon") : t("dashboard.good_evening", "Good evening");
  const firstName = (user.name || "").split(" ")[0];
  const firstSaleToday = (today?.sales ?? []).map((s) => new Date(s.createdAt).getTime()).sort((a, b) => a - b)[0];
  const subtitle = `${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${
    firstSaleToday ? ` · ${t("dashboard.first_sale_at", "first sale at")} ${timeOf(new Date(firstSaleToday).toISOString())}` : ""
  }`;
  const showSkeleton = loading && !data.sales;
  const avgBill = heroOrders > 0 ? heroTotal / heroOrders : 0;
  const rangeLabel =
    range === "today" ? t("dashboard.today_sales", "Today's sales") : range === "week" ? t("dashboard.sales_7d", "Sales · last 7 days") : t("dashboard.sales_30d", "Sales · last 30 days");
  const openSale = () => window.dispatchEvent(new CustomEvent("almadel:open-new-sale"));

  const alerts: Array<{ key: string; tone: "neg" | "warn"; icon: IconName; node: React.ReactNode; href: string }> = [];
  if (books && yDiff !== 0)
    alerts.push({
      key: "closing",
      tone: yDiff < 0 ? "neg" : "warn",
      icon: "alert",
      href: "/daily-closing",
      node: (
        <>
          {t("dashboard.yesterday_closed", "Yesterday closed")}{" "}
          <b className={`${styles.mono} ${yDiff < 0 ? styles.neg : styles.warn}`}>Rs {formatRs(Math.abs(yDiff))}</b>{" "}
          {yDiff < 0 ? t("dashboard.short", "short") : t("dashboard.over", "over")}
        </>
      ),
    });
  if (lowCount + outCount > 0)
    alerts.push({
      key: "stock",
      tone: "warn",
      icon: "layers",
      href: "/stock",
      node: (
        <>
          <b className={styles.mono}>{lowCount + outCount}</b> {t("dashboard.products_low", "products low on stock")}
        </>
      ),
    });
  if (books && oldest)
    alerts.push({
      key: "debtor",
      tone: "warn",
      icon: "clock",
      href: "/customers",
      node: (
        <>
          {oldest.c.name} · {t("dashboard.no_visit", "no visit in")} <b className={styles.mono}>{oldest.d} {t("dashboard.days", "days")}</b>
        </>
      ),
    });

  return (
    <WorkspaceShell>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={subtitle} />

      {paymentSuccess && (
        <div className={styles.successBanner} role="status">
          <Icon name="check" size={16} strokeWidth={2.2} />
          <span>
            <b>Payment successful — subscription activated.</b> All POS and Financial features are on.
          </span>
          <button onClick={() => router.replace("/dashboard")} className={styles.linkBtn}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className={styles.errorPanel} role="alert">
          <span className={styles.errorIc}>
            <Icon name="chart" size={18} />
          </span>
          <div>
            <b>{t("dashboard.load_failed", "Sales data couldn't be loaded")}</b>
            <p>{t("dashboard.load_failed_body", "The server didn't answer in time. Your sales are safe — this only affects this view.")}</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => void fetchDashboard()}>
            <Icon name="refresh" size={15} />
            {t("action.try_again", "Try again")}
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className={`${styles.alerts} ${styles.rise}`}>
          <span className={styles.eyebrow}>{t("dashboard.needs_attention", "Needs attention")}</span>
          {alerts.map((a) => (
            <Link key={a.key} href={a.href} className={styles.alert}>
              <span className={a.tone === "neg" ? styles.neg : styles.warn}>
                <Icon name={a.icon} size={14} />
              </span>
              <span>{a.node}</span>
            </Link>
          ))}
        </div>
      )}

      <div className={`${styles.layout} ${finance ? "" : styles.layoutStaff}`}>
        <div className={styles.mainCol}>
          {/* ================= Hero: today's money ================= */}
          <section className={`${styles.panel} ${styles.hero} ${styles.rise}`} aria-labelledby="hero-label">
            <div className={styles.heroHead}>
              <div>
                <div className={styles.heroLabel}>
                  <span id="hero-label" className={styles.eyebrow}>
                    {rangeLabel}
                  </span>
                  <span className={styles.liveDot} aria-hidden />
                </div>
                {showSkeleton ? (
                  <Skeleton className={styles.heroSkeleton} />
                ) : (
                  <Money value={heroTotal} size="xl" animate className={styles.heroFigure} />
                )}
                <div className={styles.heroMeta}>
                  {delta != null && (
                    <span className={`${styles.badge} ${delta >= 0 ? styles.badgePos : styles.badgeNeg}`}>
                      <Icon name={delta >= 0 ? "upright" : "downright"} size={12} strokeWidth={2.2} />
                      {Math.abs(delta).toFixed(1)}%
                    </span>
                  )}
                  {delta != null && <span>{deltaLabel}</span>}
                  {delta != null && <span className={styles.sep}>|</span>}
                  <span>
                    <b className={styles.mono}>{heroOrders}</b> {t("dashboard.orders", "orders")} · {t("dashboard.avg_bill", "avg bill")}{" "}
                    <b className={styles.mono}>Rs {formatRs(avgBill)}</b>
                  </span>
                </div>
              </div>
              {finance && (
                <div className={styles.seg} role="tablist" aria-label={t("dashboard.range", "Range")}>
                  {(["today", "week", "month"] as Range[]).map((r) => (
                    <button key={r} role="tab" aria-selected={range === r} className={range === r ? styles.segOn : ""} onClick={() => setRange(r)}>
                      {r === "today" ? t("dashboard.today", "Today") : r === "week" ? "7D" : "30D"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.comp}>
              <CompositionBar
                segments={[
                  { label: t("payment.cash", "Cash"), value: heroCash, color: "var(--c-cash)" },
                  { label: t("payment.online", "Online"), value: heroOnline, color: "var(--c-online)" },
                ]}
              />
            </div>

            <div className={styles.chartDesktop}>
              <RunningChart
                labels={series.labels}
                whens={series.whens}
                values={series.values}
                steps={series.steps}
                stepSuffix={t("dashboard.this_hour", "this hour")}
                comparison={series.comparison}
                comparisonLabel={range === "today" ? `${t("dashboard.last", "Last")} ${daysAgo(7).toLocaleDateString(undefined, { weekday: "short" })}` : ""}
                ariaLabel={`${rangeLabel}: Rs ${formatRs(heroTotal)}`}
                animationKey={range}
              />
              <div className={styles.legend}>
                <span>
                  <i className={styles.legendLine} />
                  {range === "today" ? t("dashboard.running_total", "Today, running total") : t("dashboard.daily_sales", "Daily sales")}
                </span>
                {range === "today" && series.comparison && (
                  <span>
                    <svg width="14" height="2" aria-hidden>
                      <line x1="0" x2="14" y1="1" y2="1" stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="3 4" />
                    </svg>
                    {t("dashboard.last", "Last")} {weekdayName}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.chartMobile}>
              <Sparkline values={hourly.values} comparison={hourly.comparison} ariaLabel={rangeLabel} />
            </div>
          </section>

          {/* Mobile quick actions */}
          <nav className={styles.quick} aria-label={t("bar.quick_actions", "Quick actions")}>
            {(navRole === "admin" || navRole === "staff") && (
              <button type="button" onClick={openSale} className={styles.quickSale}>
                <span>
                  <Icon name="plus" size={22} strokeWidth={2.2} />
                </span>
                {t("bar.new_sale", "New sale")}
              </button>
            )}
            {books && (
              <Link href="/customers?receive=1">
                <span>
                  <Icon name="downright" size={21} />
                </span>
                {t("dashboard.receive", "Receive")}
              </Link>
            )}
            {books && (
              <Link href="/expenses?new=1">
                <span>
                  <Icon name="upright" size={21} />
                </span>
                {t("dashboard.expense", "Expense")}
              </Link>
            )}
            {books && (
              <Link href="/daily-closing">
                <span>
                  <Icon name="lock" size={21} />
                </span>
                {t("bar.close_day", "Close day")}
              </Link>
            )}
          </nav>

          <div className={styles.pair}>
            {books ? (
              <Panel
                title={t("dashboard.khata_receivables", "Khata · receivables")}
                label="Khata receivables"
                className={styles.rise2}
                aside={
                  <Link href="/customers" className={styles.ghostLink}>
                    {t("dashboard.open_khata", "Open khata")}
                    <Icon name="right" size={13} />
                  </Link>
                }
              >
                <div className={styles.bigRow}>
                  <Money value={receivable} size="lg" />
                  <span className={styles.sub}>
                    {t("dashboard.to_collect", "to collect")} · {summary?.customers.count ?? debtors.length} {t("dashboard.customers", "customers")}
                  </span>
                </div>
                <div className={styles.triple}>
                  <div>
                    <small>{t("dashboard.recovered_today", "Recovered today")}</small>
                    <span className={`${styles.mono} ${styles.pos}`}>{formatRs(recoveredToday)}</span>
                  </div>
                  <div>
                    <small>{t("dashboard.owing", "Customers owing")}</small>
                    <span className={styles.mono}>{debtors.length}</span>
                  </div>
                  <div>
                    <small>{t("dashboard.largest", "Largest balance")}</small>
                    <span className={`${styles.mono} ${styles.warn}`}>{formatRs(debtors[0]?.currentBalance ?? 0)}</span>
                  </div>
                </div>
                <div>
                  {debtors.slice(0, 3).map((c) => {
                    const d = sinceVisit(c.lastVisit);
                    return (
                      <Link key={c.id} href={`/customers?customer=${c.id}`} className={styles.row}>
                        <span className={styles.avSm}>{c.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
                        <span className={styles.rowName}>{c.name}</span>
                        {d != null && (
                          <span className={`${styles.badge} ${d >= 45 ? styles.badgeNeg : d >= 30 ? styles.badgeWarn : styles.badgeN}`}>{d}d</span>
                        )}
                        <span className={`${styles.mono} ${styles.rowAmt}`}>{formatRs(c.currentBalance)}</span>
                      </Link>
                    );
                  })}
                  {debtors.length === 0 && !loading && <p className={styles.quiet}>{t("dashboard.no_khata", "Nobody owes you right now.")}</p>}
                </div>
              </Panel>
            ) : (
              <Panel title={t("dashboard.top_selling_products", "Top sellers")} label="Top sellers" className={styles.rise2} aside={<span className={styles.sub}>{t("dashboard.by_revenue", "by revenue")}</span>}>
                {(data.topSellingProducts ?? []).length === 0 ? (
                  <p className={styles.quiet}>{t("dashboard.no_top", "Completed sales will rank products here.")}</p>
                ) : (
                  (data.topSellingProducts ?? []).slice(0, 5).map((p, i, arr) => (
                    <div key={p.productId || i} className={styles.rankRow}>
                      <span className={`${styles.mono} ${styles.rank}`}>{i + 1}</span>
                      <span className={styles.rowName}>{p.name}</span>
                      <Meter pct={(p.totalRevenue / Math.max(1, arr[0].totalRevenue)) * 100} color="var(--brand)" />
                      <span className={`${styles.mono} ${styles.rowAmt}`}>{formatRs(p.totalRevenue)}</span>
                    </div>
                  ))
                )}
              </Panel>
            )}

            <Panel
              title={t("dashboard.inventory_health", "Inventory health")}
              label="Inventory health"
              className={styles.rise3}
              aside={stock ? <span className={styles.sub}>{stock.summary.totalProducts} SKUs</span> : null}
            >
              {stock && (
                <>
                  <div className={styles.bigRow}>
                    <Money value={stock.summary.totalCostValue} size="lg" />
                    <span className={styles.sub}>{t("dashboard.stock_value_cost", "stock value at cost")}</span>
                  </div>
                  <div className={styles.healthBar} role="img" aria-label={`${stock.summary.healthyCount} healthy, ${stock.summary.lowStockCount} low, ${stock.summary.outOfStockCount} out of stock`}>
                    <i style={{ flexGrow: stock.summary.healthyCount, background: "var(--brand)", opacity: 0.55 }} />
                    {stock.summary.lowStockCount > 0 && <i style={{ flexGrow: stock.summary.lowStockCount, minWidth: 10, background: "var(--warn)" }} />}
                    {stock.summary.outOfStockCount > 0 && <i style={{ flexGrow: stock.summary.outOfStockCount, minWidth: 6, background: "var(--neg)" }} />}
                  </div>
                  <div className={styles.healthLegend}>
                    <span>
                      <b className={styles.mono}>{stock.summary.healthyCount}</b> {t("dashboard.healthy", "healthy")}
                    </span>
                    <span className={styles.warn}>
                      <b className={styles.mono}>{stock.summary.lowStockCount}</b> {t("dashboard.low", "low")}
                    </span>
                    <span className={styles.neg}>
                      <b className={styles.mono}>{stock.summary.outOfStockCount}</b> {t("dashboard.out", "out")}
                    </span>
                  </div>
                </>
              )}
              <div className={styles.lowList}>
                {lowList.slice(0, 3).map((p) => {
                  const ratio = (p.stock / Math.max(1, p.lowStockThreshold)) * 100;
                  const tone = p.stock <= 0 || ratio <= 20 ? "var(--neg)" : "var(--warn)";
                  return (
                    <Link key={p.id} href={`/products?search=${encodeURIComponent(p.name)}`} className={styles.lowRow}>
                      <span className={styles.rowName}>{p.name}</span>
                      <Meter pct={ratio} color={tone} />
                      <span className={styles.mono}>
                        <span style={{ color: tone }}>{p.stock}</span>
                        <span className={styles.faint}> / {p.lowStockThreshold}</span>
                      </span>
                    </Link>
                  );
                })}
                {lowList.length === 0 && !loading && <p className={styles.quiet}>{t("dashboard.all_healthy_stock", "Every product is above its reorder level.")}</p>}
              </div>
            </Panel>
          </div>
        </div>

        {/* ================= Right rail ================= */}
        <aside className={styles.rail}>
          {finance && (
            <Panel
              title={books ? t("dashboard.cash_position", "Cash position · today") : t("dashboard.payments_today", "Payments · today")}
              label="Cash position"
              className={styles.rise1}
              aside={
                books ? (
                  <span className={`${styles.badge} ${closing?.closing?.status === "closed" ? styles.badgePos : styles.badgeN}`}>
                    {closing?.closing?.status === "closed" ? t("dashboard.day_closed", "Day closed") : t("dashboard.day_open", "Day open")}
                  </span>
                ) : null
              }
            >
              <div className={styles.ledgerWrap}>
                <LedgerRow label={t("dashboard.cash_sales", "Cash sales")} value={cashToday} swatch="var(--c-cash)" />
                <LedgerRow label={t("dashboard.online_received", "Online received")} value={onlineToday} swatch="var(--c-online)" />
                {books ? (
                  <>
                    <LedgerRow label={t("dashboard.khata_recovered", "Khata recovered")} value={recoveredToday} swatch="var(--c-udhaar)" />
                    <LedgerRow label={t("dashboard.expenses", "Expenses")} value={expensesToday} tone="neg" sign="−" double />
                    <LedgerRow label={t("dashboard.net_cash", "Net cash today")} value={cashToday + onlineToday + recoveredToday - expensesToday} strong />
                  </>
                ) : (
                  <>
                    <LedgerRow label={t("dashboard.discounts", "Discounts given")} value={today?.summary.totalDiscounts ?? 0} tone="neg" sign="−" double />
                    <LedgerRow label={t("dashboard.net_sales", "Net sales")} value={todayTotal} strong />
                  </>
                )}
              </div>
              {books && (
                <div className={styles.drawer}>
                  <div>
                    <small>{t("dashboard.expected_drawer", "Expected in drawer")}</small>
                    <Money value={closing?.summary?.expectedCash ?? 0} size="sm" />
                  </div>
                  <Link href="/daily-closing" className={styles.smallBtn}>
                    {t("bar.close_day", "Close day")}
                  </Link>
                </div>
              )}
            </Panel>
          )}

          <Panel
            title={
              <span className={styles.titleLive}>
                {t("dashboard.activity", "Activity")} <span className={styles.liveDot} aria-hidden />
              </span>
            }
            label="Live activity"
            className={`${styles.activity} ${styles.rise4}`}
            aside={
              <Link href="/sales" className={styles.ghostLink}>
                {t("dashboard.all", "All")}
              </Link>
            }
          >
            <div role="log" aria-live="polite">
              {activity.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={`${styles.act} ${a.fresh ? styles.arrive : ""}`}
                  onClick={() =>
                    a.sale
                      ? setActiveReceipt({
                          id: String(a.sale.id),
                          total: Number(a.sale.total_amount || 0),
                          itemsCount: Number(a.sale.total_items || 1),
                          createdByName: user.name,
                          createdAt: a.sale.created_at || new Date().toISOString(),
                        })
                      : undefined
                  }
                >
                  <ActivityIcon kind={a.kind} />
                  <span className={styles.actText}>
                    <span>{a.title}</span>
                    <small>{a.meta}</small>
                  </span>
                  <span className={styles.actRight}>
                    <span className={`${styles.mono} ${a.kind === "pay" ? styles.pos : ""}`}>+ {formatRs(a.amount)}</span>
                    <small className={styles.mono}>{timeOf(a.at)}</small>
                  </span>
                </button>
              ))}
              {activity.length === 0 && !loading && (
                <div className={styles.emptyAct}>
                  <span>
                    <Icon name="invoice" size={18} />
                  </span>
                  <b>{t("dashboard.no_sales_today", "No sales recorded today.")}</b>
                  {(navRole === "admin" || navRole === "staff") && (
                    <button type="button" className={styles.primaryBtn} onClick={openSale}>
                      <Icon name="plus" size={15} strokeWidth={2.2} />
                      {t("bar.new_sale", "New sale")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      <ReceiptModal sale={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </WorkspaceShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.loadingPage}>
          <span className={styles.spinner} />
          Loading Almadel workspace…
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
