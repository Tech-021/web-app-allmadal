"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "./workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "./toast-context";
import { useBusiness } from "./business-context";
import { useDebounce } from "@/hooks/useDebounce";
import { logActivity } from "@/app/lib/logger";
import { validatePhone, validateEmail, validateText, validateNumber, sanitizePhoneInput } from "@/app/lib/validators";
import { useLanguage } from "./language-context";
import { DetailedSaleReceipt, PosReceiptModal } from "./pos-receipt-modal";
import { PaginationControls } from "./pagination-controls";
import { Icon, type IconName } from "@/app/components/icons";
import { EmptyState, PageHeader } from "@/app/components/page-layout";
import { Skeleton } from "@/app/components/motion";
import ui from "./workspace-ui.module.css";

type Mode = "customers" | "suppliers" | "expenses" | "accounts" | "sales";
type Row = Record<string, unknown> & { id: number };
type Field = { key: string; label: string; type?: string; required?: boolean };

const money = (v: unknown) => `Rs ${Number(v || 0).toLocaleString()}`;
const title = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());

const config: Record<
  Mode,
  {
    title: string;
    endpoint: string;
    add: string;
    fields: Field[];
    columns: string[];
  }
> = {
  customers: {
    title: "Customers",
    endpoint: "/customers",
    add: "Add Customer",
    fields: [
      { key: "name", label: "Customer Name", required: true },
      { key: "mobile", label: "Mobile Number", required: true },
      { key: "email", label: "Email (Optional)", type: "email" },
    ],
    columns: ["name", "mobile", "totalSpent", "visitCount", "currentBalance"],
  },
  suppliers: {
    title: "Suppliers",
    endpoint: "/suppliers",
    add: "Add Supplier",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "mobile", label: "Mobile", required: true },
      { key: "email", label: "Email", type: "email" },
    ],
    columns: ["name", "mobile", "currentBalance"],
  },
  expenses: {
    title: "Expenses",
    endpoint: "/finance/expenses",
    add: "Add Expense",
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "category", label: "Category", required: true },
      { key: "description", label: "Description" },
      { key: "accountId", label: "Account", type: "account", required: true },
    ],
    columns: ["occurredAt", "category", "description", "amount"],
  },
  accounts: {
    title: "Cash / Accounts",
    endpoint: "/finance/accounts",
    add: "Add Account",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "type", label: "Type", type: "select" },
      { key: "openingBalance", label: "Opening Balance", type: "number" },
    ],
    columns: ["name", "type", "balance"],
  },
  sales: {
    title: "Sales",
    endpoint: "/sales",
    add: "Create Sale",
    fields: [],
    columns: [
      "invoiceNumber",
      "createdAt",
      "customerName",
      "totalAmount",
      "paymentMethod",
      "itemCount",
    ],
  },
};

const MODE_META: Record<Mode, { icon: IconName; eyebrow: string; description: string; emptyTitle: string; emptyBody: string }> = {
  customers: {
    icon: "users",
    eyebrow: "Books",
    description: "Customer khata — who owes you, how much they spend, and their purchase history.",
    emptyTitle: "No customers yet",
    emptyBody: "Add customers to track their khata balance and purchase history.",
  },
  suppliers: {
    icon: "truck",
    eyebrow: "Books",
    description: "Supplier khata — payables, contacts and what you owe each vendor.",
    emptyTitle: "No suppliers yet",
    emptyBody: "Add suppliers to track payables and stock purchases.",
  },
  accounts: {
    icon: "bank",
    eyebrow: "Books",
    description: "Cash drawers, bank accounts and wallets with their running balances.",
    emptyTitle: "No accounts yet",
    emptyBody: "Add your cash, bank and wallet accounts to keep books balanced.",
  },
  expenses: {
    icon: "expense",
    eyebrow: "Books",
    description: "Rent, salaries, utilities and every other cost of running the store.",
    emptyTitle: "No expenses recorded",
    emptyBody: "Record expenses to see true profit in your reports.",
  },
  sales: {
    icon: "receipt",
    eyebrow: "Sales",
    description: "Completed sales and their receipts.",
    emptyTitle: "No sales yet",
    emptyBody: "Completed sales appear here.",
  },
};

export function BusinessManagementPage({ mode }: { mode: Mode }) {
  const c = config[mode];
  const { showToast, confirmDialog } = useToast();
  const { activeBusiness } = useBusiness();
  const { t, language } = useLanguage();

  const modeTitle =
    mode === "customers" ? t("customers.title") :
    mode === "suppliers" ? t("suppliers.title") :
    mode === "expenses" ? t("expenses.title") :
    mode === "accounts" ? t("nav.accounts") : t("nav.sales");

  const modeAdd =
    mode === "customers" ? (language === "ur" ? "Naya Grahak Dalein" : "Add Customer") :
    mode === "suppliers" ? (language === "ur" ? "Naya Supplier Dalein" : "Add Supplier") :
    mode === "expenses" ? (language === "ur" ? "Naya Kharcha Dalein" : "Add Expense") :
    mode === "accounts" ? (language === "ur" ? "Naya Account Dalein" : "Add Account") :
    (language === "ur" ? "Naya Bill Banayein" : "Create Sale");

  const getColTitle = (x: string) => {
    switch (x) {
      case "name": return t("table.name");
      case "mobile": return t("table.mobile");
      case "email": return t("table.email");
      case "currentBalance": return t("table.current_balance");
      case "totalSpent": return t("table.total_spent");
      case "visitCount": return language === "ur" ? "Kul Khareedari" : "Visits / Orders";
      case "amount": return t("table.amount");
      case "category": return t("table.category");
      case "description": return t("table.description");
      case "accountId": return t("table.account");
      case "type": return t("table.type");
      case "openingBalance": return t("table.opening_balance");
      case "balance": return t("table.balance");
      case "invoiceNumber": return t("table.invoice_number");
      case "createdAt":
      case "occurredAt": return t("table.date");
      case "customerName": return t("table.customer");
      case "totalAmount": return t("table.total_amount");
      case "paymentMethod": return t("table.payment_mode");
      case "itemCount": return t("term.quantity");
      default: return title(x);
    }
  };

  const [rows, setRows] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // Customer Purchase History modal state
  const [historyCustomer, setHistoryCustomer] = useState<Row | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerSales, setCustomerSales] = useState<DetailedSaleReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<DetailedSaleReceipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const searchParam = debouncedQuery
        ? `&search=${encodeURIComponent(debouncedQuery)}`
        : "";
      const res = await api<Record<string, unknown> | Row[]>(
        `${c.endpoint}?page=${page}&limit=${pageSize}${searchParam}`
      );
      const data = Array.isArray(res)
        ? res
        : ((res[mode] ||
            res.accounts ||
            res.expenses ||
            res.sales ||
            res.customers ||
            res.suppliers ||
            []) as Row[]);
      setRows(data);
      setTotal(Number((!Array.isArray(res) && res.total) || data.length));
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Could not load records.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [c.endpoint, mode, page, pageSize, debouncedQuery, showToast, activeBusiness?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "expenses") {
      void api<{ accounts: Row[] }>("/finance/accounts")
        .then((x) => setAccounts(x.accounts || []))
        .catch(() => undefined);
    }
  }, [mode, activeBusiness?.id]);

  // Modal ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function begin(row?: Row) {
    setEditing(row || null);
    setFieldErrors({});
    setDraft(
      Object.fromEntries(
        c.fields.map((field) => [
          field.key,
          String(row?.[field.key] ?? (field.key === "type" ? "cash" : "")),
        ])
      )
    );
    setOpen(true);
  }

  async function viewCustomerHistory(customer: Row) {
    setHistoryCustomer(customer);
    setHistoryLoading(true);
    try {
      const data = await api<{ customer: Row; sales: DetailedSaleReceipt[] }>(
        `/customers/${customer.id}/history`
      );
      setCustomerSales(data.sales || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load customer purchase history.", "error");
      setCustomerSales([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};

    if (mode === "customers") {
      const nameVal = validateText(draft.name, { minLength: 2, maxLength: 60, fieldName: "Customer name" });
      if (!nameVal.valid) errs.name = nameVal.error || "Name is required.";

      const phoneVal = validatePhone(draft.mobile, { required: true, fieldName: "Mobile number" });
      if (!phoneVal.valid) errs.mobile = phoneVal.error || "Valid mobile number is required.";

      if (draft.email) {
        const emailVal = validateEmail(draft.email, { required: false });
        if (!emailVal.valid) errs.email = emailVal.error || "Invalid email.";
      }
    } else if (mode === "suppliers") {
      const nameVal = validateText(draft.name, { minLength: 2, maxLength: 60, fieldName: "Supplier name" });
      if (!nameVal.valid) errs.name = nameVal.error || "Name is required.";

      const phoneVal = validatePhone(draft.mobile, { required: true, fieldName: "Mobile number" });
      if (!phoneVal.valid) errs.mobile = phoneVal.error || "Valid mobile number is required.";
      if (draft.email) {
        const emailVal = validateEmail(draft.email, { required: false });
        if (!emailVal.valid) errs.email = emailVal.error || "Invalid email.";
      }
    } else if (mode === "expenses") {
      const amtVal = validateNumber(draft.amount, { min: 1, fieldName: "Expense amount" });
      if (!amtVal.valid) errs.amount = amtVal.error || "Valid amount greater than 0 is required.";

      const catVal = validateText(draft.category, { minLength: 2, fieldName: "Category" });
      if (!catVal.valid) errs.category = catVal.error || "Category is required.";

      if (!draft.accountId) {
        errs.accountId = "Please select a payment account.";
      }
    } else if (mode === "accounts") {
      const nameVal = validateText(draft.name, { minLength: 2, maxLength: 50, fieldName: "Account name" });
      if (!nameVal.valid) errs.name = nameVal.error || "Account name is required.";

      if (draft.openingBalance) {
        const balVal = validateNumber(draft.openingBalance, { min: 0, fieldName: "Opening balance" });
        if (!balVal.valid) errs.openingBalance = balVal.error || "Opening balance must be 0 or greater.";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validateForm()) {
      showToast("Please fix highlighted errors before saving.", "error");
      return;
    }

    setSaving(true);
    try {
      await api(editing ? `${c.endpoint}/${editing.id}` : c.endpoint, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(draft),
      });
      showToast(
        `${c.add.replace("Add", "")} ${editing ? "updated" : "completed"}.`,
        "success"
      );

      // Log activity to DB
      const actionType = (
        mode === "customers" ? (editing ? "CUSTOMER_UPDATE" : "CUSTOMER_CREATE") :
        mode === "suppliers" ? (editing ? "SUPPLIER_UPDATE" : "SUPPLIER_CREATE") :
        mode === "expenses" ? (editing ? "EXPENSE_UPDATE" : "EXPENSE_CREATE") :
        mode === "accounts" ? (editing ? "ACCOUNT_UPDATE" : "ACCOUNT_CREATE") : "SALE_CREATE"
      ) as any;

      const categoryType = (
        mode === "customers" ? "Customer" :
        mode === "suppliers" ? "Supplier" :
        mode === "expenses" ? "Expense" :
        mode === "accounts" ? "Account" : "Sales"
      ) as any;

      const targetName = draft.name || draft.description || draft.category || `Item #${editing?.id || "new"}`;
      logActivity(
        actionType,
        categoryType,
        `${editing ? "Updated" : "Created"} ${mode.slice(0, -1)} '${targetName}'`,
        targetName,
        { ...draft, id: editing?.id }
      );

      setOpen(false);
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Operation failed.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Row) {
    const entityName =
      mode === "accounts"
        ? "account"
        : mode === "customers"
        ? "customer"
        : "supplier";
    const yes = await confirmDialog({
      title: `Delete ${entityName}?`,
      message:
        "This action cannot be undone. Historical records may prevent deletion.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!yes) return;
    try {
      await api(`${c.endpoint}/${row.id}`, { method: "DELETE" });
      showToast("Deleted successfully.", "success");

      const actionType = (
        mode === "customers" ? "CUSTOMER_DELETE" :
        mode === "suppliers" ? "SUPPLIER_DELETE" :
        mode === "expenses" ? "EXPENSE_DELETE" : "ACCOUNT_DELETE"
      ) as any;

      const categoryType = (
        mode === "customers" ? "Customer" :
        mode === "suppliers" ? "Supplier" :
        mode === "expenses" ? "Expense" : "Account"
      ) as any;

      const targetName = String(row.name || row.description || `ID #${row.id}`);
      logActivity(
        actionType,
        categoryType,
        `Deleted ${entityName} '${targetName}'`,
        targetName,
        { id: row.id }
      );

      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Could not delete record.",
        "error"
      );
    }
  }

  const getFieldLabel = (field: Field) => {
    switch (field.key) {
      case "name": return t("table.name");
      case "mobile": return t("table.mobile");
      case "email": return t("table.email");
      case "amount": return t("table.amount");
      case "category": return t("table.category");
      case "description": return t("table.description");
      case "accountId": return t("table.account");
      case "type": return t("table.type");
      case "openingBalance": return t("table.opening_balance");
      default: return field.label;
    }
  };

  return (
    <WorkspaceShell>
      <div className={ui.pageStack}>
      <PageHeader
        eyebrow={language === "ur" ? "Dukaan Intizam (Management)" : MODE_META[mode].eyebrow}
        title={modeTitle}
        description={language === "ur" ? "Mehfooz aur asaan hisab kitab, talaash aur mukammal ledger record." : MODE_META[mode].description}
        actions={
          mode !== "sales" && (
            <button className={ui.primary} onClick={() => begin()}>
              <Icon name="plus" size={15} />
              {modeAdd}
            </button>
          )
        }
      />

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        {mode !== "sales" && (
          <div className={ui.panelHead}>
            <input
              className={`${ui.input} ${ui.search} max-w-[440px]`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={language === "ur" ? "Talaash karein..." : `Search ${c.title.toLowerCase()}…`}
              aria-label={`Search ${c.title.toLowerCase()}`}
            />
            <div className="flex items-center gap-2">
              {total > 0 && (
                <span className={`${ui.chip} max-sm:hidden`}>
                  <span className="font-mono">{total}</span> {modeTitle.toLowerCase()}
                </span>
              )}
              <button className={ui.iconButton} onClick={() => void load()} aria-label={t("action.refresh")} title={t("action.refresh")}>
                <Icon name="refresh" size={15} className={loading ? "[animation:almadelSpin_800ms_linear_infinite]" : undefined} />
              </button>
            </div>
          </div>
        )}
        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                {c.columns.map((x) => (
                  <th
                    key={x}
                    style={["amount", "balance", "currentBalance", "totalSpent", "totalAmount"].includes(x) ? { textAlign: "right" } : undefined}
                  >
                    {getColTitle(x)}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    {c.columns.map((col) => (
                      <td key={col}>
                        <Skeleton className="h-3.5 w-3/4 my-1" />
                      </td>
                    ))}
                    <td>
                      <Skeleton className="h-3.5 w-16 my-1" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={c.columns.length + 1} className={ui.emptyCell}>
                    <EmptyState
                      icon={query ? "search" : MODE_META[mode].icon}
                      title={query ? "No matching records" : MODE_META[mode].emptyTitle}
                      body={query ? "Try a different search term." : MODE_META[mode].emptyBody}
                      action={
                        !query &&
                        mode !== "sales" && (
                          <button className={ui.primary} onClick={() => begin()}>
                            <Icon name="plus" size={15} />
                            {modeAdd}
                          </button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {c.columns.map((x) => {
                      const isMoney = ["amount", "balance", "currentBalance", "totalSpent", "totalAmount"].includes(x);
                      if (isMoney) {
                        const n = Number(row[x] || 0);
                        const tone =
                          x === "currentBalance"
                            ? n > 0
                              ? "text-[var(--warn)] font-semibold"
                              : n < 0
                              ? "text-[var(--neg)] font-semibold"
                              : "text-[var(--muted)]"
                            : "text-[var(--text)] font-medium";
                        return (
                          <td key={x} className="text-right tabular-nums whitespace-nowrap">
                            <span className={`font-mono ${tone}`}>{money(row[x])}</span>
                          </td>
                        );
                      }
                      if (x === "name" && (mode === "customers" || mode === "suppliers" || mode === "accounts")) {
                        const label = String(row[x] ?? "—");
                        const ini = label.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                        return (
                          <td key={x}>
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className={`${ui.productThumbPlaceholder} text-[11px] font-semibold text-[var(--text-2)]`}>
                                {ini || "—"}
                              </span>
                              <span className="font-medium truncate">{label}</span>
                            </span>
                          </td>
                        );
                      }
                      if (x === "mobile") {
                        return (
                          <td key={x} className="font-mono text-[12.5px] text-[var(--text-2)]">
                            {String(row[x] ?? "—")}
                          </td>
                        );
                      }
                      if (x === "occurredAt" || x === "createdAt") {
                        const v = row[x];
                        const d = v ? new Date(String(v)) : null;
                        return (
                          <td key={x} className="text-[var(--text-2)] whitespace-nowrap tabular-nums">
                            {d && !Number.isNaN(d.getTime())
                              ? d.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
                              : String(v ?? "—")}
                          </td>
                        );
                      }
                      if (x === "type" || x === "category" || x === "paymentMethod") {
                        return (
                          <td key={x}>
                            <span className={`${ui.chip} capitalize`}>{String(row[x] ?? "—")}</span>
                          </td>
                        );
                      }
                      return <td key={x}>{String(row[x] ?? "—")}</td>;
                    })}
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {mode === "customers" && (
                          <button type="button" className={`${ui.secondary} ${ui.btnSm}`} onClick={() => void viewCustomerHistory(row)} title="View purchase history">
                            <Icon name="clock" size={13} />
                            <span>{language === "ur" ? "Tareekh" : "History"}</span>
                          </button>
                        )}
                        {mode !== "sales" && (
                          <>
                            <button className={`${ui.secondary} ${ui.btnSm}`} onClick={() => begin(row)}>
                              <Icon name="edit" size={13} />
                              {t("action.edit")}
                            </button>
                            <button
                              className={`${ui.iconButton} hover:!text-[var(--neg)]`}
                              onClick={() => void remove(row)}
                              aria-label={t("action.delete")}
                              title={t("action.delete")}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <PaginationControls
            currentPage={page}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel={modeTitle.toLowerCase()}
          />
        )}
      </section>
      </div>

      {open && (
        <div
          className={ui.modal}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form className={ui.sheet} onSubmit={submit}>
            <div className={ui.sheetHead}>
              <div className="flex items-center gap-2.5">
                <span className={ui.iconTile}>
                  <Icon name={editing ? "edit" : MODE_META[mode].icon} size={15} />
                </span>
                <h2>{editing ? `${t("action.edit")} ${modeTitle}` : modeAdd}</h2>
              </div>
              <button type="button" className={ui.iconButton} onClick={() => setOpen(false)} aria-label={t("form.close")}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className={ui.formGrid}>
              {c.fields.map((field) => (
                <div className={ui.field} key={field.key}>
                  <label>
                    {getFieldLabel(field)} {field.required && <span className="text-[var(--neg)]">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      className={ui.select}
                      value={draft[field.key] || "cash"}
                      onChange={(e) => {
                        setDraft({ ...draft, [field.key]: e.target.value });
                        if (fieldErrors[field.key]) setFieldErrors((p) => ({ ...p, [field.key]: "" }));
                      }}
                    >
                      <option value="cash">Cash (Rokarr)</option>
                      <option value="bank">Bank</option>
                      <option value="wallet">Wallet</option>
                      <option value="online">Online</option>
                    </select>
                  ) : field.type === "account" ? (
                    <select
                      className={`${field.type === "account" ? ui.select : ui.input} ${field.key === "mobile" || String(field.type) === "number" ? ui.inputMono : ""} ${fieldErrors[field.key] ? ui.invalid : ""}`}
                      required
                      value={draft[field.key] || ""}
                      onChange={(e) => {
                        setDraft({ ...draft, [field.key]: e.target.value });
                        if (fieldErrors[field.key]) setFieldErrors((p) => ({ ...p, [field.key]: "" }));
                      }}
                    >
                      <option value="">{t("form.select_account")}</option>
                      {accounts
                        .filter((a) => a.isActive !== false)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {String(a.name)}
                          </option>
                        ))}
                    </select>
                  ) : field.key === "mobile" ? (
                    <input
                      className={`${field.type === "account" ? ui.select : ui.input} ${field.key === "mobile" || String(field.type) === "number" ? ui.inputMono : ""} ${fieldErrors[field.key] ? ui.invalid : ""}`}
                      required={field.required}
                      type="tel"
                      maxLength={15}
                      placeholder="03001234567"
                      value={draft[field.key] || ""}
                      onChange={(e) => {
                        const clean = sanitizePhoneInput(e.target.value);
                        setDraft({ ...draft, [field.key]: clean });
                        if (fieldErrors[field.key]) setFieldErrors((p) => ({ ...p, [field.key]: "" }));
                      }}
                    />
                  ) : (
                    <input
                      className={`${field.type === "account" ? ui.select : ui.input} ${field.key === "mobile" || String(field.type) === "number" ? ui.inputMono : ""} ${fieldErrors[field.key] ? ui.invalid : ""}`}
                      required={field.required}
                      type={field.type || "text"}
                      min={field.type === "number" ? "0" : undefined}
                      maxLength={field.type === "email" ? 100 : 200}
                      placeholder={field.type === "email" ? "name@example.com" : undefined}
                      value={draft[field.key] || ""}
                      onChange={(e) => {
                        setDraft({ ...draft, [field.key]: e.target.value });
                        if (fieldErrors[field.key]) setFieldErrors((p) => ({ ...p, [field.key]: "" }));
                      }}
                    />
                  )}
                  {fieldErrors[field.key] && (
                    <span className={ui.fieldError}>
                      <Icon name="alert" size={12} />
                      {fieldErrors[field.key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.secondary}
                onClick={() => setOpen(false)}
              >
                {t("action.cancel")}
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving
                  ? t("form.saving")
                  : editing
                  ? t("action.save_changes")
                  : t("action.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer Purchase History Modal */}
      {historyCustomer && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHistoryCustomer(null);
          }}
        >
          <div className={ui.sheet} style={{ width: "min(680px, 100%)" }} role="dialog" aria-modal="true" aria-label="Customer purchase history">
            <div className={ui.sheetHead}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[var(--brand-soft)] text-[13px] font-semibold text-[var(--brand-ink)]">
                  {String(historyCustomer.name || "C").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate">{String(historyCustomer.name || "Customer")}</h2>
                  <p className="m-0 mt-0.5 truncate text-[12.5px] text-[var(--muted)]">
                    <span className="font-mono">{String(historyCustomer.mobile || "—")}</span>
                    {historyCustomer.email ? ` · ${String(historyCustomer.email)}` : ""}
                  </p>
                </div>
              </div>
              <button type="button" className={ui.iconButton} onClick={() => setHistoryCustomer(null)} aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </div>

            <div className={`${ui.stats} mb-4`} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <div className={ui.stat}>
                <small>Purchases</small>
                <strong className="font-mono">{customerSales.length}</strong>
              </div>
              <div className={ui.stat}>
                <small>Total spent</small>
                <strong className="font-mono">Rs {customerSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0).toLocaleString()}</strong>
              </div>
              <div className={ui.stat}>
                <small>Khata balance</small>
                <strong className={`font-mono ${Number(historyCustomer.currentBalance || 0) > 0 ? "!text-[var(--warn)]" : ""}`}>{money(historyCustomer.currentBalance)}</strong>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {historyLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-[68px] w-full rounded-[10px]" />
                  ))}
                </div>
              ) : customerSales.length === 0 ? (
                <EmptyState icon="cart" title="No purchase history yet" body="Receipts appear here automatically when this customer buys at the POS counter." />
              ) : (
                <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
                  {customerSales.map((sale, i) => (
                    <div key={sale.invoiceNumber} className={`flex items-center justify-between gap-3 px-3.5 py-3 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-mono text-[12.5px] font-medium text-[var(--brand-ink)]">#{sale.invoiceNumber}</span>
                          <span className={`${ui.chip} ${ui.chipXs} capitalize`}>{sale.paymentMethod}</span>
                        </div>
                        <div className="font-mono text-[11.5px] text-[var(--muted)]">
                          {new Date(sale.createdAt).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {sale.items?.length || 0} item{(sale.items?.length || 0) > 1 ? "s" : ""}
                        </div>
                        {sale.items && sale.items.length > 0 && (
                          <div className="mt-1 truncate text-[12px] text-[var(--text-2)]">{sale.items.map((it) => `${it.name} ×${it.quantity}`).join(", ")}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-[14px] font-medium">Rs {Number(sale.totalAmount).toLocaleString()}</span>
                        {sale.discountAmount && sale.discountAmount > 0 ? (
                          <span className="font-mono text-[11px] text-[var(--pos)]">−Rs {sale.discountAmount.toLocaleString()}</span>
                        ) : null}
                        <button type="button" onClick={() => setSelectedReceipt(sale)} className={`${ui.secondary} ${ui.btnSm}`}>
                          <Icon name="eye" size={13} />
                          Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setHistoryCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <PosReceiptModal
          isOpen={true}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </WorkspaceShell>
  );
}
