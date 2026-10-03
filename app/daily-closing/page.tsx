"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";
import { Icon } from "@/app/components/icons";
import { PageHeader } from "@/app/components/page-layout";
import { AnimatedNumber, Skeleton } from "@/app/components/motion";
import { formatRs } from "@/app/components/figures";
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

/** Pakistani notes and coins, largest first. The count is a calculator only: the backend stores the total. */
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 1] as const;
type Counts = Record<(typeof DENOMINATIONS)[number], number>;
const EMPTY_COUNTS: Counts = { 5000: 0, 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0, 1: 0 };

export default function DailyClosingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [data, setData] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"notes" | "total">("notes");
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const { t, language } = useLanguage();
  const ur = (en: string, urdu: string) => (language === "ur" ? urdu : en);

  const loadClosing = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api<ClosingData>(`/finance/daily-closings?date=${date}`);
      setData(res);
      setCounts(EMPTY_COUNTS);
      if (res?.closing?.countedCash != null) {
        setCounted(String(res.closing.countedCash));
        setNote(res.closing.notes || "");
      } else {
        setCounted("");
        setNote("");
      }
    } catch (e) {
      setFailed(true);
      showToast(e instanceof Error ? e.message : "Could not load daily closing.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, showToast, activeBusiness?.id]);

  useEffect(() => {
    void loadClosing();
  }, [loadClosing]);

  const noteTotal = useMemo(() => DENOMINATIONS.reduce((sum, d) => sum + d * counts[d], 0), [counts]);
  const anyNotes = DENOMINATIONS.some((d) => counts[d] > 0);

  const applyCounts = (next: Counts) => {
    setCounts(next);
    setCounted(String(DENOMINATIONS.reduce((sum, k) => sum + k * next[k], 0)));
  };
  const bump = (d: (typeof DENOMINATIONS)[number], delta: number) => applyCounts({ ...counts, [d]: Math.max(0, counts[d] + delta) });
  const setCount = (d: (typeof DENOMINATIONS)[number], raw: string) => applyCounts({ ...counts, [d]: Math.max(0, Math.floor(Number(raw) || 0)) });

  async function handleCloseDay(e: FormEvent) {
    e.preventDefault();
    const countVal = Number(counted);
    if (counted.trim() === "" || isNaN(countVal) || countVal < 0) {
      showToast("Count the drawer first", "warning", { description: "Enter the cash you counted, or tap + on each note." });
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
      showToast("Day closed", "success", { description: `${dateLabel} · counted Rs ${formatRs(countVal)}` });
      logActivity(
        "DAILY_CLOSING_RECORD",
        "Finance",
        `Completed daily cash closing for ${date}: Counted Rs. ${Number(counted || 0).toLocaleString()}`,
        date,
        { date, countedCash: Number(counted || 0), note }
      );
      await loadClosing();
    } catch (e) {
      showToast("Day couldn't be closed", "error", {
        description: e instanceof Error ? e.message : "Nothing was saved. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const s = data?.summary || {};
  const isClosed = data?.closing?.status === "closed";
  const countedNum = counted.trim() === "" ? null : Number(counted);
  const hasCount = countedNum != null && Number.isFinite(countedNum);
  const diff = isClosed ? s.difference ?? null : hasCount && s.expectedCash != null ? (countedNum as number) - s.expectedCash : null;
  const state: "pending" | "balanced" | "short" | "over" = diff == null ? "pending" : diff === 0 ? "balanced" : diff < 0 ? "short" : "over";

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(language === "ur" ? "en-PK" : undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const diffCopy = {
    pending: { label: ur("Not counted", "Ginti baqi"), help: ur("Count the drawer to see the difference.", "Farq dekhne ke liye galla ginein.") },
    balanced: { label: ur("Balanced", "Barabar"), help: ur("Drawer matches the books exactly.", "Galla hisab ke bilkul barabar hai.") },
    short: { label: ur("Short", "Kami"), help: ur("Less cash than the books expect. Recount, or explain below.", "Hisab se kam naqd hai. Dobara ginein ya neeche wazahat likhein.") },
    over: { label: ur("Over", "Izafi"), help: ur("More cash than expected. Check for an unrecorded sale.", "Tawaqqo se zyada naqd hai. Koi bill darj karna reh to nahi gaya?") },
  }[state];

  const closeLabel =
    state === "balanced"
      ? ur("Close day · balanced", "Hisab band karein · barabar")
      : state === "pending"
      ? ur("Close day", "Hisab band karein")
      : `${ur("Close day", "Hisab band karein")} · Rs ${formatRs(Math.abs(diff ?? 0))} ${state === "short" ? ur("short", "kam") : ur("over", "zyada")}`;

  return (
    <WorkspaceShell>
      <PageHeader
        title={t("closing.title", "Daily closing")}
        subtitle={dateLabel}
        actions={
          <>
            <label className="relative flex items-center">
              <span className="sr-only">Closing date</span>
              <input className={`${ui.input} ${ui.inputDate}`} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button type="button" className={ui.secondary} onClick={() => void loadClosing()} disabled={loading}>
              <Icon name="refresh" size={14} className={loading ? "[animation:almadelSpin_800ms_linear_infinite]" : ""} />
              {t("action.refresh", "Refresh")}
            </button>
          </>
        }
      />

      {failed && !data ? (
        <section className={dc.errorPanel} role="alert">
          <span className={dc.errorIcon} aria-hidden>
            <Icon name="lock" size={19} />
          </span>
          <div>
            <h2>{ur("This day couldn't be loaded", "Yeh din load nahi ho saka")}</h2>
            <p>{ur("The server didn't answer. Your sales and earlier closings are safe — this only affects this view.", "Server ne jawab nahi diya. Aap ka data mehfooz hai.")}</p>
            <button type="button" className={ui.primary} onClick={() => void loadClosing()}>
              <Icon name="refresh" size={15} />
              {t("action.try_again", "Try again")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className={dc.recon} aria-label="Reconciliation">
            <div className={dc.reconCell}>
              <span className={dc.reconLabel}>{ur("Expected in drawer", "Galle mein hona chahiye")}</span>
              {loading ? (
                <Skeleton className="mt-2 h-10 w-44" />
              ) : (
                <span className={dc.reconFigure}>
                  <span className={dc.cur}>Rs</span>
                  <AnimatedNumber value={s.expectedCash || 0} format={(n) => formatRs(n)} />
                </span>
              )}
              <span className={dc.reconHelp}>
                {ur("Opening", "Ibtidayi")} {formatRs(s.openingCash || 0)} {(s.movement || 0) >= 0 ? "+" : "−"} {ur("cash movement", "naqd lain dain")} {formatRs(Math.abs(s.movement || 0))}
              </span>
            </div>
            <div className={dc.reconCell}>
              <span className={dc.reconLabel}>{ur("Counted", "Gina gaya")}</span>
              <span className={dc.reconFigure}>
                <span className={dc.cur}>Rs</span>
                {hasCount ? formatRs(countedNum as number) : <span className={dc.placeholder}>—</span>}
              </span>
              <span className={dc.reconHelp}>
                {isClosed
                  ? `${ur("Closed by", "Band kiya")} ${data?.closing?.closedBy?.fullName || ur("Owner", "Malik")}`
                  : mode === "notes"
                  ? ur("From the note count below", "Neeche note ginti se")
                  : ur("Entered as a total", "Kul raqam darj ki gayi")}
              </span>
            </div>
            <div className={`${dc.reconCell} ${dc.diffCell}`} data-state={state} role="status" aria-live="polite">
              <span className={dc.reconLabel}>
                {ur("Difference", "Farq")}
                <span className={dc.badge}>{diffCopy.label}</span>
              </span>
              <span className={`${dc.reconFigure} ${dc.diffFigure}`}>
                {diff == null ? <span className={dc.placeholder}>—</span> : diff === 0 ? "0" : `${diff < 0 ? "−" : "+"} ${formatRs(Math.abs(diff))}`}
              </span>
              <span className={dc.reconHelp}>{diffCopy.help}</span>
            </div>
          </section>

          <form className={dc.grid} onSubmit={handleCloseDay}>
            <section className={dc.panel} aria-labelledby="dc-count-title">
              <div className={dc.panelHead}>
                <h2 id="dc-count-title">{ur("Count the drawer", "Galla ginein")}</h2>
                {!isClosed && (
                  <div className={ui.segmented} role="tablist" aria-label="Counting method">
                    <button type="button" role="tab" aria-selected={mode === "notes"} className={mode === "notes" ? ui.segmentedOn : ""} onClick={() => setMode("notes")}>
                      {ur("By note", "Note se")}
                    </button>
                    <button type="button" role="tab" aria-selected={mode === "total"} className={mode === "total" ? ui.segmentedOn : ""} onClick={() => setMode("total")}>
                      {ur("Total", "Kul")}
                    </button>
                  </div>
                )}
              </div>

              {isClosed ? (
                <div className={dc.closedNote}>
                  <span className={dc.closedIcon} aria-hidden>
                    <Icon name="lock" size={16} />
                  </span>
                  <div>
                    <b>{t("closing.day_closed", "Day closed")}</b>
                    <p>
                      {ur("Counted", "Gina gaya")} Rs {formatRs(countedNum || 0)}
                      {data?.closing?.notes ? ` · “${data.closing.notes}”` : ""}
                    </p>
                  </div>
                </div>
              ) : mode === "notes" ? (
                <>
                  <div className={dc.denList}>
                    {DENOMINATIONS.map((d) => (
                      <div key={d} className={dc.den}>
                        <span className={`${dc.note} ${d >= 1000 ? dc.noteBig : ""}`}>{d === 1 ? ur("Coins", "Sikkay") : formatRs(d)}</span>
                        <div className={dc.stepper} role="group" aria-label={d === 1 ? "Rupees in coins" : `Rs ${d} notes`}>
                          <button type="button" onClick={() => bump(d, -1)} disabled={counts[d] === 0} aria-label="One less">
                            <Icon name="minus" size={14} />
                          </button>
                          <input
                            inputMode="numeric"
                            value={counts[d] || ""}
                            placeholder="0"
                            onChange={(e) => setCount(d, e.target.value)}
                            aria-label={d === 1 ? "Rupees in coins" : `Number of Rs ${d} notes`}
                          />
                          <button type="button" onClick={() => bump(d, 1)} aria-label="One more">
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                        <span className={`${dc.denSum} ${counts[d] ? "" : dc.denSumEmpty}`}>{counts[d] ? formatRs(d * counts[d]) : "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className={dc.denTotal}>
                    <span>{ur("Total counted", "Kul ginti")}</span>
                    <span>Rs {formatRs(anyNotes ? noteTotal : countedNum || 0)}</span>
                  </div>
                </>
              ) : (
                <div className={dc.totalEntry}>
                  <label htmlFor="dc-counted">{t("closing.physical_cash", "Cash counted")}</label>
                  <div className={ui.prefixWrap}>
                    <span>Rs</span>
                    <input
                      id="dc-counted"
                      className={`${ui.input} ${ui.inputPrefixed} ${ui.inputMono}`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="0"
                      value={counted}
                      onChange={(e) => {
                        setCounts(EMPTY_COUNTS);
                        setCounted(e.target.value);
                      }}
                      aria-describedby="dc-counted-help"
                    />
                  </div>
                  <p id="dc-counted-help">{ur("Every note and coin in the drawer, added up.", "Galle ke tamam note aur sikkay jama kar ke.")}</p>
                </div>
              )}
            </section>

            <div className={dc.side}>
              <section className={dc.panel} aria-labelledby="dc-day-title">
                <div className={dc.panelHead}>
                  <h2 id="dc-day-title">{ur("Day in numbers", "Din ka hisab")}</h2>
                  <span className={dc.muted}>{(s.bills ?? 0).toLocaleString("en-IN")} {ur("bills", "bills")}</span>
                </div>
                <div className={dc.lines}>
                  {loading ? (
                    [0, 1, 2, 3].map((i) => <Skeleton key={i} className="my-3 h-4" style={{ width: `${88 - i * 10}%` }} />)
                  ) : (
                    <>
                      <div className={dc.line}>
                        <span>{ur("Gross sales", "Kul bikri")}</span>
                        <span>{formatRs(s.grossSales || 0)}</span>
                      </div>
                      <div className={dc.line}>
                        <span className={dc.indent}>{ur("Discounts", "Riayat")}</span>
                        <span className={dc.neg}>{s.discounts ? `− ${formatRs(s.discounts)}` : "0"}</span>
                      </div>
                      <div className={`${dc.line} ${dc.lineStrong}`}>
                        <span>{ur("Net sales", "Net bikri")}</span>
                        <span>{formatRs(s.netSales || 0)}</span>
                      </div>
                      <div className={dc.line}>
                        <span>{ur("Opening cash", "Ibtidayi galla")}</span>
                        <span>{formatRs(s.openingCash || 0)}</span>
                      </div>
                      <div className={dc.line}>
                        <span>{ur("Cash movement", "Naqd lain dain")}</span>
                        <span className={(s.movement || 0) < 0 ? dc.neg : dc.pos}>
                          {(s.movement || 0) < 0 ? "− " : "+ "}
                          {formatRs(Math.abs(s.movement || 0))}
                        </span>
                      </div>
                      <div className={`${dc.line} ${dc.lineTotal}`}>
                        <span>{ur("Expected in drawer", "Galle mein hona chahiye")}</span>
                        <span>Rs {formatRs(s.expectedCash || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className={`${dc.panel} ${dc.closePanel}`}>
                <label htmlFor="dc-note" className={dc.noteLabel}>
                  {ur("Note for this closing", "Is closing ka note")}
                  <span>{state === "short" || state === "over" ? ur("Recommended when the count differs", "Farq ho to zaroor likhein") : ur("Optional", "Ikhtiyari")}</span>
                </label>
                <textarea
                  id="dc-note"
                  className={dc.textarea}
                  disabled={isClosed}
                  placeholder={ur("e.g. Gave Rs 450 change from pocket to a customer", "e.g. Rs 50 grahak ko wapsi ki waja se kam hain")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {isClosed ? (
                  <div className={dc.closedBar}>
                    <Icon name="check" size={16} strokeWidth={2} />
                    {t("closing.day_closed", "Day closed")}
                  </div>
                ) : (
                  <button type="submit" className={`${ui.primary} ${ui.btnLg} ${dc.closeBtn}`} disabled={saving || loading || !hasCount}>
                    {saving ? <span className={dc.spin} aria-hidden /> : <Icon name="lock" size={16} />}
                    {saving ? t("closing.closing_btn", "Closing day…") : closeLabel}
                  </button>
                )}
                {!isClosed && (
                  <p className={dc.fine}>
                    <Icon name="shield" size={13} />
                    {ur("Closing the day locks this count into the audit trail.", "Hisab band karne se yeh ginti audit record mein mehfooz ho jati hai.")}
                  </p>
                )}
              </section>
            </div>
          </form>
        </>
      )}
    </WorkspaceShell>
  );
}
