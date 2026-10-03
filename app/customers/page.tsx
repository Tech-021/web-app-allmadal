"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { useLanguage } from "@/app/components/language-context";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavRole } from "@/hooks/useNavRole";
import { api } from "@/app/lib/api";
import { validateEmail, validatePhone, validateText } from "@/app/lib/validators";
import { Icon } from "@/app/components/icons";
import { Meter, Money, formatRs } from "@/app/components/figures";
import { Sparkline } from "@/app/components/charts";
import { ReceivePaymentModal, type KhataCustomer } from "@/app/components/receive-payment-modal";
import { PosReceiptModal, type DetailedSaleReceipt } from "@/app/components/pos-receipt-modal";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";
import { Overlay } from "@/app/components/overlay";
import k from "./khata.module.css";

type Customer = KhataCustomer & {
  email?: string | null;
  openingBalance: number;
  totalSpent: number;
  visitCount: number;
  lastVisit?: string | null;
  createdAt: string;
};

type Payment = {
  id: number;
  amount: number | string;
  type: string;
  method: string;
  reference?: string | null;
  occurredAt: string;
  customerId?: number | null;
  customer?: { name: string; mobile: string } | null;
};

type Filter = "all" | "owes" | "quiet" | "clear";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
const daysSince = (iso: string | null | undefined, now: number) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000)) : null);
const waLink = (mobile: string, text: string) => {
  const digits = mobile.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
};

/** Every page of a finance list (capped) — payments are needed per customer for the ledger. */
async function fetchAllPayments(from: string, to: string) {
  const out: Payment[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await api<{ payments: Payment[]; total: number }>(`/finance/payments?from=${from}&to=${to}&limit=100&page=${page}`);
    out.push(...(r.payments || []));
    if (out.length >= (r.total || 0) || !(r.payments || []).length) break;
  }
  return out;
}

export default function CustomersPage() {
  const { activeBusiness } = useBusiness();
  const { showToast, confirmDialog } = useToast();
  const { t } = useLanguage();
  const navRole = useNavRole();
  const canDelete = navRole === "admin" || navRole === "accountant";
  const [now] = useState(() => Date.now());

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const [filter, setFilter] = useState<Filter>("all");
  const [summary, setSummary] = useState<{ receivable: number; count: number } | null>(null);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [receiveFor, setReceiveFor] = useState<Customer | null | "pick">(null);
  const [formFor, setFormFor] = useState<Customer | "new" | null>(null);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setFailed(false);
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    try {
      const search = debounced.trim() ? `&search=${encodeURIComponent(debounced.trim())}` : "";
      const [list, sum, pays] = await Promise.all([
        api<{ customers: Customer[]; total: number }>(`/customers?page=${page}&limit=${pageSize}${search}`),
        api<{ customers: { count: number; receivable: number } }>(`/finance/reports/summary?from=${ymd(today)}&to=${ymd(today)}`).catch(() => null),
        fetchAllPayments(ymd(monthStart), ymd(today)).catch(() => [] as Payment[]),
      ]);
      setCustomers(list.customers || []);
      setTotal(list.total || 0);
      setSummary(sum ? sum.customers : null);
      setMonthPayments(pays.filter((p) => p.type === "customer"));
    } catch (err) {
      setFailed(true);
      showToast(err instanceof Error ? err.message : "Could not load customers.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeBusiness, debounced, page, pageSize, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep links: ?customer=ID opens the ledger, ?receive=1 opens Receive payment, ?new=1 opens Add customer
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("customer"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setSelectedId(id);
    if (params.get("receive") === "1") setReceiveFor("pick");
    if (params.get("new") === "1") setFormFor("new");
    if (params.has("receive") || params.has("new")) {
      params.delete("receive");
      params.delete("new");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const selectCustomer = (id: number | null) => {
    setSelectedId(id);
    const url = id ? `${window.location.pathname}?customer=${id}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  };

  /* ---------- derived ---------- */

  const quiet = (c: Customer) => c.currentBalance > 0 && (daysSince(c.lastVisit, now) ?? 0) >= 30;
  const counts = {
    all: customers.length,
    owes: customers.filter((c) => c.currentBalance > 0).length,
    quiet: customers.filter(quiet).length,
    clear: customers.filter((c) => c.currentBalance <= 0).length,
  };
  const visible = useMemo(
    () =>
      customers
        .filter((c) => (filter === "owes" ? c.currentBalance > 0 : filter === "quiet" ? quiet(c) : filter === "clear" ? c.currentBalance <= 0 : true))
        .sort((a, b) => b.currentBalance - a.currentBalance),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, filter],
  );
  const receivable = summary?.receivable ?? customers.reduce((a, c) => a + Math.max(0, c.currentBalance), 0);
  const aging = customers.reduce(
    (acc, c) => {
      if (c.currentBalance <= 0) return acc;
      const d = daysSince(c.lastVisit, now) ?? 0;
      if (d > 60) acc.old += c.currentBalance;
      else if (d > 30) acc.mid += c.currentBalance;
      else acc.fresh += c.currentBalance;
      return acc;
    },
    { fresh: 0, mid: 0, old: 0 },
  );
  const collectedMonth = monthPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const collectedToday = monthPayments.filter((p) => new Date(p.occurredAt).toDateString() === new Date().toDateString()).reduce((a, p) => a + Number(p.amount || 0), 0);
  const quietTotal = customers.filter(quiet).reduce((a, c) => a + c.currentBalance, 0);
  const byDay = (() => {
    const d = new Date();
    const days = d.getDate();
    const sums = Array.from({ length: days }, () => 0);
    monthPayments.forEach((p) => {
      const day = new Date(p.occurredAt).getDate() - 1;
      if (day >= 0 && day < days) sums[day] += Number(p.amount || 0);
    });
    let run = 0;
    return sums.map((v) => (run += v));
  })();

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const remindText = (c: Customer) =>
    t("khata.remind_text", "Assalam-o-Alaikum {name}, aap ka {shop} par Rs {amount} baqaya hai. Shukriya.")
      .replace("{name}", c.name)
      .replace("{shop}", activeBusiness?.name || "hamari dukaan")
      .replace("{amount}", formatRs(c.currentBalance));

  const onReceived = (id: number, amount: number) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, currentBalance: Math.max(0, c.currentBalance - amount) } : c)));
    void load();
  };

  const removeCustomer = async (c: Customer) => {
    const ok = await confirmDialog({
      title: t("khata.delete_title", "Delete {name}?").replace("{name}", c.name),
      message: c.currentBalance > 0
        ? t("khata.delete_owes", "They still owe Rs {amount}. Deleting removes the customer and their khata balance.").replace("{amount}", formatRs(c.currentBalance))
        : t("khata.delete_body", "Their past bills stay in Sales. This can't be undone."),
      confirmLabel: t("action.delete", "Delete"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/customers/${c.id}`, { method: "DELETE" });
      showToast(t("khata.deleted", "{name} deleted").replace("{name}", c.name), "success");
      selectCustomer(null);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete customer.", "error");
    }
  };

  return (
    <WorkspaceShell>
      <PageHeader
        title={selected ? selected.name : t("khata.title", "Customers & khata")}
        actions={
          <>
            <button type="button" className={ui.secondary} onClick={() => setReceiveFor("pick")}>
              <Icon name="downright" size={15} />
              {t("receive.title", "Receive payment")}
            </button>
            <button type="button" className={ui.primary} onClick={() => setFormFor("new")}>
              <Icon name="user" size={15} />
              {t("khata.add", "Add customer")}
            </button>
          </>
        }
      />

      {selected ? (
        <CustomerDetail
          customer={selected}
          list={visible}
          onSelect={selectCustomer}
          onReceive={() => setReceiveFor(selected)}
          onEdit={() => setFormFor(selected)}
          onDelete={canDelete ? () => void removeCustomer(selected) : undefined}
          remindHref={waLink(selected.mobile, remindText(selected))}
          now={now}
        />
      ) : (
        <>
          <section className={k.band} aria-label={t("khata.summary", "Receivables summary")}>
            <div className={k.bandMain}>
              <span className={k.eyebrow}>{t("khata.to_collect", "To collect")}</span>
              <Money value={receivable} size="xl" className={k.bandFig} />
              <div
                className={k.aging}
                role="img"
                aria-label={`Rs ${formatRs(aging.fresh)} active in the last 30 days, Rs ${formatRs(aging.mid)} quiet 31 to 60 days, Rs ${formatRs(aging.old)} quiet over 60 days`}
              >
                {aging.fresh + aging.mid + aging.old === 0 ? (
                  <i style={{ flexGrow: 1, background: "var(--sunken)" }} />
                ) : (
                  <>
                    {aging.fresh > 0 && <i style={{ flexGrow: aging.fresh, background: "var(--border-strong)" }} />}
                    {aging.mid > 0 && <i style={{ flexGrow: aging.mid, background: "var(--warn)" }} />}
                    {aging.old > 0 && <i style={{ flexGrow: aging.old, background: "var(--neg)" }} />}
                  </>
                )}
              </div>
              <div className={k.agingLegend}>
                <span>
                  {t("khata.active_30", "Active ≤30d")} <b className={k.mono}>{formatRs(aging.fresh)}</b>
                </span>
                <span className={k.warn}>
                  31–60d <b className={k.mono}>{formatRs(aging.mid)}</b>
                </span>
                <span className={k.neg}>
                  60d+ <b className={k.mono}>{formatRs(aging.old)}</b>
                </span>
              </div>
            </div>
            <div className={k.bandCell}>
              <small>{t("khata.collected_month", "Collected this month")}</small>
              <span className={`${k.mono} ${k.bandNum} ${k.pos}`}>{formatRs(collectedMonth)}</span>
              <div className={k.spark}>
                <Sparkline values={byDay} height={34} ariaLabel={t("khata.collections_trend", "Collections this month")} />
              </div>
              <small>
                {monthPayments.length} {t("khata.payments", "payments")}
              </small>
            </div>
            <div className={k.bandCell}>
              <small>{t("khata.quiet_30", "No visit in 30+ days")}</small>
              <span className={`${k.mono} ${k.bandNum} ${k.neg}`}>{formatRs(quietTotal)}</span>
              <div className={k.cellList}>
                <span>
                  <b className={k.mono}>{counts.quiet}</b> {t("khata.customers", "customers")}
                </span>
                {(() => {
                  const oldest = customers.filter(quiet).sort((a, b) => (daysSince(b.lastVisit, now) ?? 0) - (daysSince(a.lastVisit, now) ?? 0))[0];
                  return oldest ? (
                    <span>
                      {t("khata.oldest", "Oldest")} · {oldest.name}, {daysSince(oldest.lastVisit, now)}d
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className={k.bandCell}>
              <small>{t("khata.collected_today", "Collected today")}</small>
              <span className={`${k.mono} ${k.bandNum}`}>{formatRs(collectedToday)}</span>
              <div className={k.cellList}>
                <span>
                  <b className={k.mono}>{counts.owes}</b> {t("khata.owe_you", "customers owe you")}
                </span>
                <span>
                  {summary?.count ?? total} {t("khata.on_books", "on your books")}
                </span>
              </div>
            </div>
          </section>

          <div className={k.toolbar}>
            <div className={ui.segmented} role="tablist" aria-label={t("khata.filter", "Filter")}>
              {(
                [
                  ["all", t("khata.all", "All"), counts.all],
                  ["owes", t("khata.owes", "Owes"), counts.owes],
                  ["quiet", t("khata.quiet", "Quiet 30d+"), counts.quiet],
                  ["clear", t("khata.clear", "Clear"), counts.clear],
                ] as const
              ).map(([id, label, n]) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? ui.segmentedOn : ""} onClick={() => setFilter(id)}>
                  <span className={id === "quiet" && n > 0 ? k.neg : undefined}>{label}</span>
                  <b className={k.count}>{n}</b>
                </button>
              ))}
            </div>
            <label className={k.search}>
              <Icon name="search" size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("khata.search", "Name or mobile")} aria-label={t("khata.search_label", "Search customers")} />
            </label>
          </div>

          <section className={`${ui.panel} ${ui.panelFlush}`}>
            <div className={ui.tableWrap}>
              <table className={`${ui.table} ${k.table}`}>
                <thead>
                  <tr>
                    <th>{t("khata.customer", "Customer")}</th>
                    <th style={{ width: 190 }}>{t("khata.status", "Status")}</th>
                    <th style={{ width: 230 }}>{t("khata.last_activity", "Last activity")}</th>
                    <th style={{ width: 140 }}>{t("khata.since_visit", "Since last visit")}</th>
                    <th className="text-right" style={{ width: 140 }}>
                      {t("khata.balance", "Balance")}
                    </th>
                    <th style={{ width: 190 }} aria-label={t("khata.actions", "Actions")} />
                  </tr>
                </thead>
                <tbody>
                  {loading && customers.length === 0 ? (
                    <TableSkeletonRows cols={6} rows={6} />
                  ) : failed ? (
                    <TableEmptyRow
                      colSpan={6}
                      icon="alert"
                      title={t("khata.load_failed", "Customers couldn't be loaded")}
                      body={t("khata.load_failed_body", "Check your connection and try again.")}
                      action={
                        <button type="button" className={ui.primary} onClick={() => void load()}>
                          <Icon name="refresh" size={15} />
                          {t("action.try_again", "Try again")}
                        </button>
                      }
                    />
                  ) : visible.length === 0 ? (
                    <TableEmptyRow
                      colSpan={6}
                      icon="users"
                      title={query ? t("khata.no_match", "No customer matches “{q}”").replace("{q}", query) : t("khata.empty", "No customers yet")}
                      body={query ? t("khata.no_match_body", "Try a different name or mobile number.") : t("khata.empty_body", "Add your first customer to start tracking khata.")}
                      action={
                        !query ? (
                          <button type="button" className={ui.primary} onClick={() => setFormFor("new")}>
                            {t("khata.add", "Add customer")}
                          </button>
                        ) : undefined
                      }
                    />
                  ) : (
                    visible.map((c) => {
                      const d = daysSince(c.lastVisit, now);
                      const tone = c.currentBalance <= 0 ? "clear" : (d ?? 0) >= 45 ? "neg" : (d ?? 0) >= 30 ? "warn" : "n";
                      return (
                        <tr key={c.id} className={k.row} onClick={() => selectCustomer(c.id)}>
                          <td>
                            <div className={k.cust}>
                              <span className={k.av}>{initials(c.name)}</span>
                              <div>
                                <button type="button" className={k.name} onClick={() => selectCustomer(c.id)}>
                                  {c.name}
                                </button>
                                <span className={k.mobile}>{c.mobile}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {tone === "clear" ? (
                              <span className={`${ui.chip} ${ui.chipPos}`}>
                                <Icon name="check" size={12} strokeWidth={2.4} />
                                {t("khata.clear", "Clear")}
                              </span>
                            ) : tone === "n" ? (
                              <span className={ui.chip}>{t("khata.current", "Current")}{d != null ? ` · ${d} ${t("khata.days", "days")}` : ""}</span>
                            ) : (
                              <span className={`${ui.chip} ${tone === "neg" ? ui.chipNeg : ui.chipWarn}`}>
                                <i className={k.dot} />
                                {t("khata.quiet_days", "No visit {d} days").replace("{d}", String(d))}
                              </span>
                            )}
                          </td>
                          <td>
                            {c.lastVisit
                              ? `${t("khata.visited", "Visited")} ${new Date(c.lastVisit).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                              : t("khata.no_visits", "No purchases yet")}
                            <span className={k.mobile}>
                              {c.visitCount} {t("khata.bills", "bills")} · Rs {formatRs(c.totalSpent)}
                            </span>
                          </td>
                          <td>
                            {c.currentBalance > 0 && d != null ? (
                              <Meter pct={Math.min(100, (d / 60) * 100)} color={tone === "neg" ? "var(--neg)" : tone === "warn" ? "var(--warn)" : "var(--faint)"} />
                            ) : (
                              <span className={k.faint}>—</span>
                            )}
                          </td>
                          <td className={`${k.balance} ${tone === "neg" ? k.neg : tone === "warn" ? k.warn : tone === "clear" ? k.faint : ""}`}>{formatRs(c.currentBalance)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className={k.acts}>
                              {c.currentBalance > 0 && (
                                <a className={`${ui.secondary} ${ui.btnSm}`} href={waLink(c.mobile, remindText(c))} target="_blank" rel="noreferrer">
                                  {t("khata.remind", "Remind")}
                                </a>
                              )}
                              {c.currentBalance > 0 ? (
                                <button type="button" className={`${ui.secondary} ${ui.btnSm}`} onClick={() => setReceiveFor(c)}>
                                  {t("receive.short", "Receive")}
                                </button>
                              ) : (
                                <button type="button" className={`${ui.secondary} ${ui.btnSm} ${k.ghost}`} onClick={() => window.dispatchEvent(new CustomEvent("almadel:open-new-sale"))}>
                                  {t("bar.new_sale", "New sale")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {total > pageSize && (
              <PaginationControls
                currentPage={page}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                pageSizeOptions={[25, 50, 100]}
                itemLabel="customers"
              />
            )}
          </section>
        </>
      )}

      <ReceivePaymentModal
        open={receiveFor !== null}
        customer={receiveFor && receiveFor !== "pick" ? receiveFor : null}
        customers={customers}
        onClose={() => setReceiveFor(null)}
        onReceived={onReceived}
      />
      <CustomerForm
        open={formFor !== null}
        customer={formFor && formFor !== "new" ? formFor : null}
        onClose={() => setFormFor(null)}
        onSaved={(c) => {
          void load();
          if (c) selectCustomer(c.id);
        }}
      />
    </WorkspaceShell>
  );
}

/* ================= Customer detail ================= */

function CustomerDetail({
  customer,
  list,
  onSelect,
  onReceive,
  onEdit,
  onDelete,
  remindHref,
  now,
}: {
  customer: Customer;
  list: Customer[];
  onSelect: (id: number | null) => void;
  onReceive: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  remindHref: string;
  now: number;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"ledger" | "bills">("ledger");
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [bills, setBills] = useState<DetailedSaleReceipt[] | null>(null);
  const [billsTotal, setBillsTotal] = useState(0);
  const [receipt, setReceipt] = useState<DetailedSaleReceipt | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayments(null);
    setBills(null);
    const created = new Date(customer.createdAt);
    void fetchAllPayments(ymd(created), ymd(new Date()))
      .then((all) => live && setPayments(all.filter((p) => p.type === "customer" && (p.customerId === customer.id || (!p.customerId && p.customer?.mobile === customer.mobile)))))
      .catch(() => live && setPayments([]));
    void api<{ sales: DetailedSaleReceipt[]; pagination?: { total?: number } }>(`/customers/${customer.id}/history?limit=100`)
      .then((r) => {
        if (!live) return;
        setBills(r.sales || []);
        setBillsTotal(r.pagination?.total ?? (r.sales || []).length);
      })
      .catch(() => live && setBills([]));
    return () => {
      live = false;
    };
  }, [customer.id, customer.createdAt, customer.mobile, customer.currentBalance]);

  // Running balance, newest first: each payment lowered the balance by its amount.
  const ledger = useMemo(() => {
    const rows = [...(payments ?? [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    let after = customer.currentBalance;
    return rows.map((p) => {
      const row = { ...p, after };
      after += Number(p.amount || 0);
      return row;
    });
  }, [payments, customer.currentBalance]);
  const balanceBefore = ledger.length ? ledger[ledger.length - 1].after + Number(ledger[ledger.length - 1].amount || 0) : customer.currentBalance;
  const paid90 = (payments ?? []).filter((p) => now - new Date(p.occurredAt).getTime() <= 90 * 86400000).reduce((a, p) => a + Number(p.amount || 0), 0);
  const series = [balanceBefore, ...[...ledger].reverse().map((r) => r.after)];
  const d = daysSince(customer.lastVisit, now);
  const filteredList = list.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.mobile.includes(search));

  return (
    <div className={k.detail}>
      <aside className={k.listCol} aria-label={t("khata.customers", "Customers")}>
        <div className={k.listHead}>
          <button type="button" className={ui.iconButton} onClick={() => onSelect(null)} aria-label={t("khata.back", "Back to all customers")}>
            <Icon name="left" size={16} />
          </button>
          <b>{t("khata.khata", "Khata")}</b>
          <span className={k.faint}>{list.length}</span>
        </div>
        <label className={k.search}>
          <Icon name="search" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("khata.search_short", "Search customers")} />
        </label>
        <div className={k.listItems}>
          {filteredList.map((c) => {
            const cd = daysSince(c.lastVisit, now) ?? 0;
            const tone = c.currentBalance <= 0 ? "" : cd >= 45 ? k.neg : cd >= 30 ? k.warn : "";
            return (
              <button key={c.id} type="button" className={`${k.listItem} ${c.id === customer.id ? k.listItemOn : ""}`} onClick={() => onSelect(c.id)} aria-current={c.id === customer.id}>
                <span className={`${k.av} ${c.id === customer.id ? k.avOn : ""}`}>{initials(c.name)}</span>
                <span className={k.listText}>
                  <b>{c.name}</b>
                  <small className={tone}>{c.currentBalance <= 0 ? t("khata.clear", "Clear") : cd >= 30 ? t("khata.quiet_days", "No visit {d} days").replace("{d}", String(cd)) : t("khata.current", "Current")}</small>
                </span>
                <span className={`${k.mono} ${tone}`}>{formatRs(c.currentBalance)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className={k.detailMain}>
        <header className={k.dHead}>
          <span className={`${k.av} ${k.avLg}`}>{initials(customer.name)}</span>
          <div className={k.dTitle}>
            <h2>{customer.name}</h2>
            <p>
              <span className={k.mono}>{customer.mobile}</span> · {t("khata.since", "customer since")}{" "}
              {new Date(customer.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {customer.visitCount} {t("khata.bills", "bills")}
            </p>
          </div>
          {customer.currentBalance > 0 && (
            <a className={ui.secondary} href={remindHref} target="_blank" rel="noreferrer">
              <Icon name="mail" size={15} />
              {t("khata.remind", "Remind")}
            </a>
          )}
          <button type="button" className={ui.secondary} onClick={onEdit}>
            <Icon name="edit" size={15} />
            {t("action.edit", "Edit")}
          </button>
          {customer.currentBalance > 0 && (
            <button type="button" className={ui.primary} onClick={onReceive}>
              <Icon name="downright" size={15} />
              {t("receive.title", "Receive payment")}
            </button>
          )}
        </header>

        <section className={k.dBand}>
          <div>
            <span className={k.eyebrow}>{customer.currentBalance > 0 ? t("khata.owes_you", "Owes you") : t("khata.balance", "Balance")}</span>
            <Money value={customer.currentBalance} size="lg" tone={customer.currentBalance > 0 ? "warn" : "pos"} className={k.dFig} />
            {customer.currentBalance > 0 && d != null && (
              <span className={`${ui.chip} ${d >= 45 ? ui.chipNeg : d >= 30 ? ui.chipWarn : ""}`}>
                {t("khata.last_visit", "Last visit")} · {d} {t("khata.days_ago", "days ago")}
              </span>
            )}
          </div>
          <div>
            <small>{t("khata.paid_90", "Paid in the last 90 days")}</small>
            <span className={`${k.mono} ${k.bandNum} ${k.pos}`}>{formatRs(paid90)}</span>
            <small>
              {(payments ?? []).length} {t("khata.payments", "payments")}
            </small>
          </div>
          <div>
            <small>{t("khata.purchases", "Purchases")}</small>
            <span className={`${k.mono} ${k.bandNum}`}>{formatRs(customer.totalSpent)}</span>
            <small>
              {billsTotal} {t("khata.bills", "bills")}
            </small>
          </div>
          <div className={k.dChart}>
            <small>{t("khata.balance_over_time", "Balance over time")}</small>
            {series.length > 1 ? (
              <Sparkline values={series} height={58} ariaLabel={t("khata.balance_over_time", "Balance over time")} />
            ) : (
              <span className={k.faint}>{t("khata.no_movement", "No payments recorded yet")}</span>
            )}
          </div>
        </section>

        <div className={ui.tabBar} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "ledger"} className={tab === "ledger" ? ui.tabBarOn : ""} onClick={() => setTab("ledger")}>
            {t("khata.ledger", "Ledger")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "bills"} className={tab === "bills" ? ui.tabBarOn : ""} onClick={() => setTab("bills")}>
            {t("khata.bills_tab", "Bills")} <b className={k.count}>{billsTotal}</b>
          </button>
        </div>

        {tab === "ledger" ? (
          <table className={`${ui.table} ${k.ledger}`}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t("khata.date", "Date")}</th>
                <th>{t("khata.entry", "Entry")}</th>
                <th className="text-right">{t("khata.paid", "Paid")}</th>
                <th className="text-right">{t("khata.balance", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {payments === null ? (
                <TableSkeletonRows cols={4} rows={4} />
              ) : (
                <>
                  {ledger.map((p) => (
                    <tr key={p.id}>
                      <td className={k.mono}>{new Date(p.occurredAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</td>
                      <td>
                        <span className={k.ink}>{t("khata.payment", "Payment")}</span> · <span className={k.cap}>{p.method}</span>
                        {p.reference ? <span className={`${k.mono} ${k.faint}`}> ref {p.reference}</span> : null}
                      </td>
                      <td className={`${k.num} ${k.pos}`}>{formatRs(Number(p.amount))}</td>
                      <td className={k.num}>{formatRs(p.after)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={k.mono}>{new Date(customer.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</td>
                    <td className={k.faint}>{t("khata.opening", "Opening balance")}</td>
                    <td className={k.num} />
                    <td className={k.num}>{formatRs(balanceBefore)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        ) : (
          <table className={`${ui.table} ${k.ledger}`}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>{t("sales.invoice", "Invoice")}</th>
                <th style={{ width: 150 }}>{t("khata.date", "Date")}</th>
                <th>{t("sales.items", "Items")}</th>
                <th style={{ width: 110 }}>{t("sales.payment", "Payment")}</th>
                <th className="text-right">{t("sales.amount", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {bills === null ? (
                <TableSkeletonRows cols={5} rows={4} />
              ) : bills.length === 0 ? (
                <TableEmptyRow colSpan={5} icon="invoice" title={t("khata.no_bills", "No bills for this customer yet")} />
              ) : (
                bills.map((b) => (
                  <tr key={String(b.id ?? b.invoiceNumber)} className={k.row} onClick={() => setReceipt(b)}>
                    <td className={`${k.mono} ${k.ink}`}>{b.invoiceNumber}</td>
                    <td className={k.mono}>{new Date(b.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                    <td>
                      {b.items.slice(0, 2).map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                      {b.items.length > 2 ? <span className={k.faint}> +{b.items.length - 2}</span> : null}
                    </td>
                    <td>
                      <span className={ui.chip}>{String(b.paymentMethod).toLowerCase() === "cash" ? t("payment.cash", "Cash") : t("payment.online", "Online")}</span>
                    </td>
                    <td className={k.num}>{formatRs(Number(b.totalAmount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {onDelete && (
          <div className={k.danger}>
            <button type="button" className={`${ui.secondary} ${ui.btnSm} ${k.dangerBtn}`} onClick={onDelete}>
              <Icon name="trash" size={14} />
              {t("khata.delete", "Delete customer")}
            </button>
          </div>
        )}
      </div>
      <PosReceiptModal isOpen={Boolean(receipt)} sale={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

/* ================= Add / edit customer ================= */

function CustomerForm({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer | null) => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(customer?.name ?? "");
    setMobile(customer?.mobile ?? "");
    setEmail(customer?.email ?? "");
    setErrors({});
  }, [open, customer]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const n = validateText(name, { minLength: 2, maxLength: 60, fieldName: "Customer name" });
    if (!n.valid) next.name = n.error || "Enter the customer's name.";
    const p = validatePhone(mobile, { required: true, fieldName: "Mobile number" });
    if (!p.valid) next.mobile = p.error || "Enter an 11-digit mobile number.";
    if (email) {
      const m = validateEmail(email, { required: false });
      if (!m.valid) next.email = m.error || "That email doesn't look right.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = JSON.stringify({ name: name.trim(), mobile: mobile.trim(), email: email.trim() || undefined });
      const res = customer
        ? await api<{ customer?: Customer }>(`/customers/${customer.id}`, { method: "PATCH", body })
        : await api<{ customer?: Customer }>("/customers", { method: "POST", body });
      showToast(customer ? t("khata.updated", "Customer updated") : t("khata.added", "Customer added"), "success");
      onSaved(res.customer ?? null);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Could not save the customer." });
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={ui.field}>
      <label htmlFor={`cf-${id}`}>{label}</label>
      <input
        id={`cf-${id}`}
        className={`${ui.input} ${errors[id] ? ui.invalid : ""}`}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setErrors((x) => ({ ...x, [id]: "" }));
        }}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `cf-${id}-err` : undefined}
        {...props}
      />
      {errors[id] && (
        <span id={`cf-${id}-err`} className={ui.fieldError}>
          <Icon name="alert" size={13} />
          {errors[id]}
        </span>
      )}
    </div>
  );

  return (
    <Overlay open={open} onClose={onClose} variant="drawer" dismissible={!busy} role="dialog" aria-modal="true" aria-labelledby="cf-title">
      <form className={ui.sheet} onSubmit={submit} noValidate style={{ width: "min(480px, 100%)" }}>
        <div className={ui.sheetHead}>
          <h2 id="cf-title">{customer ? t("khata.edit", "Edit customer") : t("khata.add", "Add customer")}</h2>
          <button type="button" className={ui.iconButton} onClick={onClose} aria-label={t("action.close", "Close")}>
            <Icon name="x" size={15} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {field("name", t("khata.f_name", "Name"), name, setName, { placeholder: "Bilal Ahmed", autoFocus: true })}
          {field("mobile", t("khata.f_mobile", "Mobile number"), mobile, setMobile, { placeholder: "03XX XXXXXXX", inputMode: "tel", className: `${ui.input} ${ui.inputMono} ${errors.mobile ? ui.invalid : ""}` })}
          {field("email", t("khata.f_email", "Email (optional)"), email, setEmail, { placeholder: "name@example.com", type: "email" })}
        </div>
        {errors.form && (
          <p className={ui.fieldError} role="alert" style={{ marginTop: 12 }}>
            {errors.form}
          </p>
        )}
        <div className={ui.formActions}>
          <button type="button" className={ui.secondary} onClick={onClose} disabled={busy}>
            {t("action.cancel", "Cancel")}
          </button>
          <button type="submit" className={ui.primary} disabled={busy} aria-busy={busy}>
            {busy ? t("khata.saving", "Saving…") : customer ? t("action.save", "Save changes") : t("khata.add", "Add customer")}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
