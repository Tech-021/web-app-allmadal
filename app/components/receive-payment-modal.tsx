"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useLanguage } from "@/app/components/language-context";
import { formatRs } from "@/app/components/figures";
import { parseCurrencyInput } from "@/app/lib/validators";
import { Icon } from "@/app/components/icons";
import { Overlay } from "@/app/components/overlay";
import ui from "@/app/components/workspace-ui.module.css";
import m from "./receive-payment-modal.module.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

export type KhataCustomer = { id: number; name: string; mobile: string; currentBalance: number };
type Account = { id: number; name: string; type: string; isActive?: boolean };

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "jazzcash", label: "JazzCash" },
  { id: "easypaisa", label: "Easypaisa" },
  { id: "bank", label: "Bank" },
] as const;

/**
 * Records a khata payment (POST /finance/payments, type "customer").
 * The backend lowers the customer's balance and posts the ledger entry to the chosen account.
 */
export function ReceivePaymentModal({
  open,
  customer,
  customers = [],
  onClose,
  onReceived,
}: {
  open: boolean;
  customer?: KhataCustomer | null;
  /** used when no customer is preselected */
  customers?: KhataCustomer[];
  onClose: () => void;
  onReceived?: (customerId: number, amount: number) => void;
}) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [pickedId, setPickedId] = useState<number | null>(customer?.id ?? null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("cash");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idemRef = useRef<string>("");
  const amountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPickedId(customer?.id ?? null);
    setAmount("");
    setMethod("cash");
    setReference("");
    setError("");
    idemRef.current = `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    void api<{ accounts: Account[] }>("/finance/accounts")
      .then((r) => setAccounts((r.accounts || []).filter((a) => a.isActive !== false)))
      .catch(() => setAccounts([]));
    const id = window.setTimeout(() => amountRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open, customer?.id]);

  // Pick the account that matches the method (cash → cash drawer; others → wallet/bank by name or type)
  useEffect(() => {
    if (!accounts.length) return;
    const byType = (type: string) => accounts.find((a) => a.type === type);
    const byName = (needle: string) => accounts.find((a) => a.name.toLowerCase().includes(needle));
    const match =
      method === "cash"
        ? byType("cash")
        : method === "bank"
        ? byType("bank")
        : byName(method) ?? byType("wallet") ?? byType("bank");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountId((match ?? accounts[0]).id);
  }, [method, accounts]);

  const target = useMemo(() => customer ?? customers.find((c) => c.id === pickedId) ?? null, [customer, customers, pickedId]);
  const value = Number(parseCurrencyInput(amount)) || 0;
  const balance = Number(target?.currentBalance || 0);
  const after = Math.max(0, balance - value);
  const tooMuch = value > balance;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!target) return setError(t("receive.pick_customer", "Choose who is paying."));
    if (value <= 0) return setError(t("receive.enter_amount", "Enter the amount received."));
    if (tooMuch) return setError(t("receive.too_much", "That's more than {name} owes (Rs {bal}).").replace("{name}", target.name).replace("{bal}", formatRs(balance)));
    if (!accountId) return setError(t("receive.no_account", "Add a cash or bank account in Cash / Accounts first."));
    setBusy(true);
    setError("");
    try {
      await api("/finance/payments", {
        method: "POST",
        body: JSON.stringify({
          type: "customer",
          partyId: target.id,
          accountId,
          amount: value,
          method,
          reference: reference.trim() || undefined,
          idempotencyKey: idemRef.current,
        }),
      });
      showToast(
        t("receive.done", "Payment received · {name} now owes Rs {after}").replace("{name}", target.name).replace("{after}", formatRs(after)),
        "success",
      );
      onReceived?.(target.id, value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("receive.failed", "The payment couldn't be recorded. Nothing changed."));
    } finally {
      setBusy(false);
    }
  };

  const owing = customers.filter((c) => c.currentBalance > 0);

  return (
    <Overlay open={open} onClose={onClose} dismissible={!busy} role="dialog" aria-modal="true" aria-labelledby="rcv-title">
      <form className={`${ui.sheet} ${m.sheet}`} onSubmit={submit} noValidate>
        <div className={ui.sheetHead}>
          <div className={m.headMain}>
            <span className={m.headIc}>
              <Icon name="downright" size={17} />
            </span>
            <h2 id="rcv-title">{t("receive.title", "Receive payment")}</h2>
          </div>
          <button type="button" className={ui.iconButton} onClick={onClose} disabled={busy} aria-label={t("action.close", "Close")}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {customer ? (
          <div className={m.who}>
            <span className={m.av}>{customer.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
            <span className={m.whoText}>
              <b>{customer.name}</b>
              <small className={m.mono}>{customer.mobile}</small>
            </span>
            <span className={m.owes}>
              {t("receive.owes", "Owes")} <b className={m.mono}>Rs {formatRs(balance)}</b>
            </span>
          </div>
        ) : (
          <div className={ui.field}>
            <label htmlFor="rcv-cust">{t("receive.customer", "Customer")}</label>
            <Select value={pickedId ? String(pickedId) : ""} onValueChange={(v) => setPickedId(Number(v) || null)}>
              <SelectTrigger id="rcv-cust">
                <SelectValue placeholder={t("receive.choose", "Choose a customer who owes you…")} />
              </SelectTrigger>
              <SelectContent>
                {owing.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} — Rs {formatRs(c.currentBalance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={m.amountBlock}>
          <label htmlFor="rcv-amount" className={m.lbl}>
            {t("receive.amount", "Amount received")}
          </label>
          <div className={`${m.amount} ${tooMuch ? m.amountErr : ""}`}>
            <span>Rs</span>
            <input
              id="rcv-amount"
              ref={amountRef}
              className={m.mono}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              inputMode="numeric"
              placeholder="0"
              aria-invalid={tooMuch}
              aria-describedby="rcv-hint"
            />
          </div>
          <div className={m.quick}>
            {balance > 0 && (
              <button type="button" className={ui.pill} onClick={() => setAmount(String(balance))}>
                {t("receive.full", "Full balance")} · {formatRs(balance)}
              </button>
            )}
            {[1000, 5000].filter((v) => v < balance).map((v) => (
              <button key={v} type="button" className={ui.pill} onClick={() => setAmount(String(v))}>
                {formatRs(v)}
              </button>
            ))}
          </div>
          <p id="rcv-hint" className={m.after}>
            {target ? (
              <>
                {t("receive.after", "Balance after this payment")}{" "}
                <b className={m.mono}>
                  Rs {formatRs(balance)} → <span style={{ color: after === 0 ? "var(--pos)" : "var(--warn)" }}>Rs {formatRs(after)}</span>
                </b>
              </>
            ) : (
              t("receive.pick_first", "Choose a customer to see their balance.")
            )}
          </p>
        </div>

        <div className={ui.field}>
          <span className={m.lbl}>{t("receive.method", "Paid by")}</span>
          <div className={ui.segmented} role="radiogroup" aria-label={t("receive.method", "Paid by")}>
            {METHODS.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={method === x.id} className={method === x.id ? ui.segmentedOn : ""} onClick={() => setMethod(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className={ui.formGrid} style={{ marginTop: 14 }}>
          <div className={ui.field}>
            <label htmlFor="rcv-acc">{t("receive.into", "Into account")}</label>
            <Select value={accountId ? String(accountId) : ""} onValueChange={(v) => setAccountId(Number(v) || null)}>
              <SelectTrigger id="rcv-acc">
                <SelectValue placeholder={t("receive.no_account", "Add a cash or bank account first")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={ui.field}>
            <label htmlFor="rcv-ref">{t("receive.reference", "Reference (optional)")}</label>
            <input id="rcv-ref" className={`${ui.input} ${ui.inputMono}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TID / slip no." />
          </div>
        </div>

        {error && (
          <div className={m.error} role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={ui.formActions}>
          <button type="button" className={ui.secondary} onClick={onClose} disabled={busy}>
            {t("action.cancel", "Cancel")}
          </button>
          <button type="submit" className={`${ui.primary} ${ui.btnLg}`} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className={m.spin} />
                {t("receive.recording", "Recording payment…")}
              </>
            ) : (
              <>
                <Icon name="check" size={15} />
                {t("receive.submit", "Receive")} {value > 0 ? `Rs ${formatRs(value)}` : ""}
              </>
            )}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
