"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "./workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "./toast-context";
import { useBusiness } from "./business-context";
import { useDebounce } from "@/hooks/useDebounce";
import { logActivity } from "@/app/lib/logger";
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
    title: "Customers / Khata",
    endpoint: "/customers",
    add: "Add Customer",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "mobile", label: "Mobile", required: true },
      { key: "email", label: "Email", type: "email" },
    ],
    columns: ["name", "mobile", "currentBalance", "totalSpent"],
  },
  suppliers: {
    title: "Suppliers",
    endpoint: "/suppliers",
    add: "Add Supplier",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "mobile", label: "Mobile" },
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

  const [rows, setRows] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const searchParam = debouncedQuery
        ? `&search=${encodeURIComponent(debouncedQuery)}`
        : "";
      const res = await api<Record<string, unknown> | Row[]>(
        `${c.endpoint}?page=${page}&limit=25${searchParam}`
      );
      const data = Array.isArray(res)
        ? res
        : ((res[mode] ||
            res.accounts ||
            res.expenses ||
            res.sales ||
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
  }, [c.endpoint, mode, page, debouncedQuery, showToast, activeBusiness?.id]);

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

  async function submit(e: FormEvent) {
    e.preventDefault();
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

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Business Management</label>
          <h1>{c.title}</h1>
          <p>
            Business-scoped records with debounced search, server-side pagination, and safe mutations.
          </p>
        </div>
        {mode !== "sales" && (
          <button className={ui.primary} onClick={() => begin()}>
            + {c.add}
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
            placeholder={`Search ${c.title.toLowerCase()}...`}
          />
          <button className={ui.secondary} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      )}

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                {c.columns.map((x) => (
                  <th key={x}>{title(x)}</th>
                ))}
                <th>Actions</th>
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
                    No records found.
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
                        {mode !== "sales" && (
                          <>
                            <button
                              className={ui.secondary}
                              onClick={() => begin(row)}
                            >
                              Edit
                            </button>
                            <button
                              className={ui.danger}
                              onClick={() => void remove(row)}
                            >
                              Delete
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

        {total > 25 && (
          <div className="flex justify-between items-center p-4 text-xs font-bold border-t border-slate-100">
            <button
              className={ui.secondary}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="text-slate-600">
              Page {page} of {Math.ceil(total / 25)}
            </span>
            <button
              className={ui.secondary}
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
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
                  ? `Edit ${c.title.replace(" / Khata", "")}`
                  : c.add}
              </h2>
              <button
                type="button"
                className={ui.secondary}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className={ui.formGrid}>
              {c.fields.map((field) => (
                <div className={ui.field} key={field.key}>
                  <label>{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      className={ui.input}
                      value={draft[field.key] || "cash"}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.key]: e.target.value })
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="wallet">Wallet</option>
                      <option value="online">Online</option>
                    </select>
                  ) : field.type === "account" ? (
                    <select
                      className={ui.input}
                      required
                      value={draft[field.key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.key]: e.target.value })
                      }
                    >
                      <option value="">Select Account</option>
                      {accounts
                        .filter((a) => a.isActive !== false)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {String(a.name)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      className={ui.input}
                      required={field.required}
                      type={field.type || "text"}
                      value={draft[field.key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [field.key]: e.target.value })
                      }
                    />
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
                Cancel
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving
                  ? "Saving..."
                  : editing
                  ? "Save Changes"
                  : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
