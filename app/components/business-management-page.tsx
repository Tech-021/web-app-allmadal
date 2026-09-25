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
      <div className={ui.head}>
        <div>
          <label>{language === "ur" ? "Dukaan Intizam (Management)" : "Business Management"}</label>
          <h1>{modeTitle}</h1>
          <p>
            {language === "ur"
              ? "Mehfooz aur asaan hisab kitab, talaash aur mukammal ledger record."
              : "Business-scoped records with debounced search, server-side pagination, and safe mutations."}
          </p>
        </div>
        {mode !== "sales" && (
          <button className={ui.primary} onClick={() => begin()}>
            + {modeAdd}
          </button>
        )}
      </div>

      {mode !== "sales" && (
        <div className={ui.toolbar}>
          <input
            className={`${ui.input} ${ui.search}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={language === "ur" ? "Talaash karein..." : `Search ${c.title.toLowerCase()}...`}
          />
          <button className={ui.secondary} onClick={() => void load()}>
            🔄 {t("action.refresh")}
          </button>
        </div>
      )}

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                {c.columns.map((x) => (
                  <th key={x}>{getColTitle(x)}</th>
                ))}
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    {c.columns.map((col) => (
                      <td key={col}>
                        <div className="h-4 bg-slate-200/80 rounded-md w-3/4 my-1.5" />
                      </td>
                    ))}
                    <td>
                      <div className="h-4 bg-slate-200/80 rounded-md w-16 my-1.5" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={c.columns.length + 1} className={ui.empty}>
                    {t("table.no_records")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    {c.columns.map((x) => (
                      <td key={x}>
                        {[
                          "amount",
                          "balance",
                          "currentBalance",
                          "totalSpent",
                          "totalAmount",
                        ].includes(x) ? (
                          <strong className="text-[#00875a]">
                            {money(row[x])}
                          </strong>
                        ) : (
                          String(row[x] ?? "—")
                        )}
                      </td>
                    ))}
                    <td>
                      <div className={ui.actions}>
                        {mode === "customers" && (
                          <button
                            type="button"
                            className={ui.secondary}
                            onClick={() => void viewCustomerHistory(row)}
                            title="View purchase history"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <span>🛍️</span>
                            <span>{language === "ur" ? "Tareekh" : "History"}</span>
                          </button>
                        )}
                        {mode !== "sales" && (
                          <>
                            <button
                              className={ui.secondary}
                              onClick={() => begin(row)}
                            >
                              {t("action.edit")}
                            </button>
                            <button
                              className={ui.danger}
                              onClick={() => void remove(row)}
                            >
                              {t("action.delete")}
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

      {open && (
        <div
          className={ui.modal}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form className={ui.sheet} onSubmit={submit}>
            <div className={ui.sheetHead}>
              <h2>
                {editing
                  ? `${t("action.edit")} ${modeTitle}`
                  : `+ ${modeAdd}`}
              </h2>
              <button
                type="button"
                className={ui.secondary}
                onClick={() => setOpen(false)}
              >
                {t("form.close")}
              </button>
            </div>
            <div className={ui.formGrid}>
              {c.fields.map((field) => (
                <div className={ui.field} key={field.key}>
                  <label>
                    {getFieldLabel(field)} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      className={ui.input}
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
                      className={`${ui.input} ${fieldErrors[field.key] ? "border-red-500 bg-red-50/40" : ""}`}
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
                      className={`${ui.input} ${fieldErrors[field.key] ? "border-red-500 bg-red-50/40" : ""}`}
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
                      className={`${ui.input} ${fieldErrors[field.key] ? "border-red-500 bg-red-50/40" : ""}`}
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
                    <span className="text-[11px] font-bold text-red-600 mt-1 block">
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
          <div className={ui.sheet} style={{ maxWidth: 680 }}>
            <div className={ui.sheetHead}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🛍️</span>
                  <span>{String(historyCustomer.name || "Customer")}</span>
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                  Mobile: <strong style={{ color: "#1e293b" }}>{String(historyCustomer.mobile || "—")}</strong>
                  {historyCustomer.email ? ` • Email: ${String(historyCustomer.email)}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={ui.secondary}
                onClick={() => setHistoryCustomer(null)}
              >
                Close
              </button>
            </div>

            {/* Customer Stats Overview Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "16px 0" }}>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block" }}>Total Purchases</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>{customerSales.length} bills</strong>
              </div>
              <div style={{ background: "#f0fdf4", padding: "12px 14px", borderRadius: 12, border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", display: "block" }}>Total Spent</span>
                <strong style={{ fontSize: 16, color: "#15803d" }}>
                  Rs {customerSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0).toLocaleString()}
                </strong>
              </div>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block" }}>Khata Balance</span>
                <strong style={{ fontSize: 16, color: "#0f172a" }}>
                  {money(historyCustomer.currentBalance)}
                </strong>
              </div>
            </div>

            {/* Past Orders List */}
            <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                  Loading purchase history...
                </div>
              ) : customerSales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                  <strong style={{ display: "block", fontSize: 14, color: "#1e293b", marginBottom: 4 }}>
                    No purchase history yet
                  </strong>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    When this customer completes purchases at the POS counter, their receipts will automatically appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {customerSales.map((sale) => (
                    <div
                      key={sale.invoiceNumber}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                            #{sale.invoiceNumber}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: "#dcfce7",
                              color: "#166534",
                              textTransform: "uppercase",
                            }}
                          >
                            {sale.paymentMethod}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {new Date(sale.createdAt).toLocaleDateString("en-PK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          &bull; {sale.items?.length || 0} item{(sale.items?.length || 0) > 1 ? "s" : ""}
                        </div>
                        {sale.items && sale.items.length > 0 && (
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {sale.items.map((it) => `${it.name} (x${it.quantity})`).join(", ")}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#00875a" }}>
                          Rs {Number(sale.totalAmount).toLocaleString()}
                        </div>
                        {sale.discountAmount && sale.discountAmount > 0 ? (
                          <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>
                            Disc: -Rs {sale.discountAmount.toLocaleString()}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(sale)}
                          style={{
                            marginTop: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 6,
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          🧾 View Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={ui.formActions} style={{ marginTop: 16 }}>
              <button
                type="button"
                className={ui.secondary}
                onClick={() => setHistoryCustomer(null)}
              >
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
