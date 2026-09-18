"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import ui from "@/app/components/workspace-ui.module.css";

interface ReportSummary {
  sales: {
    count: number;
    total: number;
    discounts: number;
  };
  expenses: number;
  customers: {
    count: number;
    receivable: number;
  };
  suppliers: {
    count: number;
    payable: number;
  };
}

const money = (v: number = 0) => `Rs ${Math.round(v).toLocaleString()}`;

export default function ReportsPage() {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("month");

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let query = "";
      const now = new Date();

      if (timeRange === "today") {
        const todayStr = now.toISOString().slice(0, 10);
        query = `?from=${todayStr}&to=${todayStr}`;
      } else if (timeRange === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = `?from=${d.toISOString().slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`;
      } else if (timeRange === "month") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = `?from=${d.toISOString().slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`;
      }

      const res = await api<ReportSummary>(`/finance/reports/summary${query}`);
      setData(res);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load report.", "error");
    } finally {
      setLoading(false);
    }
  }, [timeRange, showToast, activeBusiness?.id]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const salesTotal = data?.sales?.total || 0;
  const expensesTotal = data?.expenses || 0;
  const netEstimatedMargin = salesTotal - expensesTotal;
  const customerReceivable = data?.customers?.receivable || 0;
  const supplierPayable = data?.suppliers?.payable || 0;
  const totalBills = data?.sales?.count || 0;
  const customerCount = data?.customers?.count || 0;
  const supplierCount = data?.suppliers?.count || 0;

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Business Intelligence</label>
          <h1>Reports &amp; Analytics</h1>
          <p>
            Financial summary and operational health for{" "}
            <strong>{activeBusiness?.name || "Active Store"}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "week", label: "7 Days" },
                { id: "month", label: "30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  timeRange === t.id
                    ? "bg-[#00875a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            className={ui.secondary}
            onClick={() => window.print()}
            title="Print report summary"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Main KPI Stat Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Sales */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-[#00875a]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Total Revenue / Sales
            </span>
            <span className="size-8 rounded-xl bg-emerald-50 text-[#00875a] grid place-items-center text-sm font-bold">
              🛒
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong className="block mt-2 text-2xl font-black text-[#00875a]">
              {money(salesTotal)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            {totalBills} completed transactions
          </span>
        </article>

        {/* Expenses */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-red-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Recorded Expenses
            </span>
            <span className="size-8 rounded-xl bg-red-50 text-red-600 grid place-items-center text-sm font-bold">
              💸
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong className="block mt-2 text-2xl font-black text-red-600">
              {money(expensesTotal)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            Store utility, rent, &amp; operational costs
          </span>
        </article>

        {/* Net Flow */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Net Operating Flow
            </span>
            <span className="size-8 rounded-xl bg-blue-50 text-blue-600 grid place-items-center text-sm font-bold">
              📊
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong
              className={`block mt-2 text-2xl font-black ${
                netEstimatedMargin >= 0 ? "text-blue-700" : "text-amber-600"
              }`}
            >
              {money(netEstimatedMargin)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            Gross Sales minus Total Expenses
          </span>
        </article>

        {/* Khata Receivables */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Customer Udhaar / Receivables
            </span>
            <span className="size-8 rounded-xl bg-teal-50 text-teal-700 grid place-items-center text-sm font-bold">
              👥
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong className="block mt-2 text-2xl font-black text-teal-700">
              {money(customerReceivable)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            {customerCount} customers registered in Khata
          </span>
        </article>

        {/* Supplier Payables */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Supplier Payables
            </span>
            <span className="size-8 rounded-xl bg-amber-50 text-amber-700 grid place-items-center text-sm font-bold">
              🏢
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong className="block mt-2 text-2xl font-black text-amber-700">
              {money(supplierPayable)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            {supplierCount} active suppliers
          </span>
        </article>

        {/* Discounts Given */}
        <article className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Discounts Awarded
            </span>
            <span className="size-8 rounded-xl bg-purple-50 text-purple-700 grid place-items-center text-sm font-bold">
              🏷️
            </span>
          </div>
          {loading ? (
            <div className="h-8 bg-slate-200/80 rounded-md w-32 mt-3 animate-pulse" />
          ) : (
            <strong className="block mt-2 text-2xl font-black text-purple-700">
              {money(data?.sales?.discounts || 0)}
            </strong>
          )}
          <span className="block mt-1 text-xs text-slate-500 font-semibold">
            Total customer savings provided
          </span>
        </article>
      </section>

      {/* Operational Summary Notice */}
      <div className="p-5 rounded-2xl bg-emerald-50/60 border border-[#c3e9d7] text-emerald-950 flex items-center justify-between">
        <div>
          <strong className="block text-sm font-extrabold">
            Automated Daily Ledger Accounting
          </strong>
          <p className="text-xs text-emerald-800 mt-0.5">
            All customer khata, supplier bills, cash drawers, and bank deposits are calculated from live transactions.
          </p>
        </div>
        <button
          onClick={() => void loadReport()}
          className="px-4 py-2 bg-[#00875a] text-white text-xs font-bold rounded-xl hover:bg-[#006b3f] transition"
        >
          Refresh Data
        </button>
      </div>
    </WorkspaceShell>
  );
}
