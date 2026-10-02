"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";
import { Icon } from "@/app/components/icons";
import { Skeleton } from "@/app/components/motion";
import { Metric, MetricStrip, PageHeader } from "@/app/components/page-layout";
import dc from "./daily-closing.module.css";

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

  const countedNum = counted.trim() === "" ? null : Number(counted);
  const previewDiff = !isClosed && countedNum != null && Number.isFinite(countedNum) && s.expectedCash != null ? countedNum - s.expectedCash : null;
  const shownDiff = diff ?? previewDiff;
  const diffTone = shownDiff == null ? undefined : shownDiff === 0 ? "pos" : shownDiff > 0 ? "warn" : "neg";
  const diffLabel =
    shownDiff == null
      ? language === "ur"
        ? "Galla count baqi hai"
        : "Pending drawer count"
      : shownDiff === 0
      ? language === "ur"
        ? "Bilkul barabar (Balanced)"
        : "Perfect match (balanced)"
      : shownDiff > 0
      ? language === "ur"
        ? "Galla mein izafi raqam (Excess)"
        : "Cash excess"
      : language === "ur"
      ? "Galla mein kami (Shortage)"
      : "Cash shortage";
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;

  return (
    <WorkspaceShell>
      <PageHeader
        eyebrow={language === "ur" ? "Hisab Kitab / Galla" : "Reconciliation"}
        title={t("closing.title")}
        description={
          language === "ur"
            ? "Dukaan ke galle mein mojood naqd raqam ko system sales ke sath match karein aur hisab band karein."
            : `Reconcile physical cash in the drawer against system sales for ${activeBusiness?.name || "Active Store"}.`
        }
        actions={
          <>
            <label className="relative flex items-center">
              <span className="sr-only">Closing date</span>
              <input className={`${ui.input} ${ui.inputDate}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button className={ui.secondary} onClick={() => void loadClosing()}>
              <Icon name="refresh" size={14} className={loading ? "[animation:almadelSpin_800ms_linear_infinite]" : ""} />
              {t("action.refresh")}
            </button>
          </>
        }
      />

      <MetricStrip>
        <Metric
          label={t("closing.total_sales_bills")}
          icon="receipt"
          value={loading ? <Skeleton className="h-6 w-10" /> : (s.bills ?? 0).toLocaleString()}
          hint={language === "ur" ? "Aaj mukammal kiye gaye bills" : "Orders completed on this day"}
        />
        <Metric
          label={t("closing.net_sales_value")}
          icon="pkr"
          tone="pos"
          value={loading ? <Skeleton className="h-6 w-24" /> : money(s.netSales || 0)}
          hint={language === "ur" ? "Choot (Discount) katne ke baad" : "After discounts"}
        />
        <Metric
          label={t("closing.expected_cash")}
          icon="wallet"
          value={loading ? <Skeleton className="h-6 w-24" /> : money(s.expectedCash || 0)}
          hint={language === "ur" ? "Ibtidayi galla + Aaj ki naqd bikri" : "Opening balance + cash sales"}
        />
        <Metric
          label={t("closing.reconciliation_diff")}
          icon={shownDiff === 0 ? "check" : "alert"}
          tone={diffTone}
          value={loading ? <Skeleton className="h-6 w-20" /> : shownDiff == null ? "—" : signed(shownDiff)}
          hint={diff == null && previewDiff != null ? `${diffLabel} · preview` : diffLabel}
        />
      </MetricStrip>

      <div className={dc.grid}>
        <form className={`${ui.panel} ${ui.panelFlush}`} onSubmit={handleCloseDay}>
          <div className={ui.panelHead}>
            <div className="flex items-start gap-3">
              <span className={ui.iconTile}>
                <Icon name={isClosed ? "check" : "lock"} size={15} />
              </span>
              <div>
                <h2>{isClosed ? t("closing.day_closed") : t("closing.close_cash_drawer")}</h2>
                <p>
                  {isClosed
                    ? language === "ur"
                      ? `Hisab band kia gaya ba-dast ${data?.closing?.closedBy?.fullName || "Malik"}`
                      : `Closed by ${data?.closing?.closedBy?.fullName || "Owner"}`
                    : language === "ur"
                    ? "Galla mein mojood tamam currency note aur sikkay gin kar kul raqam darj karein."
                    : "Count every banknote and coin in the drawer and enter the total."}
                </p>
              </div>
            </div>
            {isClosed && (
              <span className={`${ui.chip} ${ui.chipPos}`}>
                <Icon name="lock" size={11} />
                {language === "ur" ? "Band (Closed)" : "Closed"}
              </span>
            )}
          </div>

          <div className={ui.panelBody}>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label htmlFor="dc-counted">{t("closing.physical_cash")}</label>
                <div className={ui.prefixWrap}>
                  <span>Rs</span>
                  <input
                    id="dc-counted"
                    className={`${ui.input} ${ui.inputPrefixed} ${ui.inputMono}`}
                    type="number"
                    min="0"
                    required
                    disabled={isClosed}
                    placeholder="25000"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                  />
                </div>
              </div>

              <div className={ui.field}>
                <label htmlFor="dc-note">{t("closing.reconciliation_note")}</label>
                <input
                  id="dc-note"
                  className={ui.input}
                  disabled={isClosed}
                  placeholder={language === "ur" ? "e.g. Rs 50 grahak ko wapsi ki waja se kam hain" : "e.g. Rs 50 short — customer change"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          {!isClosed && (
            <div className={ui.sectionFooter}>
              <p className="flex items-center gap-1.5">
                <Icon name="shield" size={13} />
                {language === "ur"
                  ? "Rozana hisab band karne se audit trail aur munshi record mehfooz ho jata hai."
                  : "Closing the day creates an immutable audit trail."}
              </p>
              <button className={ui.primary} disabled={saving}>
                <Icon name="lock" size={14} />
                {saving ? t("closing.closing_btn") : t("closing.submit_btn")}
              </button>
            </div>
          )}
        </form>

        <aside className={`${ui.panel} ${ui.panelFlush}`} aria-label="Reconciliation ledger">
          <div className={ui.panelHead}>
            <div>
              <h2>Cash ledger</h2>
              <p className="font-mono">{date}</p>
            </div>
          </div>
          <dl className={`${ui.kv} ${ui.panelBody}`}>
            <div>
              <dt>Gross sales</dt>
              <dd>{loading ? "…" : money(s.grossSales || 0)}</dd>
            </div>
            <div>
              <dt>Discounts</dt>
              <dd className="text-[var(--muted)]">{loading ? "…" : `− ${money(s.discounts || 0)}`}</dd>
            </div>
            <div>
              <dt>Net sales</dt>
              <dd>{loading ? "…" : money(s.netSales || 0)}</dd>
            </div>
            <div>
              <dt>Opening cash</dt>
              <dd>{loading ? "…" : money(s.openingCash || 0)}</dd>
            </div>
            <div>
              <dt>Cash movement</dt>
              <dd>{loading ? "…" : signed(s.movement || 0)}</dd>
            </div>
            <div className={ui.kvTotal}>
              <dt>Expected in drawer</dt>
              <dd>{loading ? "…" : money(s.expectedCash || 0)}</dd>
            </div>
            <div>
              <dt>Counted</dt>
              <dd>{countedNum != null && Number.isFinite(countedNum) ? money(countedNum) : "—"}</dd>
            </div>
            <div>
              <dt>Difference</dt>
              <dd
                className={
                  diffTone === "pos" ? "text-[var(--pos)]" : diffTone === "warn" ? "text-[var(--warn)]" : diffTone === "neg" ? "text-[var(--neg)]" : ""
                }
              >
                {shownDiff == null ? "—" : signed(shownDiff)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
