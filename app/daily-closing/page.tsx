"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

interface ClosingSummary {
  bills?: number;
  grossSales?: number;
  discounts?: number;
  netSales?: number;
  openingCash?: number;
  movement?: number;
  expectedCash?: number;
  difference?: number | null;
}

interface ClosingData {
  date?: string;
  summary?: ClosingSummary;
  closing?: {
    status?: string;
    countedCash?: number;
    notes?: string;
    closedBy?: { fullName: string; email: string };
  } | null;
}

const money = (v: number = 0) => `Rs ${Math.round(v).toLocaleString()}`;

export default function DailyClosingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [data, setData] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();

  const loadClosing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<ClosingData>(`/finance/daily-closings?date=${date}`);
      setData(res);
      if (res?.closing?.countedCash != null) {
        setCounted(String(res.closing.countedCash));
        setNote(res.closing.notes || "");
      } else {
        setCounted("");
        setNote("");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load daily closing.", "error");
    } finally {
      setLoading(false);
    }
  }, [date, showToast, activeBusiness?.id]);

  useEffect(() => {
    void loadClosing();
  }, [loadClosing]);

  async function handleCloseDay(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/finance/daily-closings/close", {
        method: "POST",
        body: JSON.stringify({
          date,
          countedCash: Number(counted || 0),
          note,
        }),
      });
      showToast("Daily closing recorded successfully.", "success");
      logActivity(
        "DAILY_CLOSING_RECORD",
        "Finance",
        `Completed daily cash closing for ${date}: Counted Rs. ${Number(counted || 0).toLocaleString()}`,
        date,
        { date, countedCash: Number(counted || 0), note }
      );
      await loadClosing();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not close day.", "error");
    } finally {
      setSaving(false);
    }
  }

  const s = data?.summary || {};
  const isClosed = data?.closing?.status === "closed";
  const diff = s.difference;

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Financial Reconciliation</label>
          <h1>Daily Closing</h1>
          <p>
            Reconcile physical cash in drawer against system sales for{" "}
            <strong>{activeBusiness?.name || "Active Store"}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            className={ui.input}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 170 }}
          />
          <button className={ui.secondary} onClick={() => void loadClosing()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Total Sales Bills
          </span>
          <strong className="block mt-1 text-2xl font-black text-slate-900">
            {loading ? "…" : s.bills ?? 0}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">Orders completed today</span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Net Sales Value
          </span>
          <strong className="block mt-1 text-2xl font-black text-[#00875a]">
            {loading ? "…" : money(s.netSales || 0)}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">After discounts deducted</span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Expected Cash in Hand
          </span>
          <strong className="block mt-1 text-2xl font-black text-blue-700">
            {loading ? "…" : money(s.expectedCash || 0)}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">Opening balance + Cash sales</span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Reconciliation Difference
          </span>
          <strong
            className={`block mt-1 text-2xl font-black ${
              diff == null
                ? "text-slate-400"
                : diff === 0
                ? "text-emerald-600"
                : diff > 0
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {loading ? "…" : diff == null ? "—" : `${diff >= 0 ? "+" : ""}${money(diff)}`}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">
            {diff == null ? "Pending drawer count" : diff === 0 ? "Perfect match (Balanced)" : diff > 0 ? "Cash Excess" : "Cash Shortage"}
          </span>
        </article>
      </div>

      {/* Cash Drawer Counting Form */}
      <form className={`${ui.panel} max-w-3xl`} onSubmit={handleCloseDay}>
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isClosed ? "✅ Day Successfully Closed" : "🔒 Close Cash Drawer for This Day"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isClosed
                ? `Reconciliation closed by ${data?.closing?.closedBy?.fullName || "Owner"}`
                : "Count all physical banknotes and coins in your cash drawer and enter the total."}
            </p>
          </div>
          {isClosed && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              Closed
            </span>
          )}
        </div>

        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label>Physical Counted Cash (PKR)</label>
            <input
              className={ui.input}
              type="number"
              min="0"
              required
              disabled={isClosed}
              placeholder="e.g. 25000"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
          </div>

          <div className={ui.field}>
            <label>Reconciliation Note (Optional)</label>
            <input
              className={ui.input}
              disabled={isClosed}
              placeholder="e.g. Rs 50 shortage due to customer change"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {!isClosed && (
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Closing the day creates an immutable audit trail for accounting.
            </p>
            <button className={ui.primary} disabled={saving}>
              {saving ? "Closing Day..." : "Submit Daily Closing"}
            </button>
          </div>
        )}
      </form>
    </WorkspaceShell>
  );
}
