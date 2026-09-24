"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
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
  const { t, language } = useLanguage();

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
    const countVal = Number(counted);
    if (isNaN(countVal) || countVal < 0) {
      showToast("Please enter a valid non-negative counted cash amount.", "error");
      return;
    }

    setSaving(true);
    try {
      await api("/finance/daily-closings/close", {
        method: "POST",
        body: JSON.stringify({
          date,
          countedCash: countVal,
          note: note.trim(),
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
          <label>{language === "ur" ? "Hisab Kitab / Galla" : "Financial Reconciliation"}</label>
          <h1>{t("closing.title")}</h1>
          <p>
            {language === "ur"
              ? "Dukaan ke galle mein mojood naqd raqam ko system sales ke sath match karein aur hisab band karein."
              : `Reconcile physical cash in drawer against system sales for ${activeBusiness?.name || "Active Store"}.`}
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
            🔄 {t("action.refresh")}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {t("closing.total_sales_bills")}
          </span>
          <strong className="block mt-1 text-2xl font-black text-slate-900">
            {loading ? "…" : s.bills ?? 0}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">
            {language === "ur" ? "Aaj mukammal kiye gaye bills" : "Orders completed today"}
          </span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {t("closing.net_sales_value")}
          </span>
          <strong className="block mt-1 text-2xl font-black text-[#00875a]">
            {loading ? "…" : money(s.netSales || 0)}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">
            {language === "ur" ? "Choot (Discount) katne ke baad" : "After discounts deducted"}
          </span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {t("closing.expected_cash")}
          </span>
          <strong className="block mt-1 text-2xl font-black text-blue-700">
            {loading ? "…" : money(s.expectedCash || 0)}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">
            {language === "ur" ? "Ibtidayi galla + Aaj ki naqd bikri" : "Opening balance + Cash sales"}
          </span>
        </article>

        <article className="p-4.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            {t("closing.reconciliation_diff")}
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
            {diff == null
              ? (language === "ur" ? "Galla count baqi hai" : "Pending drawer count")
              : diff === 0
              ? (language === "ur" ? "Bilkul barabar (Balanced)" : "Perfect match (Balanced)")
              : diff > 0
              ? (language === "ur" ? "Galla mein izafi raqam (Excess)" : "Cash Excess")
              : (language === "ur" ? "Galla mein kami (Shortage)" : "Cash Shortage")}
          </span>
        </article>
      </div>

      {/* Cash Drawer Counting Form */}
      <form className={`${ui.panel} max-w-3xl`} onSubmit={handleCloseDay}>
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isClosed ? `✅ ${t("closing.day_closed")}` : `🔒 ${t("closing.close_cash_drawer")}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isClosed
                ? (language === "ur" ? `Hisab band kia gaya ba-dast ${data?.closing?.closedBy?.fullName || "Malik"}` : `Reconciliation closed by ${data?.closing?.closedBy?.fullName || "Owner"}`)
                : (language === "ur" ? "Galla mein mojood tamam currency note aur sikkay gin kar kul raqam darj karein." : "Count all physical banknotes and coins in your cash drawer and enter the total.")}
            </p>
          </div>
          {isClosed && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              {language === "ur" ? "Band (Closed)" : "Closed"}
            </span>
          )}
        </div>

        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label>{t("closing.physical_cash")}</label>
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
            <label>{t("closing.reconciliation_note")}</label>
            <input
              className={ui.input}
              disabled={isClosed}
              placeholder={language === "ur" ? "e.g. Rs 50 grahak ko wapsi ki waja se kam hain" : "e.g. Rs 50 shortage due to customer change"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {!isClosed && (
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              {language === "ur"
                ? "Rozana hisab band karne se audit trail aur munshi record mehfooz ho jata hai."
                : "Closing the day creates an immutable audit trail for accounting."}
            </p>
            <button className={ui.primary} disabled={saving}>
              {saving ? t("closing.closing_btn") : t("closing.submit_btn")}
            </button>
          </div>
        )}
      </form>
    </WorkspaceShell>
  );
}
