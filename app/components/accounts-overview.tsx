"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { useBusiness } from "@/app/components/business-context";
import { Icon, type IconName } from "@/app/components/icons";
import { formatRs } from "@/app/components/figures";
import { AnimatedNumber, Skeleton } from "@/app/components/motion";
import ui from "./workspace-ui.module.css";
import s from "./accounts-overview.module.css";

type Account = { id: number; name?: unknown; type?: unknown; balance?: unknown };

type LedgerTransaction = {
  id: number;
  accountId: number;
  type?: string;
  direction: "credit" | "debit";
  amount: number | string;
  reference?: string | null;
  note?: string | null;
  occurredAt: string;
  account?: { name: string } | null;
};

type ClosingSummary = { openingCash?: number; movement?: number; expectedCash?: number; cashAccountIds?: number[] };

type Kind = "cash" | "bank" | "wallet";
const kindOf = (type: unknown): Kind => {
  const t = String(type || "").toLowerCase();
  if (t.includes("cash")) return "cash";
  if (t.includes("bank")) return "bank";
  return "wallet";
};
const KIND_ICON: Record<Kind, IconName> = { cash: "wallet", bank: "bank", wallet: "phone" };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const entryLabel = (t: LedgerTransaction) => {
  const type = String(t.type || "").replace(/_/g, " ");
  const head = type ? type.charAt(0).toUpperCase() + type.slice(1) : t.direction === "credit" ? "Money in" : "Money out";
  return [head, t.reference || t.note].filter(Boolean).join(" · ");
};

/**
 * Cash & accounts board: balances strip, today's ledger, and the cash drawer waterfall.
 * Reads the accounts list the page already loaded plus today's ledger and closing summary.
 */
export function AccountsOverview({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const { activeBusiness } = useBusiness();
  const [txs, setTxs] = useState<LedgerTransaction[] | null>(null);
  const [txFailed, setTxFailed] = useState(false);
  const [closing, setClosing] = useState<ClosingSummary | null>(null);
  const [counted, setCounted] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const loadToday = useCallback(async () => {
    const today = ymd(new Date());
    setTxFailed(false);
    const [txRes, closingRes] = await Promise.allSettled([
      api<{ transactions: LedgerTransaction[] }>(`/finance/transactions?from=${today}&to=${today}&limit=100`),
      api<{ summary?: ClosingSummary; closing?: { status?: string } | null }>(`/finance/daily-closings?date=${today}`),
    ]);
    if (txRes.status === "fulfilled") setTxs(txRes.value.transactions || []);
    else {
      setTxs([]);
      setTxFailed(true);
    }
    if (closingRes.status === "fulfilled") {
      setClosing(closingRes.value.summary || null);
      setCounted(closingRes.value.closing?.status === "closed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.id]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const kindById = useMemo(() => new Map(accounts.map((a) => [a.id, kindOf(a.type)])), [accounts]);
  const totalAvailable = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const todayNetByAccount = useMemo(() => {
    const map = new Map<number, number>();
    (txs || []).forEach((t) => map.set(t.accountId, (map.get(t.accountId) || 0) + (t.direction === "credit" ? 1 : -1) * Number(t.amount || 0)));
    return map;
  }, [txs]);
  const todayNet = [...todayNetByAccount.values()].reduce((a, b) => a + b, 0);

  const shownTxs = (txs || []).filter((t) => filter === "all" || kindById.get(t.accountId) === filter);

  // Waterfall: opening → cash in → cash out → expected (cash accounts only).
  const waterfall = useMemo(() => {
    if (!closing) return null;
    const cashIds = new Set(closing.cashAccountIds || accounts.filter((a) => kindOf(a.type) === "cash").map((a) => a.id));
    let cashIn = 0;
    let cashOut = 0;
    (txs || []).forEach((t) => {
      if (!cashIds.has(t.accountId)) return;
      if (t.direction === "credit") cashIn += Number(t.amount || 0);
      else cashOut += Number(t.amount || 0);
    });
    const opening = Number(closing.openingCash || 0);
    const expected = Number(closing.expectedCash || 0);
    // If today's ledger page doesn't reconcile with the server's movement, show net movement instead.
    if (Math.round(cashIn - cashOut) !== Math.round(Number(closing.movement || 0))) {
      const m = Number(closing.movement || 0);
      cashIn = Math.max(0, m);
      cashOut = Math.max(0, -m);
    }
    return { opening, cashIn, cashOut, expected };
  }, [closing, txs, accounts]);

  const kinds: Array<["all" | Kind, string]> = [
    ["all", "All"],
    ["cash", "Cash"],
    ["bank", "Bank"],
    ["wallet", "Wallets"],
  ];

  return (
    <>
      <section className={s.balances} aria-label="Balances">
        <div className={s.total}>
          <span className={s.eyebrow}>Money available</span>
          {loading && !accounts.length ? (
            <Skeleton className="mt-2 h-9 w-44" />
          ) : (
            <span className={s.totalFigure}>
              <span className={s.cur}>Rs</span>
              <AnimatedNumber value={totalAvailable} format={(n) => formatRs(n)} />
            </span>
          )}
          <span className={s.sub}>
            across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            {txs && todayNet !== 0 ? (
              <>
                {" · "}
                <span className={todayNet > 0 ? s.pos : s.neg}>
                  {todayNet > 0 ? "+" : "−"} {formatRs(Math.abs(todayNet))} today
                </span>
              </>
            ) : null}
          </span>
        </div>
        {accounts.slice(0, 4).map((a) => {
          const kind = kindOf(a.type);
          const net = todayNetByAccount.get(a.id) || 0;
          return (
            <div key={a.id} className={s.acct}>
              <div className={s.acctHead}>
                <span className={`${s.acctIcon} ${s[`acct_${kind}`]}`} aria-hidden>
                  <Icon name={KIND_ICON[kind]} size={15} />
                </span>
                <b>{String(a.name ?? "Account")}</b>
              </div>
              <span className={s.acctFigure}>{formatRs(Number(a.balance || 0))}</span>
              <span className={s.sub}>
                {net ? (
                  <>
                    <span className="font-mono">
                      {net > 0 ? "+" : "−"} {formatRs(Math.abs(net))}
                    </span>{" "}
                    today
                  </>
                ) : (
                  <span className="capitalize">{String(a.type || kind)}</span>
                )}
              </span>
            </div>
          );
        })}
        {accounts.length > 4 && (
          <div className={`${s.acct} ${s.more}`}>
            <span className={s.sub}>+{accounts.length - 4} more</span>
            <span className={s.sub}>listed below</span>
          </div>
        )}
      </section>

      <div className={s.grid}>
        <section className={`${ui.panel} ${ui.panelFlush} ${s.txPanel}`} aria-labelledby="ao-tx">
          <div className={s.txHead}>
            <h2 id="ao-tx">Today&apos;s transactions</h2>
            <div className={ui.segmented} role="tablist" aria-label="Account type">
              {kinds.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? ui.segmentedOn : ""} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Time</th>
                  <th>Entry</th>
                  <th style={{ width: 150 }}>Account</th>
                  <th className="text-right" style={{ width: 110 }}>
                    In
                  </th>
                  <th className="text-right" style={{ width: 110 }}>
                    Out
                  </th>
                </tr>
              </thead>
              <tbody>
                {txs == null ? (
                  Array.from({ length: 5 }).map((_, r) => (
                    <tr key={r} aria-hidden style={{ opacity: 1 - r * 0.15 }}>
                      {[60, 70, 50, 40, 40].map((w, c) => (
                        <td key={c}>
                          <span className="al-skeleton block h-3" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : shownTxs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={ui.emptyCell}>
                      <div className={s.txEmpty} role="status">
                        <b>{txFailed ? "Today's ledger couldn't be loaded" : filter === "all" ? "No money has moved today" : "Nothing in these accounts today"}</b>
                        <span>
                          {txFailed
                            ? "Your balances above are still correct."
                            : "Sales, khata payments and expenses appear here as they happen."}
                        </span>
                        {txFailed && (
                          <button type="button" className={`${ui.secondary} ${ui.btnSm}`} onClick={() => void loadToday()}>
                            <Icon name="refresh" size={13} />
                            Try again
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  shownTxs.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono text-[12.5px] text-[var(--muted)]">
                        {new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="truncate" style={{ color: "var(--text)" }}>{entryLabel(t)}</td>
                      <td className="truncate">{t.account?.name || "—"}</td>
                      <td className="text-right font-mono" style={{ color: "var(--pos)" }}>{t.direction === "credit" ? formatRs(Number(t.amount)) : ""}</td>
                      <td className="text-right font-mono" style={{ color: "var(--neg)" }}>{t.direction === "debit" ? formatRs(Number(t.amount)) : ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${ui.panel} ${s.drawer}`} aria-labelledby="ao-drawer">
          <div className={s.drawerHead}>
            <h2 id="ao-drawer">Cash drawer today</h2>
            <span className={`${ui.chip} ${counted ? ui.chipPos : ""}`}>{counted ? "Counted" : "Not counted yet"}</span>
          </div>
          {waterfall ? (
            <>
              <p className={s.sub}>
                How Rs {formatRs(waterfall.opening)} this morning became Rs {formatRs(waterfall.expected)}.
              </p>
              <Waterfall {...waterfall} />
            </>
          ) : (
            <Skeleton className="mt-4 h-[200px] w-full" />
          )}
          <div className={s.countCta}>
            <span>{counted ? "Today is closed and its numbers are locked." : "Count the drawer to close today and lock these numbers."}</span>
            <Link href="/daily-closing" className={`${ui.secondary} ${ui.btnSm}`}>
              {counted ? "View closing" : "Count now"}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Waterfall({ opening, cashIn, cashOut, expected }: { opening: number; cashIn: number; cashOut: number; expected: number }) {
  const W = 380;
  const H = 190;
  const bw = 62;
  const gap = (W - bw * 4) / 3;
  const top = Math.max(opening, opening + cashIn, expected, 1);
  const Y = (v: number) => H - (Math.max(0, v) / top) * (H - 26);
  const levels = [opening, opening + cashIn, opening + cashIn - cashOut];
  const bars = [
    { label: "Opening", from: 0, to: opening, fill: "var(--faint)", opacity: 0.55, text: formatRs(opening), tone: "var(--text-2)" },
    { label: "Cash in", from: opening, to: opening + cashIn, fill: "var(--c-cash)", opacity: 1, text: `+${formatRs(cashIn)}`, tone: "var(--text-2)" },
    { label: "Cash out", from: opening + cashIn - cashOut, to: opening + cashIn, fill: "var(--neg)", opacity: 0.8, text: `−${formatRs(cashOut)}`, tone: "var(--neg)" },
    { label: "Expected", from: 0, to: expected, fill: "var(--text)", opacity: 1, text: formatRs(expected), tone: "var(--text)" },
  ];
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className={s.waterfall}
      role="img"
      aria-label={`Opening ${formatRs(opening)}, plus cash in ${formatRs(cashIn)}, minus cash out ${formatRs(cashOut)}, expected ${formatRs(expected)}`}
    >
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border-strong)" />
      {bars.map((b, i) => {
        const x = i * (bw + gap);
        const y = Y(b.to);
        const h = Math.max(2, Y(b.from) - Y(b.to));
        const next = bars[i + 1];
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={bw} height={h} rx={3} fill={b.fill} opacity={b.opacity} className={s.wfBar} style={{ animationDelay: `${i * 80}ms` }} />
            {next && <line x1={x + bw} x2={x + bw + gap} y1={Y(levels[i])} y2={Y(levels[i])} stroke="var(--border-strong)" strokeDasharray="2 3" />}
            <text x={x + bw / 2} y={Math.max(11, y - 6)} textAnchor="middle" className={s.wfValue} style={{ fill: b.tone, fontWeight: i === 3 ? 600 : 400 }}>
              {b.text}
            </text>
            <text x={x + bw / 2} y={H + 17} textAnchor="middle" className={s.wfLabel} style={{ fontWeight: i === 3 ? 600 : 400, fill: i === 3 ? "var(--text)" : undefined }}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
